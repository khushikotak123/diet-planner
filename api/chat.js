/* Vercel Serverless Function: Conversational Diet Coach via Gemini */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { message, history, profile } = req.body;
    if (!message) return res.status(400).json({ error: 'No message provided' });

    const API_URL =
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' +
      process.env.GEMINI_API_KEY;

    const profileContext = profile
      ? `User profile: Age ${profile.age}, Gender ${profile.gender}, Height ${profile.height}cm, Weight ${profile.weight}kg, Goal: ${profile.goal}, Activity: ${profile.activityLevel}, Diet: ${profile.dietType}.`
      : 'No user profile available.';

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

    /* Build conversation history for context */
    const conversationParts = [];
    conversationParts.push({ text: systemPrompt });

    if (history && history.length > 0) {
      /* Include last 10 messages for context */
      const recent = history.slice(-10);
      recent.forEach(msg => {
        conversationParts.push({ text: `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}` });
      });
    }

    conversationParts.push({ text: `User: ${message}` });

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: conversationParts }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        }
      }),
    });

    const data = await response.json();
    let reply = 'Sorry, I could not generate a response. Please try again.';
    if (data.candidates?.length > 0) {
      reply = data.candidates[0].content?.parts?.[0]?.text || reply;
    }

    res.json({ reply });
  } catch (err) {
    console.error('Chat API error:', err);
    res.status(500).json({ error: err.message });
  }
}
