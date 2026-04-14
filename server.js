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
import { fileURLToPath } from "url";
import { dirname, join } from "path";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

/* Serve static frontend files */
app.use(express.static(__dirname));

/* --- Gemini API Configuration --- */
const API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=" +
  process.env.GEMINI_API_KEY;

/**
 * POST /diet
 * Generate a personalized diet plan using the Gemini AI.
 * Now accepts dynamic calorie targets from the frontend's BMR/TDEE calculator.
 */
app.post("/diet", async (req, res) => {
  try {
    const {
      age, gender, height, weight, goal, dietType, allergies,
      activityLevel, targetCalories, macros,
    } = req.body;

    /* Build an enhanced prompt that includes the dynamic calorie target */
    const calorieInstruction = targetCalories
      ? `The daily calorie target is ${targetCalories} kcal (calculated from BMR/TDEE for ${activityLevel || "moderate"} activity, goal: ${goal}).
Recommended macros: Protein ${macros?.protein || "N/A"}g, Carbs ${macros?.carbs || "N/A"}g, Fat ${macros?.fat || "N/A"}g.
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
    console.log("Gemini raw response:", JSON.stringify(data, null, 2));

    let dietPlan = {};
    if (data.candidates?.length > 0) {
      const text = data.candidates[0].content?.parts?.[0]?.text || data.candidates[0].output_text;
      if (text) {
        const cleaned = text.replace(/```json|```/g, "").trim();
        dietPlan = JSON.parse(cleaned);
      }
    }

    res.json({ plan: dietPlan });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* --- Twilio SMS Configuration --- */
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

/**
 * POST /send-sms
 * Send an SMS medication reminder via Twilio.
 */
app.post("/send-sms", async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;
    if (!phoneNumber || !message) {
      return res.status(400).json({ error: "Missing phoneNumber or message" });
    }

    const msg = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    });

    console.log("SMS sent:", msg.sid);
    res.json({ success: true, sid: msg.sid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send SMS" });
  }
});

/* --- Start Server --- */
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
