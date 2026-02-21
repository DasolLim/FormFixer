# FormFixer (v0)

Simple, clean project foundation for a fitness form-fixer web app.

## Stack
- Next.js + React + TypeScript
- Supabase (client utility setup)
- Stripe (pricing UI placeholders only)
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

# Stripe (placeholders for v1 billing work)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
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
- `/pricing` Free vs Pro placeholder
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
- Stripe checkout/webhooks
- Food photo nutrition analysis
