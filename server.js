import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import twilio from "twilio";
import cors from "cors";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());


const API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=" +
  process.env.GEMINI_API_KEY;

app.post("/diet", async (req, res) => {
  try {
    const { age, gender, height, weight, goal, dietType, allergies } = req.body;

    const prompt = `
You are a professional diet planner AI.
Create a daily diet plan for a person with:
Age: ${age}, Gender: ${gender}, Height: ${height}cm, Weight: ${weight}kg,
Goal: ${goal}, Diet Type: ${dietType}, Allergies: ${allergies || "None"}.

⚠️ IMPORTANT: Format the response strictly as **valid JSON** only.
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

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

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

    console.log("✅ SMS sent:", msg.sid);
    res.json({ success: true, sid: msg.sid });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send SMS" });
  }
});

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
