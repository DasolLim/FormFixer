# FormFixer (v0)

Simple, clean project foundation for a fitness form-fixer web app.

## Stack
- Next.js + React + TypeScript
- Supabase (client utility setup)
- MediaPipe-ready camera page shell (no pose detection yet)

## 1) Install
```bash
npm install
```

## 2) Create your single `.env` file
Create `.env` in project root with:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## 3) Run
```bash
npm run dev
```
Open: `http://localhost:3000`

## Routes (v0)
- `/` Home
- `/camera` Camera placeholder
- `/dashboard` Dashboard placeholder
- `/pricing` Free vs Pro placeholder UI (no payment flow)
- `/login` Login/Signup placeholder

## Supabase utility
File: `src/lib/supabaseClient.ts`

Simple connection-test pattern:
```ts
const { data, error } = await testSupabaseConnection({ table: 'profiles' });
console.log({ data, error });
```

## iPhone Safari testing from Windows (HTTPS)
Camera access on iPhone needs HTTPS. Use a tunnel.

### ngrok
```bash
npm run dev -- --hostname 0.0.0.0 --port 3000
ngrok http 3000
```
Open the generated `https://...` URL on iPhone Safari.

### Cloudflare Tunnel
```bash
npm run dev -- --hostname 0.0.0.0 --port 3000
cloudflared tunnel --url http://localhost:3000
```
Open the generated `https://...` URL on iPhone Safari.

## Deferred to v1
- Real MediaPipe pose detection + feedback logic
- Supabase Auth + DB schema
- Payment integration (Stripe or alternative)
- Food photo nutrition analysis
