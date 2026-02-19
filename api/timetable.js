import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function getUserId(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return null;
  const { data } = await supabase.auth.getUser(token);
  return data?.user?.id || null;
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const userId = await getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorised' });

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('timetables')
      .select('*')
      .eq('user_id', userId);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ timetables: data });
  }

  if (req.method === 'POST') {
    const { day, periods } = req.body;
    if (!day || !periods) return res.status(400).json({ error: 'Missing day or periods' });

    // Upsert - replace the whole day's data
    const { error } = await supabase
      .from('timetables')
      .upsert({ user_id: userId, day, periods: JSON.stringify(periods) }, { onConflict: 'user_id,day' });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
