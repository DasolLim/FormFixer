# FormFixer (v1 MVP - Squat)

Simple MVP for real-time squat form fixing in the browser.

## Why you saw this runtime error
If you got `Module not found: Can't resolve '@mediapipe/tasks-vision'`, the camera page was trying to import a package not installed locally.

This code now loads MediaPipe directly from CDN at runtime, so your app can run without installing `@mediapipe/tasks-vision` locally.

## What works in v1
- Live camera preview
- Real-time MediaPipe Pose Landmarker (single person)
- Canvas skeleton + points overlay
- Squat rep counter (phase-based)
- Live form cues:
  - Go lower
  - Chest up
  - Push knees out
- Basic smoothing + cue stability gating to reduce flicker

## Required dependencies to install
```bash
npm install next react react-dom
npm install -D typescript @types/node @types/react @types/react-dom eslint eslint-config-next
```

If your project already has these, use:
```bash
npm install
```

## Good dependency updates (safe)
```bash
npm outdated
npm update
```
Then verify:
```bash
npm run lint
npm run typecheck
```

## Setup
1. Create `.env` in project root:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```
2. Start app:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:3000` then go to `/camera`.

## What you need to do with your current code
1. Pull latest changes.
2. Delete old lockfile + node_modules (optional but recommended if dependency state is broken):
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```
   Windows PowerShell:
   ```powershell
   Remove-Item -Recurse -Force node_modules, package-lock.json
   npm install
   ```
3. Run:
   ```bash
   npm run dev
   ```
4. Open `/camera`, click Start Camera, allow permission.

## Routes
- `/` home
- `/camera` squat form fixer MVP
- `/dashboard` placeholder
- `/pricing` placeholder UI only
- `/login` placeholder UI only

## iPhone Safari test (Windows + HTTPS tunnel)
Camera APIs on iPhone Safari require HTTPS.

### ngrok option
```bash
npm run dev -- --hostname 0.0.0.0 --port 3000
ngrok http 3000
```

### Cloudflare Tunnel option
```bash
npm run dev -- --hostname 0.0.0.0 --port 3000
cloudflared tunnel --url http://localhost:3000
```

## Tuning points (easy to edit)
All squat thresholds are in `src/lib/pose/constants.ts` (`SQUAT_THRESHOLDS`).

## Deferred to v2
- Multiple exercises
- Session history + saved analytics
- User auth + profiles
- Advanced biomechanics + side-view calibration
- Backend APIs for stored workouts
