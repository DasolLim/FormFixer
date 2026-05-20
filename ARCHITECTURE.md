# FormFixer — Architecture

## Overview

FormFixer is a real-time AI fitness coaching web app built with **Next.js 14 (App Router)**, **React 18**, and **TypeScript**. It uses **MediaPipe Tasks Vision** for in-browser pose detection and **Supabase** for authentication, database, and row-level security. No native mobile app; the camera pipeline runs entirely in the browser. The app is installable as a **PWA** with a service worker and web app manifest.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| UI | React 18, TypeScript, CSS custom properties |
| Pose Detection | MediaPipe Tasks Vision (CDN, dynamic import) |
| Backend / Auth | Supabase (PostgreSQL + Auth + RLS) |
| Nutrition Data | USDA FoodData Central API (server-side proxy) |
| AI Generation | OpenRouter API (program + schedule generation) |
| Styling | Global CSS (`src/styles/globals.css`), CSS variables, theme system |
| PWA | `public/manifest.json`, `public/sw.js` service worker |

---

## Directory Structure

```
src/
├── app/                         # Next.js App Router pages and API routes
│   ├── (marketing)/             # Public landing page (route group, no auth)
│   ├── achievements/            # Achievement gallery page
│   ├── api/
│   │   ├── programs/generate/   # POST — AI-generated program via OpenRouter
│   │   ├── schedule/generate/   # POST — AI-generated calendar schedule
│   │   └── usda/
│   │       ├── search/          # GET /api/usda/search?q=
│   │       └── food/[fdcId]/    # GET /api/usda/food/:fdcId
│   ├── calendar/                # Workout event scheduling
│   ├── camera/                  # Live workout session (pose + form engine)
│   ├── dashboard/               # Analytics overview (RSC + DashboardClient)
│   ├── login/                   # Auth page
│   ├── notifications/           # Social notifications (legacy; content now in /profile)
│   ├── nutrition/               # Meal logging (RSC + NutritionClient)
│   ├── onboarding/
│   │   ├── equipment/           # Equipment profile setup
│   │   └── movement-screen/     # Initial movement baseline assessment
│   ├── pricing/                 # Plan/pricing page
│   ├── profile/                 # User hub (Account + Social + Alerts tabs)
│   ├── programs/                # Program catalog + [slug] detail + generate
│   ├── social/                  # Legacy social page (functionality now in /profile)
│   └── workout/                 # Thin alias re-export of camera page
│
├── components/                  # Shared, reusable UI components
│   ├── auth/                    # AuthGate — guards client-rendered authenticated routes
│   ├── layout/
│   │   ├── Navbar.tsx           # Top header + mobile bottom nav; profile avatar; theme toggle
│   │   ├── Section.tsx
│   │   └── ServiceWorkerRegistrar.tsx  # Registers /sw.js on mount
│   ├── social/
│   │   ├── FriendCard.tsx
│   │   ├── FriendRequestCard.tsx
│   │   ├── NotificationItem.tsx # Gym invite Accept/Decline; workout alert display
│   │   └── SendInviteCard.tsx   # Date + exercise picker for gym invites
│   └── ui/
│       ├── AchievementBadge.tsx
│       ├── AvatarMuscleMap.tsx  # Fitness avatar SVG with muscle-group heat overlay
│       ├── Button.tsx
│       ├── Card.tsx
│       ├── ExerciseInfoCard.tsx
│       ├── FrequencyChart.tsx   # Weekly workout frequency bar chart
│       ├── MuscleHeatmap.tsx    # SVG silhouette + intensity bars
│       ├── PRBadge.tsx          # Personal record flash badge
│       ├── SessionSidePanel.tsx # Slide-in panel for active session details
│       ├── SessionSummaryPanel.tsx  # Post-session summary with animated score
│       ├── StreakBadge.tsx
│       ├── Tabs.tsx             # Underline tab bar primitive (value/onChange API)
│       ├── TodayCard.tsx        # Today's scheduled workout card (dashboard)
│       └── WorkoutConfigPanel.tsx
│
├── features/                    # Domain logic, isolated from UI and data access
│   ├── form-engine/
│   │   ├── form-engine.ts           # ExerciseFormEngine interface + EngineOutput type
│   │   ├── engine-factory.ts        # getEngine(exerciseId) dispatcher; EXERCISE_IDS list
│   │   ├── exercise-config.ts       # ExerciseConfig / ExerciseLandmarks interfaces
│   │   ├── exercises.json           # Data-driven config for all 10 exercises
│   │   ├── calibration-gate.ts      # Pre-exercise pose validation
│   │   ├── feedback-prioritizer.ts  # Cooldown-aware cue ranking; auto-inserts symmetry_drift
│   │   ├── rep-counter-state-machine.ts  # Phase FSM with EMA smoothing
│   │   ├── rep-scorer.ts            # Per-rep composite score (depth/symmetry/form/tempo)
│   │   ├── scoring-types.ts         # RepScore interface
│   │   ├── engines/
│   │   │   ├── squat-engine.ts
│   │   │   ├── push-up-engine.ts
│   │   │   ├── bicep-curl-engine.ts
│   │   │   ├── sit-up-engine.ts
│   │   │   ├── lateral-raise-engine.ts
│   │   │   ├── overhead-press-engine.ts
│   │   │   ├── crunch-engine.ts
│   │   │   ├── pull-up-engine.ts
│   │   │   ├── leg-raise-engine.ts
│   │   │   └── knee-raise-engine.ts
│   │   └── rules/                   # Stateless analysis functions
│   │       ├── angle.ts
│   │       ├── symmetry.ts
│   │       └── tempo.ts
│   ├── pose/
│   │   ├── pose-types.ts            # PoseLandmark, NormalizedPoseFrame, POSE_LANDMARKS
│   │   ├── pose-landmarker-adapter.ts
│   │   ├── landmark-normalization.ts
│   │   ├── confidence-gating.ts
│   │   └── use-speech-cue.ts        # useSpeechCue hook — debounced TTS with mute support
│   └── workout/
│       ├── workout-session-store.ts
│       └── workout-plan-store.ts
│
├── lib/                         # Supabase data access and shared utilities
│   ├── supabaseClient.ts        # Singleton lazy-loaded browser client
│   ├── supabaseServer.ts        # Server-only client (uses next/headers)
│   ├── database.types.ts        # Auto-generated Supabase TypeScript types
│   ├── calendar/
│   │   ├── sessions.ts
│   │   └── server.ts
│   ├── nutrition/
│   │   ├── sessions.ts
│   │   ├── server.ts
│   │   └── types.ts
│   ├── onboarding/
│   │   ├── sessions.ts
│   │   └── types.ts
│   ├── pose/
│   │   ├── constants.ts
│   │   ├── draw.ts              # Canvas overlay rendering
│   │   └── math.ts
│   ├── profile/
│   │   └── sessions.ts          # saveVoiceSettings (voice_settings JSONB column)
│   ├── programs/
│   │   ├── catalog.ts           # fetchAllPrograms, fetchProgramBySlug (from Supabase)
│   │   ├── program-schema.ts    # Zod/JSON schema for AI-generated programs
│   │   ├── sessions.ts
│   │   └── types.ts
│   ├── social/
│   │   ├── sessions.ts          # All social data access (friends, follows, invites, alerts)
│   │   └── types.ts
│   ├── theme/
│   │   └── useTheme.ts          # Theme cycling hook; persists to localStorage + Supabase
│   └── workouts/
│       ├── sessions.ts          # saveWorkoutSession (triggers PR check + achievement eval)
│       ├── records.ts           # checkAndUpdatePRs — personal record upsert
│       ├── achievements.ts      # evaluateAchievements — rule-based unlock
│       ├── frequency.ts         # fetchWorkoutFrequency — weekly session counts
│       ├── muscle-volume.ts     # fetchMuscleGroupVolume + normalizeMuscleIntensity
│       ├── analysis.ts
│       └── types.ts
│
├── styles/
│   └── globals.css              # CSS custom properties; dark + gym theme overrides; PWA vars
│
public/
├── manifest.json                # PWA manifest (standalone, shortcuts to /camera)
└── sw.js                        # Service worker (cache-first for static/CDN; network-first for pages)
```

