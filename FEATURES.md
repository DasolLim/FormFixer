# FormFixer — Feature Documentation

A reference for developers new to this codebase. Every route, component, engine, API endpoint, and utility is covered. Features are grouped by category.

---

## Table of Contents

1. [Authentication & Authorization](#authentication--authorization)
2. [AI Pose Detection](#ai-pose-detection)
3. [Form Analysis Engine](#form-analysis-engine)
4. [Exercises](#exercises)
5. [Workouts & Session Tracking](#workouts--session-tracking)
6. [Training Programs](#training-programs)
7. [Nutrition](#nutrition)
8. [Calendar](#calendar)
9. [Social](#social)
10. [Notifications](#notifications)
11. [Profile & Settings](#profile--settings)
12. [Pricing / Plan Tiers](#pricing--plan-tiers)
13. [UI Components & Layout](#ui-components--layout)
14. [Database & Backend](#database--backend)
15. [API Endpoints](#api-endpoints)

---

## Authentication & Authorization

### Sign Up / Sign In

Single-page auth flow that toggles between login and registration modes.

Email and password are validated client-side (min 6 chars; confirm-password match on signup). On signup, a profile row is upserted into `profiles` via `supabase.auth.signUp`, then the user is redirected to `/dashboard`. On login, `signInWithPassword` is called and the session is persisted automatically by the Supabase client.

**Key files:** [src/app/login/page.tsx](src/app/login/page.tsx)

**User-facing behavior:** Single form with email + password fields; extra username, confirm-password, and terms checkbox appear in signup mode. A toggle link switches between modes. Errors display inline.

**Dependencies:** Supabase Auth, `getSupabaseClient`

---

### AuthGate

Client-side authentication guard that redirects unauthenticated users.

Wraps protected pages. On mount it calls `supabase.auth.getUser()`; if no session exists it immediately pushes the user to `/login` and shows nothing. While the session is loading it renders a spinner placeholder.

**Key files:** [src/components/auth/AuthGate.tsx](src/components/auth/AuthGate.tsx)

**User-facing behavior:** Transparent when authenticated; instant redirect to `/login` when not. Used on Dashboard, Social, Profile, Notifications, Calendar, and Programs.

**Dependencies:** Supabase Auth, `next/navigation`

---

### Auto Profile Creation Trigger

Ensures every new Supabase auth user gets a `profiles` row automatically.

A Postgres `AFTER INSERT ON auth.users` trigger fires `handle_new_user()`, which inserts a row into `profiles` seeded with `id` and `email`. This means profile data is always present after signup without extra client-side calls.

**Key files:** [supabase/schema.sql](supabase/schema.sql)

**User-facing behavior:** Invisible. Prevents null-profile bugs on first login.

**Dependencies:** Supabase Postgres triggers

---

## AI Pose Detection

### Real-Time Pose Detection

Runs MediaPipe PoseLandmarker in the browser to detect 33 body landmarks at ~30 fps.

The camera page dynamically imports `@mediapipe/tasks-vision` from a CDN, initializes `PoseLandmarker` with the `lite` model in `VIDEO` mode, and drives a `requestAnimationFrame` loop. Each frame calls `poseLandmarker.detectForVideo()`, which returns image-space and world-space landmarks. Image-space landmarks are used for canvas drawing; world-space (metric, hip-centered) are used for all angle math so thresholds are body-size invariant.

**Key files:** [src/app/camera/page.tsx](src/app/camera/page.tsx), [src/features/pose/pose-types.ts](src/features/pose/pose-types.ts), [src/features/pose/landmark-normalization.ts](src/features/pose/landmark-normalization.ts)

**User-facing behavior:** Live video feed with colored skeleton overlay showing joint connections, angle labels, and form-issue highlights in real time.

**Dependencies:** `@mediapipe/tasks-vision` (CDN), browser `getUserMedia`, `requestAnimationFrame`

---

### Pose Overlay / Skeleton Drawing

Renders the detected pose skeleton and angle annotations on a `<canvas>` layered over the video.

`drawPoseOverlay()` iterates `SKELETON_CONNECTIONS` (color-coded segments by body region), draws each joint as a circle, and annotates the primary angle at the active joint point. Form issues can highlight specific landmarks in red. `resizeCanvasToVideo()` keeps canvas dimensions synchronized with the video element.

**Key files:** [src/lib/pose/draw.ts](src/lib/pose/draw.ts), [src/app/workout/PoseOverlay.tsx](src/app/workout/PoseOverlay.tsx)

**User-facing behavior:** Green/yellow/red skeleton over the video; angle number displayed near the active joint.

**Dependencies:** Canvas 2D API, `PoseLandmark` types

---

### Confidence Gating

Filters out low-quality frames before passing them to the form engine.

`evaluateFrameConfidence()` checks that a pose was detected and that all critical landmarks (shoulders, hips, knees, ankles) meet a minimum visibility score. Frames that fail are dropped and the engine receives no update, preventing garbage reps from noisy detections.

**Key files:** [src/features/pose/confidence-gating.ts](src/features/pose/confidence-gating.ts), [src/features/pose/pose-landmarker-adapter.ts](src/features/pose/pose-landmarker-adapter.ts)

**User-facing behavior:** "Stand in frame" prompts persist until enough landmarks are reliably detected.

---

### Calibration Gate

Ensures the user is standing upright, still, and fully visible before a session starts.

`CalibrationGate` accumulates frames and checks: all critical landmarks visible, shoulder Y < hip Y (upright), knee angle > 155° (legs straight), torso lean < 20°, and per-frame motion below a threshold. After 12 consecutive stable frames the gate signals `ready: true`. Orientation can be forced to `'front'` or `'side'`, or auto-detected from shoulder width (narrow → side view).

**Key files:** [src/features/form-engine/calibration-gate.ts](src/features/form-engine/calibration-gate.ts)

**User-facing behavior:** "Stand upright — calibrating (N/12)" badge below the live feed; turns green "Calibrated ✓" when ready. The Start button is disabled until calibrated.

**Dependencies:** `angleDeg` from rules, `getWorldLandmark` helpers

---

### Pose Landmark Normalization

Converts raw MediaPipe output into a consistent internal type used throughout the engine.

`normalizePoseResult()` validates finiteness of all coordinates, clamps image-space values to `[0, 1]`, and packages both coordinate spaces into a `NormalizedPoseFrame`. Downstream code never touches raw MediaPipe objects.

**Key files:** [src/features/pose/landmark-normalization.ts](src/features/pose/landmark-normalization.ts), [src/features/pose/pose-types.ts](src/features/pose/pose-types.ts)

**User-facing behavior:** Invisible; prevents NaN crashes on partial detections.

---

## Form Analysis Engine

### Exercise Form Engine (Core Interface)

Defines the contract every exercise engine must satisfy.

`ExerciseFormEngine` is a TypeScript interface with three members: `id: string`, `reset()`, and `update(frame, calibration) → EngineOutput`. `EngineOutput` carries the current state (phase, rep count), calibration status, primary feedback cue, all active form issues, current angle metrics, and an array of per-rep scores. The interface decouples the camera page from any specific exercise.

**Key files:** [src/features/form-engine/form-engine.ts](src/features/form-engine/form-engine.ts)

**User-facing behavior:** Invisible abstraction; enables the exercise selector to hot-swap engines without restarting the camera.

---

### Engine Factory

Maps exercise IDs to concrete engine instances.

`getEngine(exerciseId)` returns a fresh `ExerciseFormEngine` for any of the 10 supported exercises. `EXERCISE_IDS` is the canonical list used to populate the exercise dropdown on the camera page.

**Key files:** [src/features/form-engine/engine-factory.ts](src/features/form-engine/engine-factory.ts)

**User-facing behavior:** Selecting a different exercise in the dropdown swaps the engine, resets rep count, and resumes detection immediately.

---

### Exercise Config System

Declarative per-exercise configuration loaded from JSON.

`exercises.json` stores each exercise's landmark indices, angle joint, rep threshold angles (down/up), `reversedDirection` flag (for curl/pull-up where the small angle is the "up" position), camera orientation hint, and `isUnilateral` flag. `getExerciseConfig(exerciseId)` parses this at runtime. Generic engines read the config instead of having hardcoded values, so adding a new exercise usually requires only a JSON entry.

**Key files:** [src/features/form-engine/exercise-config.ts](src/features/form-engine/exercise-config.ts), [src/features/form-engine/exercises.json](src/features/form-engine/exercises.json)

**User-facing behavior:** Each exercise has its own angle thresholds and camera setup instruction.

**Dependencies:** `ExerciseConfig` type

---

### Angle Computation Rules

Core math primitives for body-angle and posture checks.

`angleDeg(a, b, c)` computes the angle at joint `b` using world-space landmarks (in meters), which makes thresholds independent of the user's distance from the camera. Additional helpers: `midpoint()`, `verticalLeanDeg()` (torso tilt from vertical), `heelLiftRatio()`, `kneeOutRatio()`. These are consumed by every engine.

**Key files:** [src/features/form-engine/rules/angle.ts](src/features/form-engine/rules/angle.ts), [src/features/form-engine/rules/symmetry.ts](src/features/form-engine/rules/symmetry.ts)

**User-facing behavior:** Invisible math layer; drives the angle readout on screen and all form checks.

---

### Squat Rep-Counter State Machine

Phase-aware rep counter designed specifically for the squat.

Implements a six-phase cycle: `NOT_READY → READY → DESCENDING → BOTTOM → ASCENDING → LOCKOUT → READY`. Each transition has a hysteresis threshold (EMA-smoothed knee angle, configurable alpha 0.35) to prevent jitter. A rep is counted only when the full BOTTOM→ASCENDING→LOCKOUT cycle completes. A 450 ms cooldown prevents double-counts.

**Key files:** [src/features/form-engine/rep-counter-state-machine.ts](src/features/form-engine/rep-counter-state-machine.ts)

**User-facing behavior:** Phase label ("DOWN", "UP", "LOCKOUT") shown in the HUD; rep count increments only on clean full reps.

---

### Generic Rep Counter State Machine

Bilateral and unilateral rep counter for all non-squat exercises.

Uses a two-stage cycle (`READY ↔ UP/DOWN`) with configurable angle thresholds and a `reversedDirection` flag. For unilateral exercises (leg raise, knee raise) it maintains independent left/right counters and stages. For bilateral exercises it averages both sides' angles before thresholding. Minimum cooldown between reps: 500 ms.

**Key files:** [src/features/form-engine/rep-counter-state-machine.ts](src/features/form-engine/rep-counter-state-machine.ts)

**User-facing behavior:** Separate left/right rep counts displayed for unilateral exercises; single count for bilateral.

---

### Rep Scorer

Scores each completed rep across four dimensions and aggregates them into a weighted overall score.

`RepScorer` records every frame during a rep (angle, form issues, phase, timestamp). On `completeRep()` it computes: **Depth** (30%) — how close the primary angle came to the target, with a 2× penalty per degree short; **Symmetry** (25%) — `|leftAngle − rightAngle|`, 3× penalty per degree; **Form** (35%) — errors cost 15 points each, warnings cost 5; **Tempo** (10%) — optimal window is 1000–3500 ms, linearly scaled outside. Overall = weighted sum, clamped to 0–100.

**Key files:** [src/features/form-engine/rep-scorer.ts](src/features/form-engine/rep-scorer.ts), [src/features/form-engine/scoring-types.ts](src/features/form-engine/scoring-types.ts)

**User-facing behavior:** Per-rep scores shown as colored blocks in the Session Summary Panel (green ≥ 80, orange ≥ 60, red < 60). Also drives the score bars for depth, symmetry, and form.

---

### Feedback Prioritizer

Selects and throttles which form cues are shown and spoken each rep.

`FeedbackPrioritizer` holds a map of `CueDef` objects (id, severity, display text, voice text, cooldown in reps). On each call to `getTopCues()` it filters out issues still within their cooldown, sorts remaining by severity (error → warning → info), and returns up to 2 cues. After 3 consecutive clean reps with no issues it injects a "Great form! Keep it up." positive cue. Prevents cue spam.

**Key files:** [src/features/form-engine/feedback-prioritizer.ts](src/features/form-engine/feedback-prioritizer.ts)

**User-facing behavior:** Primary and secondary cue text below the HUD; voice cues spoken via the Web Speech API with a 5-second global debounce on the camera page.

---

### Session Score Computation

Aggregates all rep scores into a single `SessionScore` summary.

`computeSessionScore()` averages each dimension (overall, depth, symmetry, form) across all reps. It then splits reps into first-half / second-half and computes a `formTrend` (`'improving'` / `'declining'` / `'stable'`, ±5 point threshold). The three most-frequent issue IDs become `topIssues`. Returns a `SessionScore` object saved to Supabase alongside the session.

**Key files:** [src/lib/workouts/analysis.ts](src/lib/workouts/analysis.ts), [src/lib/workouts/types.ts](src/lib/workouts/types.ts)

**User-facing behavior:** Score displayed in the Session Summary Panel immediately after saving; also shown on the Dashboard per session.

---

## Exercises

The following exercises are fully supported. Each is backed by a config entry in `exercises.json` and a concrete engine class. Unilateral exercises track left and right sides independently.

| ID | Name | Type | Camera | Key Landmark Angle |
|----|------|------|--------|-------------------|
| `squat` | Squat | Bilateral | Front | Hip–Knee–Ankle |
| `push_up` | Push-Up | Bilateral | Side | Shoulder–Elbow–Wrist |
| `sit_up` | Sit-Up | Bilateral | Side | Shoulder–Hip–Ankle |
| `bicep_curl` | Bicep Curl | Bilateral | Front | Shoulder–Elbow–Wrist (reversed) |
| `lateral_raise` | Lateral Raise | Bilateral | Front | Hip–Shoulder–Elbow |
| `overhead_press` | Overhead Press | Bilateral | Front | Hip–Shoulder–Elbow |
| `leg_raise` | Leg Raise | **Unilateral** | Side | Hip–Knee–Ankle |
| `knee_raise` | Knee Raise | **Unilateral** | Front | Hip–Knee–Ankle |
| `crunch` | Crunch | Bilateral | Side | Shoulder–Hip–Ankle |
| `pull_up` | Pull-Up | Bilateral | Front | Shoulder–Elbow–Wrist (reversed) |

**Key files:** [src/features/form-engine/engines/](src/features/form-engine/engines/), [src/features/form-engine/exercises.json](src/features/form-engine/exercises.json), [src/features/form-engine/engine-factory.ts](src/features/form-engine/engine-factory.ts)

**User-facing behavior:** Exercise dropdown on the camera page lists all 10. Selecting one resets the session, swaps the engine, and shows the appropriate camera orientation hint.

---

### Squat Engine (Specialized)

Full squat-specific engine with multi-phase counting and depth/torso/knee checks.

Extends the generic base with `SquatRepCounterStateMachine` (6-phase cycle, EMA-smoothed angles), and additional form checks: squat depth (vs 95° bottom angle), torso lean (via `verticalLeanDeg`), knee cave (`kneeOutRatio`), and heel lift (`heelLiftRatio`). Each check has a configured `CueDef` entry consumed by `FeedbackPrioritizer`.

**Key files:** [src/features/form-engine/engines/squat-engine.ts](src/features/form-engine/engines/squat-engine.ts)

---

### Generic Exercise Engine (Base)

Shared engine logic reused by all non-squat exercises.

`GenericExerciseEngine` reads its config from `getExerciseConfig()`, instantiates `RepCounterStateMachine` and `RepScorer`, and computes left/right joint angles on every frame using `angleDeg` on world landmarks. It applies EMA smoothing independently per side, drives the state machine, calls `RepScorer.recordFrame()` / `completeRep()`, and assembles `EngineOutput`. Subclasses can override `update()` to add exercise-specific checks.

**Key files:** [src/features/form-engine/engines/generic-exercise-engine.ts](src/features/form-engine/engines/generic-exercise-engine.ts)

---

## Workouts & Session Tracking

### Camera / Form Analysis Page

The main interactive page where users perform exercises under real-time AI guidance.

Manages the full session lifecycle: camera initialization → calibration → live detection loop → rep counting → save. It composes `CalibrationGate`, an `ExerciseFormEngine`, `RepScorer`, voice cues, and canvas drawing. The exercise dropdown calls `getEngine()` and resets state. On save it calls `computeSessionScore()` then `saveWorkoutSession()` and shows `SessionSummaryPanel`.

**Key files:** [src/app/camera/page.tsx](src/app/camera/page.tsx)

**User-facing behavior:** Full-screen camera view with skeleton overlay, HUD (reps / angle / phase), primary + secondary cue banners, save button, and post-save summary modal.

**Dependencies:** MediaPipe (CDN), Supabase Auth, Web Speech API, Canvas 2D

---

### Voice Cues

Speaks feedback cues aloud using the browser's Text-to-Speech API.

`speakCue(voiceText)` calls `window.speechSynthesis.speak()`. A per-cue cooldown map (keyed by cue text, 5-second minimum gap) prevents the same cue from being repeated too frequently. Cue text comes from `FeedbackPrioritizer.getTopCues()` and is distinct from the shorter display text.

**Key files:** [src/app/camera/page.tsx](src/app/camera/page.tsx)

**User-facing behavior:** Audible coaching during exercise ("Go deeper", "Keep your back straight"). Requires browser TTS support; silently degrades if unavailable.

**Dependencies:** `window.speechSynthesis`

---

### Workout Session Saving

Persists a completed session with all rep scores and summary metrics to Supabase.

`saveWorkoutSession(userId, exerciseId, repCount, sessionScore)` inserts a row into `workout_sessions` including `rep_scores` (full array of `RepScore` objects as JSONB), `form_score`, `form_trend`, `top_issues`, and `duration_ms`.

**Key files:** [src/lib/workouts/sessions.ts](src/lib/workouts/sessions.ts)

**User-facing behavior:** Save button on the camera page; success shows the Session Summary Panel.

**Dependencies:** Supabase, `SessionScore` type

---

### Dashboard

Central overview showing aggregate stats, form trend charts, and session history.

Fetches workout sessions, program progress, daily meals, and form history on mount. Renders: a four-stat header (Sessions, Total Reps, Calories Today, Active Program %); an SVG line chart of form scores per exercise over the last 30 days with trend arrows; and a collapsible session list. Each session row expands to show a `RepSparkline` (colored blocks per rep). The `scoreColor()` helper maps scores to green/orange/red.

**Key files:** [src/app/dashboard/page.tsx](src/app/dashboard/page.tsx)

**User-facing behavior:** Stat grid at top, form progress chart below, scrollable session list at the bottom. Sessions expand on click to reveal per-rep detail.

**Dependencies:** Supabase, `fetchWorkoutSessions`, `fetchFormScoreHistory`, `fetchDailyMealItems`, `fetchProgramProgress`

---

### Session Summary Panel

Full-screen modal overlay displayed immediately after saving a workout.

Shows overall form score (large numeric), a trend badge (↑ Improving / ↓ Declining / → Stable), score bars for Depth / Symmetry / Form (each 0–100), a per-rep color grid (numbered blocks), and a "Top Issues" list (issue label + how many reps it affected). Offers "Do Another Set" (resets engine and hides panel) or "Done" (dismisses).

**Key files:** [src/components/ui/SessionSummaryPanel.tsx](src/components/ui/SessionSummaryPanel.tsx)

**User-facing behavior:** Appears automatically after save with a dimmed backdrop. Dismissible by clicking the backdrop or pressing Done.

**Dependencies:** `SessionScore`, `ISSUE_LABELS` map

---

### Form Score History

Tracks per-exercise form scores over time for trend visualization.

`fetchFormScoreHistory(userId, exerciseId?, limitDays)` queries `workout_sessions` ordered by `recorded_at`, grouping results by `exercise_id` into `ExerciseFormHistory` objects. The Dashboard's SVG chart plots one line per exercise; a moving average is used to smooth the curve.

**Key files:** [src/lib/workouts/sessions.ts](src/lib/workouts/sessions.ts), [src/app/dashboard/page.tsx](src/app/dashboard/page.tsx)

**User-facing behavior:** Line chart on the Dashboard; trend arrow (↑↓→) per exercise based on last-vs-first score comparison.

---

## Training Programs

### Program Library

Browse page listing all available coaching programs.

Reads the static `PROGRAMS` catalog and renders a grid of cards — each showing the program title, description, difficulty badge, duration in weeks, and coach name. Each card links to `/programs/[slug]`.

**Key files:** [src/app/programs/page.tsx](src/app/programs/page.tsx), [src/lib/programs/catalog.ts](src/lib/programs/catalog.ts)

**User-facing behavior:** Scrollable grid of program cards. Currently two programs: "Form Fundamentals 4-Week" (Beginner) and "Strength Base 6-Week" (Intermediate).

---

### Program Detail & Enrollment

Detail page for a single program; allows enrollment and workout completion marking.

Fetches the program from `PROGRAMS` by slug and loads the user's current progress row from `user_program_progress`. Renders program overview (difficulty, weeks, coach, daily workout list) and a progress card (current week, workouts completed, completion %). "Start Program" calls `assignProgram()`, creating a progress row. "Mark Workout Complete" calls `markProgramWorkoutComplete()`, incrementing `completed_workouts` and recalculating `completion_percent`.

**Key files:** [src/app/programs/[slug]/page.tsx](src/app/programs/%5Bslug%5D/page.tsx), [src/lib/programs/catalog.ts](src/lib/programs/catalog.ts), [src/lib/programs/sessions.ts](src/lib/programs/sessions.ts)

**User-facing behavior:** Program overview above; progress card with enrollment button below. Returning users see their current progress.

**Dependencies:** Supabase (`user_program_progress` table), AuthGate

---

## Nutrition

### Nutrition Tracking Page

Logs daily meals and displays macro totals using the USDA food database.

Left column: USDA food search input → results list → click to auto-fill macros. Right column: today's meal log. A macro summary bar (Calories, Protein, Carbs, Fats) aggregates all `meal_items` for the current UTC day. The form supports meal type (breakfast / lunch / dinner / snack), food name, serving amount, serving unit, and manually adjusted macro fields.

**Key files:** [src/app/nutrition/page.tsx](src/app/nutrition/page.tsx), [src/lib/nutrition/sessions.ts](src/lib/nutrition/sessions.ts), [src/lib/nutrition/types.ts](src/lib/nutrition/types.ts)

**User-facing behavior:** Search box with live results; clicking a food auto-populates macros scaled to the USDA serving size. Saving appends to the meal log and updates the macro bar.

**Dependencies:** USDA FoodData Central API (via internal proxy routes), Supabase

---

### USDA Food Search API

Server-side proxy that searches the USDA FoodData Central database.

`GET /api/usda/search?q=<query>` calls `https://api.nal.usda.gov/fdc/v1/foods/search` with the server-side `USDA_API_KEY` (never exposed to the client). Returns up to 10 results: `{fdcId, description, brandOwner}`. The API key is read from `process.env.USDA_API_KEY`.

**Key files:** [src/app/api/usda/search/route.ts](src/app/api/usda/search/route.ts)

**User-facing behavior:** Results appear below the search box within ~500 ms.

**Dependencies:** `USDA_API_KEY` environment variable, USDA FDC API

---

### USDA Food Detail API

Server-side proxy that fetches full macro breakdown for a specific food item.

`GET /api/usda/food/[fdcId]` fetches `https://api.nal.usda.gov/fdc/v1/food/<id>`, extracts Energy, Protein, Carbohydrate, and Total lipid (fat) from `foodNutrients`, and returns `{description, servingSize, servingUnit, macrosPer100g}`. The nutrition page scales these values by the user's chosen serving amount.

**Key files:** [src/app/api/usda/food/[fdcId]/route.ts](src/app/api/usda/food/%5BfdcId%5D/route.ts)

**User-facing behavior:** After clicking a food in search results, macro fields are auto-populated.

**Dependencies:** `USDA_API_KEY` environment variable, USDA FDC API

---

### Meal Logging

Persists individual food entries to Supabase.

`addMealItem(payload)` inserts into `meal_items` with `user_id`, `meal_type`, `food_name`, `serving_amount`, `serving_unit`, `calories`, `protein_g`, `carbs_g`, `fats_g`. `fetchDailyMealItems(userId, date)` queries by `created_at::date = date` for the current day's totals.

**Key files:** [src/lib/nutrition/sessions.ts](src/lib/nutrition/sessions.ts)

**User-facing behavior:** Each saved food appears in the meal log list. Daily macro bar updates immediately after save.

**Dependencies:** Supabase (`meal_items` table)

---

## Calendar

### Workout Calendar

Month-view calendar for scheduling and tracking planned workouts.

`buildMonthGrid()` returns a 6-week array of `Date` objects. Events from `workout_events` are indexed by ISO date string. Clicking a day selects it for new event entry. The Add Workout form takes a title and a date; submitting calls `addWorkoutEvent()`. Clicking an existing event calls `toggleWorkoutEventCompletion()` to flip its `is_completed` flag. Prev/Next navigation rebuilds the grid.

**Key files:** [src/app/calendar/page.tsx](src/app/calendar/page.tsx), [src/lib/calendar/sessions.ts](src/lib/calendar/sessions.ts)

**User-facing behavior:** 7-column month grid; completed events show with a green tint and ✅, pending ones appear in accent color. Multiple events per day stack vertically.

**Dependencies:** Supabase (`workout_events` table), AuthGate

---

## Social

### Friend Discovery & Search

Allows users to find other accounts by username and initiate a follow or friend request.

`searchProfilesByUsername(userId, query)` queries `profiles` with a `ILIKE` match on `username`. Results are rendered as cards with Follow / Requested / Following buttons. Button state is derived from `fetchOutgoingPendingRequests()` and `fetchFriends()` loaded on mount. Privacy mode determines behavior: public profile → immediate follow; private profile → sends a pending request.

**Key files:** [src/app/social/page.tsx](src/app/social/page.tsx), [src/lib/social/sessions.ts](src/lib/social/sessions.ts), [src/lib/social/types.ts](src/lib/social/types.ts)

**User-facing behavior:** Search bar on the left; results appear below with action buttons that update optimistically.

**Dependencies:** Supabase (`profiles`, `friend_requests`, `follows`, `follow_requests`), AuthGate

---

### Friend Request System

Bidirectional friend request flow with accept/decline handling.

Pending incoming requests are shown in a dedicated section. `respondToFriendRequest()` sets `status` to `'accepted'` or `'rejected'` and, on acceptance, creates reciprocal rows in `friendships`. `fetchPendingRequests(userId)` queries `friend_requests WHERE receiver_id = userId AND status = 'pending'`, then hydrates requester profiles via `fetchProfilesByIds()`.

**Key files:** [src/app/social/page.tsx](src/app/social/page.tsx), [src/components/social/FriendRequestCard.tsx](src/components/social/FriendRequestCard.tsx), [src/lib/social/sessions.ts](src/lib/social/sessions.ts)

**User-facing behavior:** Pending requests section with Accept / Decline buttons; disappears when none are outstanding.

**Dependencies:** Supabase (`friend_requests`, `friendships` tables)

---

### Follow System

Asymmetric follow model for public profiles; request-gated for private profiles.

Public profiles: `sendFriendAction()` inserts directly into `follows`. Private profiles: inserts a `follow_requests` row with `status = 'pending'`; the target accepts/declines via the friend request UI. `unfollowUser()` deletes the `follows` row. Following/follower counts are stored on the `profiles` row and updated by triggers.

**Key files:** [src/lib/social/sessions.ts](src/lib/social/sessions.ts), [src/lib/social/types.ts](src/lib/social/types.ts)

**User-facing behavior:** Follow button on search result cards; switches to "Following" on success. Profile page shows follower/following counts.

**Dependencies:** Supabase (`follows`, `follow_requests`, `profiles` tables)

---

### Friends List

Displays the current user's confirmed friends with action options.

`fetchFriends(userId)` queries `friendships WHERE user_id = userId`, then hydrates the friend profiles. Each friend is rendered as a `FriendCard`. Selecting a friend enables the Gym Invite panel.

**Key files:** [src/app/social/page.tsx](src/app/social/page.tsx), [src/components/social/FriendCard.tsx](src/components/social/FriendCard.tsx)

**User-facing behavior:** Right column of the Social page; friend cards appear once requests are accepted.

---

### Gym Invites

Sends a notification to a friend inviting them to work out.

Selecting a friend from the Friends List enables a "Send Gym Invite" card. `sendGymInvite(actorId, targetId)` inserts a row into `notifications` with `type = 'gym_invite'`. The recipient sees the invite in their Notifications page.

**Key files:** [src/app/social/page.tsx](src/app/social/page.tsx), [src/lib/social/sessions.ts](src/lib/social/sessions.ts)

**User-facing behavior:** "Send Invite" button activates when a friend is selected; shows a success message on send.

**Dependencies:** Supabase (`notifications` table)

---

### Privacy Mode

Controls whether a user's profile can be followed freely or requires a request.

`privacy_mode` on `profiles` is either `'public'` (default) or `'private'`. The Social page reads this field before deciding whether `sendFriendAction()` should create a `follows` row directly or a pending `follow_requests` row. Users toggle privacy mode on the Profile settings page.

**Key files:** [src/lib/social/types.ts](src/lib/social/types.ts), [src/app/profile/page.tsx](src/app/profile/page.tsx)

**User-facing behavior:** Privacy toggle on Profile settings; affects how other users' Follow buttons behave toward you.

---

## Notifications

### Notifications Page

Lists all of the current user's unread and read notifications.

`fetchNotifications(userId)` queries the `notifications` table ordered by `created_at DESC`. Each item is rendered as a `NotificationItem` card showing the notification message, type badge, and a "Mark as read" button that calls `markNotificationRead(notificationId)`, setting `read_at` to now. Empty state shows a bell icon and "All caught up" message.

**Key files:** [src/app/notifications/page.tsx](src/app/notifications/page.tsx), [src/components/social/NotificationItem.tsx](src/components/social/NotificationItem.tsx), [src/lib/social/sessions.ts](src/lib/social/sessions.ts)

**User-facing behavior:** Bell icon in the Navbar links here. Current notification types: `friend_request_received`, `friend_request_accepted`, `gym_invite`.

**Dependencies:** Supabase (`notifications` table), AuthGate

---

## Profile & Settings

### User Profile Page

Displays user identity, social stats, and account settings.

Shows avatar (initials), username, email, plan tier badge, and three social counters (Friends, Following, Followers) loaded from `fetchFriendCounts()`. The settings form lets users update their username and toggle privacy mode. `updateMyProfileSettings()` upserts the `profiles` row.

**Key files:** [src/app/profile/page.tsx](src/app/profile/page.tsx), [src/lib/social/sessions.ts](src/lib/social/sessions.ts)

**User-facing behavior:** Username and privacy mode editable inline; save button shows a success/error message.

**Dependencies:** Supabase (`profiles` table), AuthGate

---

## Pricing / Plan Tiers

### Pricing Page

Static informational page describing the current access model.

Displays a single "v3 Access" card listing features available in the current rollout: multi-exercise form tracking, coaching programs, USDA meal logging, and workout calendar. Billing is explicitly deferred — all features are free. Plan tier (`'free'` / `'pro'`) is stored in the `subscriptions` table and surfaced on the Profile page but has no functional gating at this time.

**Key files:** [src/app/pricing/page.tsx](src/app/pricing/page.tsx), [src/lib/workouts/sessions.ts](src/lib/workouts/sessions.ts) (`fetchPlanTier`)

**User-facing behavior:** Static card page; no purchase flow present.

---

## UI Components & Layout

### Root Layout

Wraps the entire app with the global Navbar, fonts, and page container.

Sets the `<html lang>`, loads Poppins via Next.js Google Fonts, renders `<Navbar />`, wraps `children` in a `<PageContainer />`. Sets `<head>` metadata: title "FormFixer", description about real-time form coaching.

**Key files:** [src/app/layout.tsx](src/app/layout.tsx)

---

### Navbar

Global navigation bar with mobile and desktop layouts.

Desktop: horizontal link list (Dashboard, Camera, Programs, Nutrition, Calendar, Social, Notifications, Profile). Mobile: top bar with greeting + auth button + bell icon, plus a 5-tab bottom tab bar (Home, Camera, Programs, Nutrition, Profile). Active route is highlighted. Auth state is polled on mount and on `onAuthStateChange`; shows "Log out" / "Sign in" accordingly.

**Key files:** [src/components/layout/Navbar.tsx](src/components/layout/Navbar.tsx)

**User-facing behavior:** Always visible; bottom tab bar on mobile, horizontal nav on desktop. Logout clears the session and redirects to `/login`.

**Dependencies:** `usePathname`, `useRouter`, Supabase Auth, `lucide-react`

---

### Marketing / Landing Page

Public-facing product introduction at `/`.

Contains: animated SVG pose skeleton hero, four feature highlight cards (AI Form Detection, Guided Programs, Nutrition, Social), a three-step "How it works" walkthrough, a programs preview grid (Strength Fundamentals, HIIT Conditioning, Core & Stability), hero stats (10+ Exercises, 30 fps Detection, 33 Landmarks, 100% Free), and a footer with navigation links.

**Key files:** [src/app/(marketing)/page.tsx](src/app/(marketing)/page.tsx)

**User-facing behavior:** Fully static, no auth required. CTA buttons link to `/login` and `/camera`.

---

### Card Component

Generic content container with optional title and description.

Props: `title`, `description`, `children`, `variant` (`'default'` | `'white'` | `'accent'`), `className`. Renders a styled `<div>` with consistent padding and border-radius. Used throughout Dashboard, Social, Profile, and Nutrition pages.

**Key files:** [src/components/ui/Card.tsx](src/components/ui/Card.tsx)

---

### Button Component

Polymorphic button with link support.

Props: `children`, `href` (renders as `next/link` when provided), `onClick`, `variant` (`'solid'` | `'ghost'` | `'dark'`), `full` (100% width), `disabled`, `type`, `style`, `className`. Consistent sizing, border-radius, and hover states across variants.

**Key files:** [src/components/ui/Button.tsx](src/components/ui/Button.tsx)

---

### Section Component

Page-level section wrapper with optional title, subtitle, and description.

Used to give consistent vertical rhythm and heading hierarchy across full-page sections (e.g., Programs list, Pricing page).

**Key files:** [src/components/layout/Section.tsx](src/components/layout/Section.tsx)

---

### Exercise Info Card

Contextual help card shown when an exercise is selected on the camera page.

Displays exercise-specific tips (form cues, camera positioning) before the user begins. Rendered between exercise selection and the start of the detection loop.

**Key files:** [src/components/ui/ExerciseInfoCard.tsx](src/components/ui/ExerciseInfoCard.tsx)

**Props:** `exerciseId`, `onStart`

---

### Pose Overlay Component

Lightweight React wrapper around the canvas-based skeleton renderer.

Accepts `width`, `height`, and `landmarks` props. On every render cycle it calls `drawPoseOverlay()` on a `<canvas>` positioned absolutely over the video element. Used in the `/workout` route alias of the camera page.

**Key files:** [src/app/workout/PoseOverlay.tsx](src/app/workout/PoseOverlay.tsx)

---

### Global Styles

Design token system for the entire app.

`globals.css` defines CSS custom properties for the color palette (`--bg-base`, `--bg-card`, `--accent`, `--text-primary`, `--text-secondary`, `--text-muted`, `--danger`, etc.), typography scale, and utility classes (`ui-section`, `desktop-centered-col`, `stat-grid`). All components reference these tokens rather than hardcoded colors.

**Key files:** [src/styles/globals.css](src/styles/globals.css)

---

## Database & Backend

### Supabase Client

Singleton Supabase client initialized lazily via a dynamic CDN import.

`getSupabaseClient()` returns a cached `Promise<SupabaseClient>`. On first call it dynamically imports `@supabase/supabase-js`, creates the client with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and caches the instance. Auth is configured with `persistSession: true` and `autoRefreshToken: true`.

**Key files:** [src/lib/supabaseClient.ts](src/lib/supabaseClient.ts)

**Dependencies:** `@supabase/supabase-js` (CDN), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` env vars

---

### Database Schema

PostgreSQL schema managed via Supabase with Row-Level Security on every table.

**Tables:**

| Table | Purpose |
|-------|---------|
| `profiles` | User identity, username, privacy mode |
| `workout_sessions` | Saved exercise sessions with rep scores and form metrics |
| `subscriptions` | Plan tier (`free` / `pro`) per user |
| `user_program_progress` | Enrollment and progress per program per user |
| `meal_items` | Individual food log entries with macros |
| `workout_events` | Calendar events with scheduled date and completion flag |
| `friend_requests` | Bidirectional friend request rows (`pending` → `accepted` / `rejected`) |
| `friendships` | Confirmed bidirectional friend pairs |
| `follows` | Asymmetric follow relationships |
| `follow_requests` | Pending follow requests for private profiles |
| `notifications` | Inbox rows for gym invites and social events |

**RLS policies** enforce: users can only read/write their own rows; social tables allow reads when the user is a party to the relationship (requester, receiver, follower, following, actor).

**Key files:** [supabase/schema.sql](supabase/schema.sql)

---

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/usda/search?q=<query>` | Search USDA FoodData Central; returns up to 10 `{fdcId, description, brandOwner}` results |
| `GET` | `/api/usda/food/[fdcId]` | Fetch macro breakdown for one food item; returns `{description, servingSize, servingUnit, macrosPer100g}` |

Both routes are Next.js Route Handlers that proxy to the USDA FDC API using the server-side `USDA_API_KEY` environment variable. The key is never sent to the client.

**Key files:** [src/app/api/usda/search/route.ts](src/app/api/usda/search/route.ts), [src/app/api/usda/food/[fdcId]/route.ts](src/app/api/usda/food/%5BfdcId%5D/route.ts)
