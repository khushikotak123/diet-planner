// api/chat.js — Groq Version

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

  const { message, history = [], profile } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  let systemPrompt =
    'You are Health+, a friendly and knowledgeable AI diet coach. ' +
    'Provide personalized nutrition advice, meal planning, recipe suggestions, ' +
    'calorie guidance, and healthy eating tips. Keep responses concise, ' +
    'practical and encouraging.';

  if (profile && profile.age) {
    systemPrompt += ` User profile: age ${profile.age}, weight ${profile.weight || '?'}kg, ` +
      `height ${profile.height || '?'}cm, goal: ${profile.goal || 'general health'}.`;
  }

  // Build messages array for Groq (OpenAI-compatible format)
  const messages = [{ role: 'system', content: systemPrompt }];

  const recentHistory = Array.isArray(history) ? history.slice(-10) : [];
  for (const turn of recentHistory) {
    if (!turn.content) continue;
    messages.push({
      role: turn.role === 'user' ? 'user' : 'assistant',
      content: turn.content,
    });
  }
  messages.push({ role: 'user', content: message });

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    const data = await groqRes.json();

    if (!groqRes.ok) {
      console.error('Groq error:', data);
      return res.status(502).json({ error: 'Groq API error', details: data?.error?.message });
    }

    const reply = data?.choices?.[0]?.message?.content;
    if (!reply) {
      return res.status(502).json({ error: 'No reply from Groq' });
    }

    return res.status(200).json({ reply });

  } catch (err) {
    console.error('Network error:', err);
    return res.status(502).json({ error: 'Failed to reach Groq API' });
  }
}