---

## Core Systems

### 1. Pose Detection Pipeline

MediaPipe is loaded **at runtime via a dynamic CDN import** (`// @ts-ignore webpackIgnore`) to avoid WASM bundler issues. The pipeline runs in a `requestAnimationFrame` loop inside `src/app/camera/page.tsx`.

```
Camera stream (getUserMedia)
    → MediaPipe PoseLandmarker.detectForVideo(video, timestampMs)
    → adaptPoseLandmarkerResult()          [pose-landmarker-adapter.ts]
    → normalizePoseResult()                [landmark-normalization.ts]
    → NormalizedPoseFrame                  [pose-types.ts]
    → CalibrationGate.update(frame)        [calibration-gate.ts]
    → ExerciseFormEngine.update(frame, cal) [engine-factory → specific engine]
    → drawPoseOverlay(canvas, landmarks)   [lib/pose/draw.ts]
    → React state updates (repCount, cue, score, phase)
```

`NormalizedPoseFrame` is the canonical contract passed downstream. It holds `landmarks[]`, `worldLandmarks[]`, `hasPose`, and `timestampMs`.

---

### 2. Form Engine — Multi-Exercise Architecture

The form engine is data-driven and pluggable. `ExerciseFormEngine` is the interface defined in `form-engine.ts`:

