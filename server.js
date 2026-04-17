/* ============================================
   Health+ Platform - Express Backend Server
   Handles: AI Diet Plan generation (Gemini API)
            SMS Medication Reminders (Twilio)
            Static file serving
   ============================================ */

import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import twilio from "twilio";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

/* --- Security headers (helmet) ---
   CSP is disabled here because existing HTML pages rely on inline <script>
   blocks. Tightening CSP is tracked as future work. */
app.use(helmet({ contentSecurityPolicy: false }));

/* --- CORS lockdown ---
   Only accept cross-origin requests from explicitly allowlisted origins.
   By default (no env var), same-origin requests are allowed — which is the
   safer default for a monolithic static + API server. */
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      /* Same-origin or non-browser requests (curl, mobile apps) have no Origin */
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
  })
);

/* --- Body size limit to mitigate DoS via huge payloads --- */
app.use(express.json({ limit: "10kb" }));

/* --- Serve static frontend files from a dedicated public/ directory ---
   This prevents accidental exposure of server.js, package.json, .env, etc. */
app.use(
  express.static(join(__dirname, "public"), {
    dotfiles: "deny",
    index: "index.html",
  })
);

/* --- Rate limiters --- */
const dietLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

const smsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // SMS is costly / abusable — keep strict
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many SMS requests, please try again later." },
});

/* --- Gemini API Configuration --- */
const API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=" +
  process.env.GEMINI_API_KEY;

/* --- Validation helpers --- */
const ALLOWED_GENDERS = new Set(["Male", "Female", "Other"]);
const ALLOWED_GOALS = new Set(["Weight Loss", "Muscle Gain", "Maintenance"]);
const ALLOWED_DIET_TYPES = new Set([
  "Vegetarian",
  "Vegan",
  "Pescatarian",
  "Omnivore",
]);
const ALLOWED_ACTIVITY = new Set([
  "sedentary",
  "light",
  "moderate",
  "active",
  "veryActive",
]);

function numInRange(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

function safeString(value, maxLen) {
  if (typeof value !== "string") return "";
  return value.replace(/[\x00-\x1F\x7F]/g, "").slice(0, maxLen);
}

/** Basic E.164 phone validator: "+" followed by 8–15 digits. */
function isValidPhoneE164(phone) {
  return typeof phone === "string" && /^\+[1-9]\d{7,14}$/.test(phone);
}

function validateDietInput(body) {
  const age = numInRange(body.age, 10, 120);
  const height = numInRange(body.height, 50, 300);
  const weight = numInRange(body.weight, 20, 500);
  const gender = ALLOWED_GENDERS.has(body.gender) ? body.gender : null;
  const goal = ALLOWED_GOALS.has(body.goal) ? body.goal : null;
  const dietType = ALLOWED_DIET_TYPES.has(body.dietType) ? body.dietType : null;
  const activityLevel = ALLOWED_ACTIVITY.has(body.activityLevel)
    ? body.activityLevel
    : "moderate";
  const allergies = safeString(body.allergies, 200);
  const targetCalories =
    body.targetCalories != null ? numInRange(body.targetCalories, 800, 6000) : null;

  let macros = null;
  if (body.macros && typeof body.macros === "object") {
    const p = numInRange(body.macros.protein, 0, 1000);
    const c = numInRange(body.macros.carbs, 0, 2000);
    const f = numInRange(body.macros.fat, 0, 1000);
    if (p !== null && c !== null && f !== null) {
      macros = { protein: p, carbs: c, fat: f };
    }
  }

  if (age === null || height === null || weight === null) {
    return { error: "Invalid age, height, or weight" };
  }
  if (!gender) return { error: "Invalid gender" };
  if (!goal) return { error: "Invalid goal" };
  if (!dietType) return { error: "Invalid dietType" };

  return {
    value: {
      age,
      height,
      weight,
      gender,
      goal,
      dietType,
      activityLevel,
      allergies,
      targetCalories,
      macros,
    },
  };
}

/**
 * POST /diet
 * Generate a personalized diet plan using the Gemini AI.
 */
app.post("/diet", dietLimiter, async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: "Diet planner is not configured." });
    }

    const { error, value } = validateDietInput(req.body || {});
    if (error) return res.status(400).json({ error });

    const {
      age,
      gender,
      height,
      weight,
      goal,
      dietType,
      allergies,
      activityLevel,
      targetCalories,
      macros,
    } = value;

    const calorieInstruction = targetCalories
      ? `The daily calorie target is ${targetCalories} kcal (calculated from BMR/TDEE for ${activityLevel} activity, goal: ${goal}).
Recommended macros: Protein ${macros?.protein ?? "N/A"}g, Carbs ${macros?.carbs ?? "N/A"}g, Fat ${macros?.fat ?? "N/A"}g.
Please design the meal plan to match these targets as closely as possible.`
      : `Please calculate appropriate calories based on the person's stats and goal.`;

    const prompt = `
You are a professional diet planner AI.
Create a daily diet plan for a person with:
Age: ${age}, Gender: ${gender}, Height: ${height}cm, Weight: ${weight}kg,
Goal: ${goal}, Diet Type: ${dietType}, Allergies: ${allergies || "None"}.

${calorieInstruction}

IMPORTANT: Format the response strictly as **valid JSON** only.
No explanations, no markdown, no text outside of JSON.
The structure must be:

{
  "meals": [
    { "meal": "Breakfast", "items": ["..."], "calories": number, "protein": number, "carbs": number, "fat": number },
    { "meal": "Lunch", "items": ["..."], "calories": number, "protein": number, "carbs": number, "fat": number },
    { "meal": "Dinner", "items": ["..."], "calories": number, "protein": number, "carbs": number, "fat": number }
  ],
  "snacks": [ { "items": ["..."], "calories": number } ],
  "totalCalories": number,
  "notes": "..."
}
`;

    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });

    const data = await response.json();

    let dietPlan = {};
    if (data.candidates?.length > 0) {
      const text =
        data.candidates[0].content?.parts?.[0]?.text ||
        data.candidates[0].output_text;
      if (text) {
        const cleaned = text.replace(/```json|```/g, "").trim();
        try {
          dietPlan = JSON.parse(cleaned);
        } catch {
          return res
            .status(502)
            .json({ error: "Failed to parse diet plan response." });
        }
      }
    }

    res.json({ plan: dietPlan });
  } catch (err) {
    console.error("Diet endpoint error:", err);
    res.status(500).json({ error: "Failed to generate diet plan." });
  }
});

/* --- Twilio SMS Configuration --- */
const client =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

if (!client) {
  console.warn(
    "Twilio credentials not found — SMS endpoint will be unavailable."
  );
}

/**
 * POST /send-sms
 * Send an SMS medication reminder via Twilio.
 */
app.post("/send-sms", smsLimiter, async (req, res) => {
  try {
    if (!client) {
      return res.status(503).json({
        error:
          "SMS is not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN on the server.",
      });
    }

    const { phoneNumber, message } = req.body || {};
    if (!isValidPhoneE164(phoneNumber)) {
      return res.status(400).json({
        error: "Invalid phone number. Use E.164 format (e.g. +14155552671).",
      });
    }
    const safeMessage = safeString(message, 320);
    if (!safeMessage) {
      return res.status(400).json({ error: "Missing or invalid message." });
    }

    const msg = await client.messages.create({
      body: safeMessage,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    });

    res.json({ success: true, sid: msg.sid });
  } catch (err) {
    console.error("SMS endpoint error:", err);
    res.status(500).json({ error: "Failed to send SMS." });
  }
});

/* --- Start Server --- */
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
