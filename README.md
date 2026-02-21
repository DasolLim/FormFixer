# FormFixer (v2 Productization)

## What is included
- Supabase Auth (signup/login/logout)
- Protected Dashboard and Profile pages
- Saved workout sessions (`workout_sessions`)
- Free vs Pro feature gating
- Multi-exercise tracking: squat, push-up, lunge (lunge = Pro gated)
- MediaPipe Pose tracking in browser with canvas overlay

> Note: Payment/Stripe integration is intentionally skipped in this version per current project instruction.

## 1) Install
```bash
npm install
```

## 2) Create `.env`
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## 3) Apply database schema
Run SQL from:
- `supabase/schema.sql`

This creates:
- `profiles`
- `workout_sessions`
- `subscriptions`
- RLS policies
- signup trigger for profile/subscription defaults

## 4) Run app
```bash
npm run dev
```

## Core routes
- `/` home
- `/login` signup/login
- `/camera` live form fixer + save session
- `/dashboard` protected history list
- `/profile` protected account + plan info
- `/pricing` free vs pro UI (no payment flow)

## How free vs pro gating works
- Free: squat + push-up
- Pro: lunge
- Plan is read from `subscriptions` table.

To manually upgrade a user in Supabase SQL editor:
```sql
update public.subscriptions
set plan_tier = 'pro', status = 'active', updated_at = now()
where user_id = 'YOUR_USER_UUID';
```

## iPhone Safari testing (Windows)
Use HTTPS tunnel:
```bash
npm run dev -- --hostname 0.0.0.0 --port 3000
ngrok http 3000
```
or
```bash
cloudflared tunnel --url http://localhost:3000
```

## What is deferred to v3
- Real subscription billing and webhooks
- Advanced personalized coaching plans
- Calendar/program builder
- Nutrition and food-photo tracking