```ts
interface ExerciseFormEngine {
  readonly id: string;
  reset(): void;
  update(frame: NormalizedPoseFrame, calibration: CalibrationStatus): EngineOutput;
}
```

**`engine-factory.ts`** dispatches to the correct engine by `exerciseId` string. Currently ten engines are implemented. Each engine class is a thin wrapper; the actual exercise parameters (landmark indices, angle thresholds, form checks) are all declared in **`exercises.json`** and read at construction time via `getExerciseConfig(exerciseId)`.

#### Exercise config (data-driven)

`exercise-config.ts` defines the `ExerciseConfig` interface. `exercises.json` declares all ten exercises. Each entry contains:

- `landmarks`: MediaPipe landmark indices for the primary joint (left + right)
- `repThresholds`: `downAngle`, `upAngle`, `reversedDirection` (true for curl/pull-up)
- `formChecks`: array of `FormCheckConfig` — phase, severity, rule name, params, cue text
- `isUnilateral`, `cameraAngle`

#### Per-frame data flow (per engine)

```
NormalizedPoseFrame
    ├── evaluateFrameConfidence()   → skip if landmarks occluded
    ├── getLandmark() × joints      → key joint coordinates
    ├── angleDeg()                  → primary joint angle (left + right)
    ├── symmetryDiff tracking       → bilateral drift detection (3+ frames → cue)
    ├── RepCounterStateMachine.update() → phase + rep completion signal
    ├── RepScorer.startRep / completeRep → per-rep composite score
    ├── FormCheck[] evaluation      → active FormIssue[] list
    └── FeedbackPrioritizer.update() → top N feedback cues (cooldown-aware)
                    ↓
               EngineOutput { phase, repCount, topCues, repScores, ... }
```

#### Rep Scoring (`rep-scorer.ts`, `scoring-types.ts`)

After each rep completes, `RepScorer.completeRep()` produces a `RepScore`:

```ts
interface RepScore {
  repNumber: number;
  overall: number;    // 0–100, weighted composite
  depth: number;      // joint angle vs target threshold
  symmetry: number;   // bilateral angle delta
  form: number;       // FormIssue density
  tempo: number;      // descent/ascent duration vs target range
  issueIds: string[];
  timestampMs: number;
}
```

`SessionSummaryPanel` shows per-rep scores and an animated overall average (RAF-based ease-out-cubic counter).

#### Calibration Gate

Runs before the engine each frame. Validates:
1. All critical landmarks meet the visibility threshold.
2. User is standing upright (shoulder above hip, knee angle > 155°).
3. Camera orientation matches `cameraAngle` requirement.
4. Average landmark motion is below `maxMotionPerFrame` for `requiredStableFrames` consecutive frames.

#### Rep Counter State Machine

Phases: `NOT_READY → READY → DESCENDING → BOTTOM → ASCENDING → LOCKOUT → READY`

Uses an exponential moving average (EMA) on the joint angle for noise suppression. A rep is counted on `LOCKOUT → READY`, gated by `minRepCooldownMs`.

#### Feedback Prioritizer

`FeedbackPrioritizer` maintains a cooldown map keyed by cue ID. At construction it auto-inserts a `symmetry_drift` cue definition if not already present. `getTopCues(n)` returns the highest-priority non-cooling cues.

---

### 3. Voice Cues (`use-speech-cue.ts`)

`useSpeechCue(debounceMs)` is a React hook that wraps the Web Speech API:

