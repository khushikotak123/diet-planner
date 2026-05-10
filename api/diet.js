// api/diet.js — Vercel Serverless Function (FIXED)
// Bug fixed: Gemini response was not being parsed correctly — the JSON was
// wrapped in markdown code fences (```json ... ```) which broke JSON.parse().
// Also fixed: wrong/deprecated model name, missing CORS headers.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not set in Vercel environment variables' });
  }

  const { age, gender, height, weight, activityLevel, goal, dietType, allergies, targetCalories, macros } = req.body;

  if (!age || !gender || !height || !weight || !goal || !dietType) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Build the prompt — explicitly tell Gemini to return ONLY raw JSON, no markdown fences
  const prompt = `You are a professional nutritionist. Create a detailed daily meal plan.

User details:
- Age: ${age}, Gender: ${gender}
- Height: ${height}cm, Weight: ${weight}kg
- Activity Level: ${activityLevel || 'moderate'}
- Goal: ${goal}
- Diet Type: ${dietType}
- Allergies/Restrictions: ${allergies || 'none'}
- Target Calories: ${targetCalories || 'auto-calculate'} kcal/day
- Target Macros: Protein ${macros?.protein || '?'}g, Carbs ${macros?.carbs || '?'}g, Fat ${macros?.fat || '?'}g

IMPORTANT: Respond with ONLY a valid JSON object. No markdown, no code fences, no extra text before or after. 
The JSON must follow this exact structure:
{
  "totalCalories": 1800,
  "notes": "Brief note about the plan",
  "meals": [
    {
      "meal": "Breakfast",
      "calories": 400,
      "protein": 20,
      "carbs": 50,
      "fat": 10,
      "items": ["Oats with banana - 1 cup", "Low fat milk - 200ml", "Almonds - 10 pieces"]
    },
    {
      "meal": "Lunch",
      "calories": 600,
      "protein": 35,
      "carbs": 70,
      "fat": 15,
      "items": ["Brown rice - 1 cup", "Dal - 1 bowl", "Mixed vegetable curry - 1 bowl", "Curd - 100g"]
    },
    {
      "meal": "Dinner",
      "calories": 500,
      "protein": 30,
      "carbs": 55,
      "fat": 12,
      "items": ["Roti - 2 pieces", "Paneer sabzi - 150g", "Green salad - 1 bowl"]
    }
  ],
  "snacks": [
    {
      "calories": 150,
      "items": ["Apple - 1 medium", "Peanut butter - 1 tbsp"]
    },
    {
      "calories": 150,
      "items": ["Greek yogurt - 100g", "Mixed seeds - 1 tbsp"]
    }
  ]
}`;

  const MODELS_TO_TRY = [
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-pro',
  ];

  let lastError = null;

  for (const model of MODELS_TO_TRY) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    let geminiRes;
    try {
      geminiRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 2000,
          },
        }),
      });
    } catch (err) {
      lastError = `Network error with ${model}: ${err.message}`;
      continue;
    }

    const rawText = await geminiRes.text();

    if (!geminiRes.ok) {
      lastError = `${model} HTTP ${geminiRes.status}: ${rawText}`;
      console.error(lastError);
      continue;
    }

    let geminiData;
    try { geminiData = JSON.parse(rawText); } catch {
      lastError = `Non-JSON from Gemini API for model ${model}`;
      continue;
    }

    let aiText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!aiText) {
      lastError = `Empty text from ${model}`;
      continue;
    }

    // ── Strip markdown code fences if Gemini wrapped the JSON ──────────────
    // e.g. ```json { ... } ``` or ``` { ... } ```
    aiText = aiText.trim();
    aiText = aiText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

    // Parse the diet plan JSON
    let plan;
    try {
      plan = JSON.parse(aiText);
    } catch (parseErr) {
      lastError = `JSON parse failed for ${model}. Raw AI text: ${aiText.substring(0, 300)}`;
      console.error(lastError);
      continue;
    }

    // Basic validation
    if (!plan.meals || !Array.isArray(plan.meals)) {
      lastError = `Invalid plan structure from ${model}: missing meals array`;
      continue;
    }

    // Ensure totalCalories is a number (not undefined)
    if (!plan.totalCalories) {
      plan.totalCalories = plan.meals.reduce((sum, m) => sum + (m.calories || 0), 0) +
        (plan.snacks || []).reduce((sum, s) => sum + (s.calories || 0), 0);
    }

    console.log(`Diet plan generated with model: ${model}`);
    return res.status(200).json({ plan });
  }

  console.error('All diet models failed:', lastError);
  return res.status(502).json({
    error: 'Failed to generate diet plan. Check Vercel logs.',
    details: lastError,
  });
}
