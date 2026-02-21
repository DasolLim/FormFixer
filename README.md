# FormFixer (v1 MVP - Squat)

Simple MVP for real-time squat form fixing in the browser.

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

## Stack
- Next.js + React + TypeScript
- MediaPipe Tasks Vision (Web)
- Supabase client utility (kept for later app expansion)

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create `.env` in project root:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```
3. Start app:
   ```bash
   npm run dev
   ```
4. Open `http://localhost:3000` then go to `/camera`.

## Routes
- `/` home
- `/camera` squat form fixer MVP
- `/dashboard` placeholder
- `/pricing` placeholder UI only
- `/login` placeholder UI only

## How to test MVP (desktop)
1. Open `/camera`
2. Click **Start Camera** and allow permission
3. Keep full body in frame
4. Perform controlled squats
5. Verify:
   - skeleton overlay tracks movement
   - rep count increments only on full squat cycle
   - cue text updates with form feedback

## iPhone Safari test (Windows + HTTPS tunnel)
Camera APIs on iPhone Safari require HTTPS.

### ngrok option
```bash
npm run dev -- --hostname 0.0.0.0 --port 3000
ngrok http 3000
```
Open the generated `https://...` URL on iPhone Safari.

### Cloudflare Tunnel option
```bash
npm run dev -- --hostname 0.0.0.0 --port 3000
cloudflared tunnel --url http://localhost:3000
```
Open the generated `https://...` URL on iPhone Safari.

## Tuning points (easy to edit)
All squat rule thresholds are in:
- `src/lib/pose/constants.ts` (`SQUAT_THRESHOLDS`)

Key values:
- `topEnterAngle`, `topLockAngle`, `bottomEnterAngle`, `bottomTargetAngle`
- `torsoLeanMaxDeg`
- `kneeInRatioMin`
- `minVisibility`
- `smoothingAlpha`
- `stableCueFrames`

## Deferred to v2
- Multiple exercises
- Session history + saved analytics
- User auth + profiles
- Advanced biomechanics + side-view calibration
- Backend APIs for stored workouts