- `speakCue(text, enabled, options)` — debounced; cancels previous utterance before speaking
- `cancelCue()` — immediately cancels any in-flight speech
- A mute toggle button in the camera HUD calls `speakCue(..., voiceEnabled, ...)` each frame

---

### 4. Analytics & Gamification

All analytics run server-side via RSC in `dashboard/page.tsx` and are passed as props to the client component.

#### Personal Records (`lib/workouts/records.ts`)

`checkAndUpdatePRs(userId, exerciseId, session)` is called automatically after every saved session. It upserts `personal_records` with `best_form_score`, `best_rep_count`, and `best_volume`. Returns a `PRCheckResult` indicating which records were broken. A `PRBadge` is shown on the camera page when a PR fires.

#### Achievements (`lib/workouts/achievements.ts`)

`evaluateAchievements(userId)` runs rule-based checks after each session and unlocks matching rows in `user_achievements`. The achievement catalogue is seeded in the migration (`20240102_phase4_analytics.sql`). The `/achievements` page renders the full gallery with lock/unlock state.

#### Workout Frequency (`lib/workouts/frequency.ts`)

`fetchWorkoutFrequency(userId)` returns `WeeklyFrequency[]` — one entry per week for the past 8 weeks. `FrequencyChart` renders this as a bar chart on the dashboard.

#### Muscle Activity (`lib/workouts/muscle-volume.ts`)

`fetchMuscleGroupVolume(userId)` aggregates volume by muscle group for the past 7 days. `normalizeMuscleIntensity(volumeMap)` scales to 0–1. `MuscleHeatmap` renders a 120px SVG silhouette alongside intensity bars sorted by activation level.

---

### 5. Theme System (`lib/theme/useTheme.ts`)

Three themes: `light`, `dark`, `gym`. Controlled by `data-theme` attribute on `<html>`.

`useTheme(userId?)` hook:

```ts
// Reads localStorage in useEffect (client-only); never runs on the server.
// Applies theme by calling document.documentElement.setAttribute('data-theme', theme).
// Persists to profiles.theme_preference in Supabase when userId is provided.
const { theme, setTheme, cycleTheme } = useTheme(userId);
```

Key implementation details:

- `readStoredTheme()` reads `localStorage` synchronously inside `useEffect` — never during SSR, so there is no hydration mismatch.
- `applyTheme(t)` calls `document.documentElement.setAttribute('data-theme', t)` directly — no double-RAF or transition-suppression wrapper.
- There is **no inline `<script>`** in `layout.tsx` to pre-set the theme — the theme is applied on the first client-side `useEffect`, which may produce a brief flash on initial load for non-default themes.
- `globals.css` defines `[data-theme="dark"]` and `[data-theme="gym"]` overrides.
- The Profile AccountTab contains a 3-segment toggle (Dark / Light / Gym) backed by `useTheme`.

---

### 6. Social Features (`lib/social/sessions.ts`, `lib/social/types.ts`)

The social layer supports two relationship models operating in parallel:

| Model | Tables | Description |
|---|---|---|
| Friend graph | `friend_requests`, `friendships` | Bidirectional; requires acceptance |
| Follow graph | `follows`, `follow_requests` | Directional; private accounts need approval |

Key operations:
- `sendFriendAction` — sends follow or friend request depending on target privacy
- `respondToFriendRequest` — accept/decline with automatic friendship row insertion
- `sendGymInvite(GymInvitePayload)` — creates a `gym_invite` notification with date + exercise
- `acceptGymInvite` — marks accepted, inserts `workout_events` for both users
- `declineGymInvite` — marks declined
- `sendWorkoutAlert(fromUserId, toUserIds[], message)` — bulk inserts `workout_alert` notifications

#### Notification types

```ts
type NotificationType =
  | 'friend_request_received'
  | 'friend_request_accepted'
  | 'gym_invite'
  | 'workout_alert';
```

`NotificationItem` renders each type appropriately; `gym_invite` shows Accept/Decline actions via `useTransition`.

---

### 7. Profile Hub (`app/profile/page.tsx`)

The profile page is a fully client-rendered hub with a 2-column desktop layout:

**Left column** (`.social-col-left`):
- `.profile-header` — large `.avatar-placeholder-lg` initials circle, `.profile-name`, `.profile-handle`, tier badge (`.tag-lime` / `.tag-dark`)
- `.stats-highlight-card` — Friends / Following / Followers counts fetched via `lib/social/sessions.ts`

