// api/parse-timetable.js
// Kronos — Gemini Vision proxy for timetable screenshot import
// Free tier: 1500 requests/day on Gemini Flash
// Required env var: GEMINI_API_KEY (set in Vercel dashboard)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')    { res.status(405).json({ error: 'Method not allowed' }); return; }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) { res.status(500).json({ error: 'GEMINI_API_KEY not set in environment variables' }); return; }

  const { image, mediaType } = req.body;
  if (!image) { res.status(400).json({ error: 'No image provided' }); return; }

  const prompt = `You are parsing a Schoolbox weekly timetable screenshot for a student at an IB school.

SCHOOL-SPECIFIC FORMAT:
Each calendar block contains text like:
  "Day 4, Period 1, Computer Science HL (12 CSHL FAr[D]), DG69"
  "Day 3, Period 3, Study Time (12-Tue1-3-ST ST SL2), Mark Bishop Lounge"
  "Day 2, HR, Homeroom 1 (12D HR MHi)"
  "7:40am - 7:50am Day 2, Registration, Homeroom 1 (12D HR MHi)"

PARSING RULES:
1. DAY MAPPING (this school's week starts on Sunday as Day 1):
   Day 2 = Mon, Day 3 = Tue, Day 4 = Wed, Day 5 = Thu, Day 6 = Fri

2. PERIOD NAME: Extract the text between the period marker and the opening parenthesis.
   "Day 4, Period 1, Computer Science HL (12 CSHL FAr[D]), DG69" -> "Computer Science HL"
   "Day 2, HR, Homeroom 1 (12D HR MHi)" -> "Homeroom 1"

3. PERIOD NUMBER: The number after "Period". HR/Homeroom = use 0. Registration = skip entirely.

4. ROOM: The last token after the final comma, OUTSIDE the parentheses.
   "(12 CSHL FAr[D]), DG69" -> room is "DG69"
   "(12D HR MHi)" -> no room (nothing after closing paren)
   "(12-Tue1-3-ST ST SL2), Mark Bishop Lounge" -> room is "Mark Bishop Lounge"
   If room looks like a building code (e.g. DG69, CF59, BS13, EF101): keep as-is.
   If room is a named place (e.g. "Design Lab", "Mark Bishop Lounge"): keep as-is.

5. TYPE:
   - "break" if name contains: Break, Lunch, Registration
   - "study" if name contains: Study, Study Time
   - "class" for everything else (including Homeroom, TOK, Islamic B, French, etc.)

6. SKIP: Any block that says "Registration" - do not include it in the output.

7. TIMES: Read the bold time range shown at the top of each block (e.g. "7:50am - 9:10am").
   Convert to 24h HH:MM format: 7:50am -> 07:50, 1:55pm -> 13:55, 12:10pm -> 12:10
   If no time visible for a block, use "".

8. IGNORE everything inside parentheses () - that is just grade/teacher/block info.

Return ONLY a valid JSON array, no markdown, no explanation, no extra text:
[
  {"day":"Mon","num":1,"name":"Business Management HL","start":"07:50","end":"09:10","type":"class","room":"CF59"},
  {"day":"Mon","num":2,"name":"Design Technology HL","start":"09:10","end":"10:30","type":"class","room":"Design Lab"},
  {"day":"Tue","num":3,"name":"Study Time","start":"10:50","end":"12:10","type":"study","room":"Mark Bishop Lounge"},
  {"day":"Mon","num":0,"name":"Homeroom 1","start":"12:10","end":"13:00","type":"class","room":""}
]

Extract ALL periods from ALL visible days. Do not skip any non-Registration blocks.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: mediaType || 'image/png', data: image } },
              { text: prompt }
            ]
          }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 8192,
          }
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini error:', response.status, errText);
      res.status(500).json({ error: `Gemini API error ${response.status}: ${errText}` });
      return;
    }

    const data = await response.json();

    if (data.promptFeedback?.blockReason) {
      res.status(500).json({ error: `Request blocked: ${data.promptFeedback.blockReason}` });
      return;
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!text) {
      console.error('Empty Gemini response:', JSON.stringify(data));
      res.status(500).json({ error: 'Gemini returned an empty response' });
      return;
    }

    // Strip markdown fences if the model wraps output in them anyway
    const clean = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    let periods;
    try {
      periods = JSON.parse(clean);
    } catch (parseErr) {
      console.error('JSON parse failed. Raw Gemini output:', clean.slice(0, 500));
      res.status(500).json({
        error: 'Could not parse Gemini response as JSON',
        raw: clean.slice(0, 300)
      });
      return;
    }

    if (!Array.isArray(periods)) {
      res.status(500).json({ error: 'Expected a JSON array from Gemini', raw: clean.slice(0, 300) });
      return;
    }

    // Sanitise all fields so the frontend always gets clean, consistent data
    const VALID_DAYS  = new Set(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
    const VALID_TYPES = new Set(['class', 'break', 'study']);

    periods = periods
      .filter(p => p?.name && !p.name.toLowerCase().includes('registration'))
      .filter(p => VALID_DAYS.has(p.day))
      .map(p => ({
        day:   p.day,
        num:   String(p.num ?? ''),   // coerce to string — frontend uses p.num || ''
        name:  String(p.name).trim(),
        start: String(p.start ?? '').trim(),
        end:   String(p.end   ?? '').trim(),
        type:  VALID_TYPES.has(p.type) ? p.type : 'class',
        room:  String(p.room  ?? '').trim(),
      }));

    res.status(200).json({ periods });

  } catch (err) {
    console.error('Handler error:', err);
    res.status(500).json({ error: err.message });
  }
}
