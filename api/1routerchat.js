export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key tidak ditemukan di environment' });

  try {
    const { messages, system } = req.body;

    const hasImage = messages.some(m => Array.isArray(m.content));

    // openrouter/free = router resmi OpenRouter yang otomatis pilih model gratis
    // yang tersedia, tidak perlu update slug manual jika model berubah
    const model = 'openrouter/free';

    const orMessages = [
      { role: 'system', content: system || 'Kamu adalah NatMind, asisten AI yang cerdas dan membantu.' },
      ...messages.map(m => {
        if (Array.isArray(m.content)) {
          const parts = m.content.map(c => {
            if (c.type === 'text') return { type: 'text', text: c.text };
            if (c.type === 'image') return {
              type: 'image_url',
              image_url: { url: `data:${c.source.media_type};base64,${c.source.data}` }
            };
            return null;
          }).filter(Boolean);
          return { role: m.role, content: parts };
        }
        return { role: m.role, content: m.content };
      })
    ];

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://natmind.vercel.app',
        'X-Title': 'NatMind AI'
      },
      body: JSON.stringify({
        model,
        messages: orMessages,
        max_tokens: 1024,
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error?.message || 'OpenRouter error' });
    }

    const text = data?.choices?.[0]?.message?.content || 'Tidak ada respons';
    return res.status(200).json({ content: [{ text }] });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