**Right column** (`.social-col-right`):
- Underline `<Tabs>` bar (Account / Social / Alerts)
- Tab content swapped in-place (no page navigation)

| Tab | Content |
|---|---|
| **Account** | `.form-input` username edit, 3-segment theme toggle (Dark/Light/Gym) via `useTheme(userId)`, expandable Change Password `.list-row`, Privacy `.list-row`, danger-styled Delete Account action |
| **Social** | `.form-input` friend search, pending requests, friends list with inline workout-alert composer |
| **Alerts** | Inline notification rows (not `NotificationItem`) — gym invites with Accept/Decline `.btn btn-secondary`, workout alerts, friend events |

**Rendering notes:**
- Uses a `mounted` guard (`useState(false)` + `setMounted(true)` in `useEffect`) to prevent auth-conditional rendering mismatches during hydration.
- `NotificationItem` component is not used in AlertsTab — notifications are rendered inline to avoid the Card nesting overhead.

---

### 8. Programs

Programs are stored in **Supabase** (`programs` table, `is_public = true`) rather than static data. `fetchAllPrograms()` and `fetchProgramBySlug()` query via `getSupabaseServer()` (RSC-safe).

The **`programs/generate`** page calls `POST /api/programs/generate` which uses OpenRouter (model via `OPENROUTER_MODEL` env var) to produce a JSON program conforming to `GeneratedProgramSchema`. The route validates the AI output, filters exercise IDs against the known list, and saves to Supabase.

`ProgramGrid` (`src/app/programs/ProgramGrid.tsx`) is a fully client-rendered component:

- **Filter pills** — difficulty filter row (`All` / `Beginner` / `Intermediate` / `Advanced`) using `.filter-pill` / `.filter-pill.active` CSS classes
- **`FeaturedProgramCard`** — hero card for the first in-progress or top recommended program; full-width gradient banner with a large Lucide icon, progress bar, and a primary CTA
- **`ProgramCard`** — standard grid card; gradient header, stats row (weeks / days / exercises), equipment badges, progress bar for enrolled programs
- **`AIPlanCard`** — fixed entry at the end of the grid; calls `/api/programs/generate` inline; spinner during generation
- Section grouping: "In Progress" → "All Programs" (filtered per selected pill)

---

### 9. Hydration Safety

React 18 requires the server-rendered HTML to exactly match the client's first render. Several patterns are used throughout the app to prevent mismatches:

| Pattern | Where | Why |
|---|---|---|
| **`mounted` guard** | `Navbar.tsx`, `app/profile/page.tsx` | Auth state is unknown on the server; conditionally renders Sign-In link vs profile avatar. Guard ensures both server and first client render produce the same output (`<a>Sign in</a>`). |
| **`<Suspense>` wrapper** | `app/camera/page.tsx` | `useSearchParams()` requires a Suspense boundary for Next.js 14 static generation. Inner component extracted; default export wraps it in `<Suspense>`. |
| **`suppressHydrationWarning`** | Date/time elements in `NotificationItem`, `AchievementBadge`, `CalendarClient`, `DashboardClient` | `toLocaleDateString(undefined)` and `toLocaleString()` produce different strings in Node.js vs the browser locale. Applied only to the element whose direct text is locale-formatted. |
| **`useState(() => Date.now())`** | `FormScoreChart` in `DashboardClient` | SVG polyline coordinates are computed from `Date.now()`. Without the lazy initializer, the timestamp differs between server render and client hydration. The state initializer captures one value and React reconciles consistently. |

**Rule**: Never call `Date.now()`, `Math.random()`, `localStorage`, `window.*`, or any locale-sensitive formatter in a component's render body outside of a `useEffect` or lazy `useState` initializer.

---

### 10. PWA Support

| File | Purpose |
|---|---|
| `public/manifest.json` | Name, icons, display mode, shortcuts to `/camera` and `/dashboard` |
| `public/sw.js` | Cache-first for `/_next/static/` and MediaPipe CDN; network-first for app pages |
| `src/components/layout/ServiceWorkerRegistrar.tsx` | Registers `/sw.js` in a `useEffect`; rendered in `app/layout.tsx` |

---

### 11. Supabase Integration

Two clients:

