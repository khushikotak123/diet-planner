/* ============================================
   Health+ Platform - Express Backend Server
   Handles: AI Diet Plan generation (Gemini API)
            SMS Medication Reminders (Twilio)
            Meal Photo Analysis (Gemini Vision)
            Conversational Diet Coach (Gemini)
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
app.use(express.json({ limit: '10mb' }));

/* Serve static frontend files */
app.use(express.static(__dirname));

/* --- Gemini API Configuration --- */
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" +
  process.env.GEMINI_API_KEY;

/**
 * POST /diet
 * Generate a personalized diet plan using the Gemini AI.
 * Now accepts dynamic calorie targets from the frontend's BMR/TDEE calculator.
 */
app.post("/api/diet", async (req, res) => {
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

    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });

    const data = await response.json();
    let dietPlan = {};
    if (data.candidates?.length > 0) {
      const text = data.candidates[0].content?.parts?.[0]?.text || "";
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
const client = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

if (!client) {
  console.warn("Twilio credentials not found — SMS endpoint will be unavailable.");
}

/**
 * POST /send-sms
 * Send an SMS medication reminder via Twilio.
 */
app.post("/api/send-sms", async (req, res) => {
  try {
    if (!client) {
      return res.status(503).json({ error: "Twilio is not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env" });
    }

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

/**
 * POST /api/analyze-photo
 * Analyze a meal photo using Gemini Vision API.
 */
app.post("/api/analyze-photo", async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: "No image provided" });

    const prompt = `You are a nutrition analysis AI. Analyze this food image and identify all visible food items.
For each food item, estimate the nutritional information.

IMPORTANT: Return ONLY valid JSON, no markdown, no explanation.
Structure:
{
  "foods": [
    { "name": "Food item name", "portion": "estimated portion size", "calories": number, "protein": number, "carbs": number, "fat": number }
  ],
  "totalCalories": number,
  "totalProtein": number,
  "totalCarbs": number,
  "totalFat": number,
  "confidence": "high/medium/low",
  "description": "Brief description of the meal"
}`;

    const matches = image.match(/^data:(image\/\w+);base64,(.+)$/);
    let inlineData, mimeType;
    if (matches) {
      mimeType = matches[1];
      inlineData = matches[2];
    } else {
      mimeType = "image/jpeg";
      inlineData = image;
    }

    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: inlineData } }
          ]
        }]
      }),
    });

    const data = await response.json();
    let result = {};
    if (data.candidates?.length > 0) {
      const text = data.candidates[0].content?.parts?.[0]?.text || "";
      if (text) {
        const cleaned = text.replace(/```json|```/g, "").trim();
        result = JSON.parse(cleaned);
      }
    }

    res.json({ analysis: result });
  } catch (err) {
    console.error("Photo analysis error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/chat
 * Conversational Diet Coach via Gemini.
 */
app.post("/api/chat", async (req, res) => {
  try {
    const { message, history, profile } = req.body;
    if (!message) return res.status(400).json({ error: "No message provided" });

    const profileContext = profile
      ? `User profile: Age ${profile.age}, Gender ${profile.gender}, Height ${profile.height}cm, Weight ${profile.weight}kg, Goal: ${profile.goal}, Activity: ${profile.activityLevel}, Diet: ${profile.dietType}.`
      : "No user profile available.";

    const systemPrompt = `You are Health+ Diet Coach, a friendly and knowledgeable AI nutrition assistant.
You help users with:
- Nutrition questions and advice
- Recipe suggestions based on dietary preferences
- Meal planning tips
- Understanding macronutrients and micronutrients
- Healthy eating habits and lifestyle tips
- Calorie counting guidance

${profileContext}

Keep responses concise but informative. Use bullet points for lists.
Be encouraging and supportive. If asked about medical conditions, advise consulting a healthcare professional.
Format your response in plain text with line breaks for readability.`;

    const conversationParts = [];
    conversationParts.push({ text: systemPrompt });

    if (history && history.length > 0) {
      const recent = history.slice(-10);
      recent.forEach(msg => {
        conversationParts.push({ text: `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}` });
      });
    }

    conversationParts.push({ text: `User: ${message}` });

    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: conversationParts }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        }
      }),
    });

    const data = await response.json();
    let reply = "Sorry, I could not generate a response. Please try again.";
    if (data.candidates?.length > 0) {
      reply = data.candidates[0].content?.parts?.[0]?.text || reply;
    }

    res.json({ reply });
  } catch (err) {
    console.error("Chat API error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* --- Start Server --- */
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
