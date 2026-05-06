/* Vercel Serverless Function: AI Diet Plan Generation */
export default async function handler(req, res) {
  /* CORS headers */
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      age, gender, height, weight, goal, dietType, allergies,
      activityLevel, targetCalories, macros,
    } = req.body;

    const API_URL =
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' +
      process.env.GEMINI_API_KEY;

    const calorieInstruction = targetCalories
      ? `The daily calorie target is ${targetCalories} kcal (calculated from BMR/TDEE for ${activityLevel || 'moderate'} activity, goal: ${goal}).
Recommended macros: Protein ${macros?.protein || 'N/A'}g, Carbs ${macros?.carbs || 'N/A'}g, Fat ${macros?.fat || 'N/A'}g.
Please design the meal plan to match these targets as closely as possible.`
      : `Please calculate appropriate calories based on the person's stats and goal.`;

    const prompt = `
You are a professional diet planner AI.
Create a daily diet plan for a person with:
Age: ${age}, Gender: ${gender}, Height: ${height}cm, Weight: ${weight}kg,
Goal: ${goal}, Diet Type: ${dietType}, Allergies: ${allergies || 'None'}.

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
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });

    const data = await response.json();
    let dietPlan = {};
    if (data.candidates?.length > 0) {
      const text = data.candidates[0].content?.parts?.[0]?.text || '';
      if (text) {
        const cleaned = text.replace(/```json|```/g, '').trim();
        dietPlan = JSON.parse(cleaned);
      }
    }

    res.json({ plan: dietPlan });
  } catch (err) {
    console.error('Diet API error:', err);
    res.status(500).json({ error: err.message });
  }
}
