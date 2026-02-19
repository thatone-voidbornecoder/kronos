import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, email, password, name } = req.body;

  if (action === 'signup') {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: name || email.split('@')[0] }
    });
    if (error) return res.status(400).json({ error: error.message });

    // Create empty profile row
    await supabase.from('profiles').insert({ id: data.user.id, name: name || email.split('@')[0] });

    return res.status(200).json({ user: data.user });
  }

  if (action === 'login') {
    // We use Supabase client-side auth for login - just validate here
    const { data, error } = await supabase.auth.admin.getUserById
      ? null : null;
    // Login is handled client-side with anon key - this endpoint is for signup only
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'Unknown action' });
}
