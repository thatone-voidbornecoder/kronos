# ⬡ KRONOS

Your school day HUD. Built for IB G12 survival.

---

## Stack
- **Frontend** — vanilla HTML/CSS/JS (no framework needed)
- **Backend** — Vercel serverless functions (Node.js)
- **Auth + DB** — Supabase

---

## Setup (do this once)

### 1. Supabase — run the schema
1. Go to your Supabase project → **SQL Editor**
2. Paste the entire contents of `SCHEMA.sql` and hit **Run**
3. That's it — all 4 tables + row-level security are created

### 2. Vercel — deploy from GitHub
1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your `kronos` GitHub repo
3. Leave build settings as default (Vercel auto-detects)
4. Add these **Environment Variables** before deploying:

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | `https://qetwphjdglepejzuafnw.supabase.co` |
| `SUPABASE_SERVICE_KEY` | *(your service role key — see below)* |

> ⚠️ The **service role key** is different from the anon key.  
> Find it in Supabase → Settings → API → **service_role** (keep this secret — it only lives in Vercel, never in the frontend)

5. Hit **Deploy**

### 3. Done
Your app will be live at `https://kronos-[something].vercel.app`

---

## Project structure

```
kronos/
├── public/
│   ├── login.html      ← login & signup page
│   └── app.html        ← main Kronos HUD
├── api/
│   ├── _supabase.js    ← shared DB client
│   ├── auth.js         ← signup helper
│   ├── timetable.js    ← timetable CRUD
│   ├── todos.js        ← todo CRUD
│   └── grades.js       ← grades CRUD
├── SCHEMA.sql          ← run this in Supabase once
├── vercel.json         ← routing config
└── package.json
```

---

## Local dev (optional)

```bash
npm i -g vercel
vercel env pull .env.local   # pulls your env vars from Vercel
vercel dev                   # runs locally on localhost:3000
```
