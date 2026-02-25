// Vercel serverless function — proxies screenshot to Claude API
// Keeps your ANTHROPIC_API_KEY secret in Vercel environment variables

export default async function handler(req, res) {
  // Only allow POST from your own domain
  res.setHeader('Access-Control-Allow-Origin', 'https://kronos-ebon.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')    { res.status(405).json({ error: 'Method not allowed' }); return; }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { res.status(500).json({ error: 'API key not configured' }); return; }

  try {
    const { image, mediaType } = req.body;
    if (!image) { res.status(400).json({ error: 'No image provided' }); return; }

    const prompt = `You are parsing a Schoolbox school timetable screenshot.

Each entry looks like: "Day 4, Period 1, Computer Science HL (12 CSHL FAr[D]), DG69"
- Day number maps to: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri
- Extract: day, period number (or 0 for HR/Registration), period name, start time, end time, type, room
- Period name = text between the period marker and the opening parenthesis, trimmed
- Room = last token after final comma outside parentheses (e.g. DG69, Design Lab, Mark Bishop Lounge)
- Ignore everything inside parentheses ()
- type = "break" if name contains Break or Lunch, "study" if contains Study, else "class"
- Times: read directly from screenshot, convert to 24h HH:MM format (7:40am → 07:40, 1:55pm → 13:55)
- If time not visible, use empty string ""

Return ONLY a valid JSON array, no markdown, no explanation:
[{"day":"Mon","num":1,"name":"Computer Science HL","start":"10:20","end":"11:15","type":"class","room":"DG69"}]`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/png', data: image } },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    const data = await response.json();
    if (data.error) { res.status(500).json({ error: data.error.message }); return; }

    const text = data.content?.find(b => b.type === 'text')?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const periods = JSON.parse(clean);

    res.status(200).json({ periods });
  } catch (err) {
    console.error('Parse error:', err);
    res.status(500).json({ error: 'Failed to parse timetable: ' + err.message });
  }
}
