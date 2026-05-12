// api/diet.js — Groq Version

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    return res.status(500).json({ error: 'GROQ_API_KEY is not set in Vercel environment variables' });
  }

  const { age, gender, height, weight, activityLevel, goal, dietType, allergies, targetCalories, macros } = req.body;

  if (!age || !gender || !height || !weight || !goal || !dietType) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

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
    }
  ]
}`;

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are a professional nutritionist. Always respond with valid JSON only. No markdown, no explanation, no code fences.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.4,
        max_tokens: 2000,
      }),
    });

    const data = await groqRes.json();

    if (!groqRes.ok) {
      console.error('Groq error:', data);
      return res.status(502).json({ error: 'Groq API error', details: data?.error?.message });
    }

    let aiText = data?.choices?.[0]?.message?.content;
    if (!aiText) {
      return res.status(502).json({ error: 'No response from Groq' });
    }

    // Strip markdown fences just in case
    aiText = aiText.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

    let plan;
    try {
      plan = JSON.parse(aiText);
    } catch (e) {
      console.error('JSON parse failed:', aiText.substring(0, 300));
      return res.status(502).json({ error: 'Failed to parse diet plan response' });
    }

    if (!plan.meals || !Array.isArray(plan.meals)) {
      return res.status(502).json({ error: 'Invalid diet plan structure' });
    }

    // Calculate totalCalories if missing
    if (!plan.totalCalories) {
      plan.totalCalories =
        plan.meals.reduce((sum, m) => sum + (m.calories || 0), 0) +
        (plan.snacks || []).reduce((sum, s) => sum + (s.calories || 0), 0);
    }

    return res.status(200).json({ plan });

  } catch (err) {
    console.error('Network error:', err);
    return res.status(502).json({ error: 'Failed to reach Groq API' });
  }
}
