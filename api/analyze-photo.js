/* Vercel Serverless Function: Meal Photo Analysis via Gemini Vision */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { image } = req.body; /* base64 encoded image */
    if (!image) return res.status(400).json({ error: 'No image provided' });

    const API_URL =
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' +
      process.env.GEMINI_API_KEY;

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

    /* Extract base64 data and mime type */
    const matches = image.match(/^data:(image\/\w+);base64,(.+)$/);
    let inlineData, mimeType;
    if (matches) {
      mimeType = matches[1];
      inlineData = matches[2];
    } else {
      mimeType = 'image/jpeg';
      inlineData = image;
    }

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      const text = data.candidates[0].content?.parts?.[0]?.text || '';
      if (text) {
        const cleaned = text.replace(/```json|```/g, '').trim();
        result = JSON.parse(cleaned);
      }
    }

    res.json({ analysis: result });
  } catch (err) {
    console.error('Photo analysis error:', err);
    res.status(500).json({ error: err.message });
  }
}
