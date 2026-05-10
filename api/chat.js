// api/chat.js — Vercel Serverless Function (FIXED)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not set in Vercel environment variables' });
  }

  const { message, history = [], profile } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  let systemInstruction =
    'You are Health+, a friendly AI diet coach. Provide personalized nutrition advice, ' +
    'meal planning, recipe suggestions, calorie guidance, and healthy eating tips. ' +
    'Keep responses concise, practical and encouraging.';

  if (profile && profile.age) {
    systemInstruction += ` User profile: age ${profile.age}, weight ${profile.weight || '?'}kg, ` +
      `height ${profile.height || '?'}cm, goal: ${profile.goal || 'general health'}.`;
  }

  const contents = [];
  const recentHistory = Array.isArray(history) ? history.slice(-10) : [];
  for (const turn of recentHistory) {
    if (!turn.content) continue;
    contents.push({
      role: turn.role === 'user' ? 'user' : 'model',
      parts: [{ text: turn.content }],
    });
  }
  contents.push({ role: 'user', parts: [{ text: message }] });

  const MODELS_TO_TRY = [
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-pro',
  ];

  const requestBody = JSON.stringify({
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents,
    generationConfig: { temperature: 0.7, maxOutputTokens: 800 },
  });

  let lastError = null;

  for (const model of MODELS_TO_TRY) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    let geminiRes;
    try {
      geminiRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
      });
    } catch (networkErr) {
      lastError = `Network error: ${networkErr.message}`;
      continue;
    }

    const responseText = await geminiRes.text();
    if (!geminiRes.ok) {
      lastError = `Model ${model} failed (HTTP ${geminiRes.status}): ${responseText}`;
      console.error(lastError);
      continue;
    }

    let data;
    try { data = JSON.parse(responseText); } catch {
      lastError = `Non-JSON response from ${model}`;
      continue;
    }

    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!reply) {
      lastError = `Empty reply from ${model}: ${responseText}`;
      continue;
    }

    return res.status(200).json({ reply });
  }

  console.error('All models failed:', lastError);
  return res.status(502).json({ error: 'AI service unavailable. Check Vercel logs.', details: lastError });
}
