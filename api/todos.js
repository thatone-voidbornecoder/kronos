import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
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
      .from('todos')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ todos: data });
  }

  if (req.method === 'POST') {
    const { action, id, text, due, done } = req.body;

    if (action === 'add') {
      const { data, error } = await supabase
        .from('todos')
        .insert({ user_id: userId, text, due: due || null, done: false })
        .select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ todo: data });
    }

    if (action === 'toggle') {
      const { error } = await supabase
        .from('todos')
        .update({ done })
        .eq('id', id)
        .eq('user_id', userId);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    if (action === 'delete') {
      const { error } = await supabase
        .from('todos')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    if (action === 'clearDone') {
      const { error } = await supabase
        .from('todos')
        .delete()
        .eq('user_id', userId)
        .eq('done', true);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