| Client | File | Used in |
|---|---|---|
| Browser | `lib/supabaseClient.ts` → `getSupabaseClient()` | Client components, hooks, `lib/*/sessions.ts` |
| Server | `lib/supabaseServer.ts` → `getSupabaseServer()` | RSC pages only — imports `next/headers` |

`getSupabaseClient()` lazily loads `@supabase/supabase-js` (CDN) and caches the singleton. All data access is encapsulated in `lib/*/sessions.ts` files to keep DB concerns out of components and feature modules.

`lib/database.types.ts` is auto-generated via `supabase gen types typescript` and provides typed query results.

---

### 12. AI API Routes

| Route | Purpose |
|---|---|
| `POST /api/programs/generate` | Auth-gated; sends user profile + movement baseline to OpenRouter; validates + saves generated program |
| `POST /api/schedule/generate` | Auth-gated; fills a date range with workout events from an active program |
| `GET /api/usda/search?q=` | Proxies USDA FDC full-text search |
| `GET /api/usda/food/[fdcId]` | Proxies USDA FDC individual food lookup |

All API routes call `getSupabaseServer()` and verify the session before processing.

---

## Database Schema

All tables use RLS. Every user-owned table's `user_id` references `auth.users(id)`.

| Table | Purpose |
|---|---|
| `profiles` | Username, privacy mode, theme preference, voice settings (JSONB), equipment profile |
| `workout_sessions` | Saved sessions — exercise, reps, form score, rep_scores JSONB, duration |
| `personal_records` | Per-user per-exercise best form score, rep count, and volume |
| `achievements` | Achievement catalogue (seeded) — key, name, description, icon, criteria |
| `user_achievements` | Junction: which users have unlocked which achievements |
| `programs` | Training programs (public flag, difficulty, weeks, workout_days JSONB) |
| `user_program_progress` | Per-user current week + completion percent for a program |
| `meal_items` | Nutrition logs — meal type, macros, food name |
| `workout_events` | Calendar: scheduled workout dates, notes |
| `friend_requests` | Pending/accepted/rejected/cancelled friend connections |
| `friendships` | Directed friendship edges |
| `follows` | Instagram-style follow graph |
| `follow_requests` | Follow requests for private accounts |
| `notifications` | In-app notifications: friend requests, gym invites, workout alerts |
| `subscriptions` | Plan tier tracking |
| `body_weight_logs` | Optional weight tracking |

A PostgreSQL trigger `on_auth_user_created` automatically inserts a `profiles` row on signup.

Migrations live in `supabase/migrations/` and are applied in order:
- `20240101_phase1_foundation.sql` — core tables + RLS
- `20240102_phase4_analytics.sql` — `personal_records`, `achievements`, `user_achievements`, `body_weight_logs`
- `20240103_voice_settings.sql` — `profiles.voice_settings` JSONB column

---

## Layering Rules

- **`features/`** — domain logic only. Must not import from `lib/` (data access) or `app/` (UI).
- **`lib/`** — Supabase data access and shared utilities. May import `features/` types. Must not import `app/`.
- **`components/`** — pure UI primitives. Must not import from `lib/` or `features/` (pass data as props).
- **`app/`** — integration layer. Wires `features/`, `lib/`, and `components/` together.

> **Client/server import safety**: `getSupabaseServer()` imports `next/headers` and will break client bundles if imported outside RSC. Always use `getSupabaseClient()` in client components and `lib/*/sessions.ts` files.

---

## ESLint Configuration (`.eslintrc.json`)

```json
{
  "extends": ["next/core-web-vitals"],
  "plugins": ["@typescript-eslint"],
  "rules": {
    "@typescript-eslint/no-explicit-any": "warn"
  }
}
```

`@typescript-eslint/eslint-plugin` is installed by Next.js's toolchain but is **not** auto-registered as a plugin — only as a parser. It must be explicitly listed in `plugins[]` for any `@typescript-eslint/*` rule definitions or `eslint-disable` comments to be valid during `next build`.

---

## Environment Variables

| Variable | Required By | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | Supabase anon key |
| `USDA_API_KEY` | Server only | USDA FoodData Central API key |
| `OPENROUTER_API_KEY` | Server only | OpenRouter API key for AI generation |
| `OPENROUTER_MODEL` | Server only | Model ID (e.g. `anthropic/claude-3-5-sonnet`) |
