# FormFixer (v0 Foundation)

A clean Next.js + TypeScript starter for a full-stack fitness form fixer app.

## Tech Stack
- Next.js 14 + React + TypeScript
- Supabase (client utility wired)
- Stripe (UI/env placeholders only)
- MediaPipe-ready camera page shell (no pose logic yet)

## Quick Setup
1. Install Node.js 20+.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy env file:
   ```bash
   cp .env.example .env.local
   ```
4. Fill in Supabase/Stripe values in `.env.local`.
5. Run the app:
   ```bash
   npm run dev
   ```
6. Open `http://localhost:3000`.

## Optional Python Requirements
`requirements.txt` includes optional helper tooling for tunnel workflows.
```bash
pip install -r requirements.txt
```

## Available Routes (v0)
- `/` Landing page
- `/camera` Camera + canvas + controls placeholder
- `/dashboard` Dashboard placeholder
- `/pricing` Free vs Pro UI placeholder
- `/login` Login/signup UI placeholder

## Environment Variables
Use `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (placeholder)
- `STRIPE_SECRET_KEY` (placeholder)
- `STRIPE_WEBHOOK_SECRET` (placeholder)

## Supabase Connection Test Pattern
Client is in `src/lib/supabaseClient.ts`.

Example pattern:
```ts
const { data, error } = await supabase.from('profiles').select('*').limit(1);
console.log({ data, error });
```

## iPhone Safari Testing from Windows (HTTPS Tunnel)
Because camera APIs on iPhone need HTTPS, expose your local dev server using a tunnel.

### Option A: ngrok
1. Start app on all interfaces:
   ```bash
   npm run dev -- --hostname 0.0.0.0 --port 3000
   ```
2. In another terminal:
   ```bash
   ngrok http 3000
   ```
3. Open generated `https://...ngrok-free.app` URL on iPhone Safari (same Wi‑Fi or cellular).

### Option B: Cloudflare Tunnel
1. Start app on all interfaces:
   ```bash
   npm run dev -- --hostname 0.0.0.0 --port 3000
   ```
2. Run:
   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```
3. Open the generated `https://...trycloudflare.com` URL on iPhone Safari.

## Intentionally Deferred to v1
- Real MediaPipe Pose Landmarker integration
- Realtime corrective feedback logic and rep counting algorithms
- Supabase auth and database schema
- Stripe checkout + webhook handling
- Food photo recognition + nutrition APIs
