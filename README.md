# GymFXR

Real-time AI fitness coaching in the browser. GymFXR uses on-device pose detection to analyze exercise form as you train, giving live rep counts, form scores, and voice/visual cues — no wearable or native app required.

**Live:** [gymfixer.vercel.app](https://gymfixer.vercel.app)

## Features

- **Real-time form analysis** — MediaPipe pose detection runs entirely client-side over the webcam feed, tracking 33 body landmarks at up to 30fps
- **21 supported exercises** — squat, push-up, pull-up, sit-up, bicep curl, overhead press, Nordic curl, and more, each with a dedicated scoring engine (`src/features/form-engine/engines`)
- **Rep counting & form scoring** — a calibration gate, rep-phase state machine, and feedback prioritizer turn raw landmarks into a live rep count, joint angles, and a 0–100 form score per set
- **Voice cues** — spoken feedback during a set via the Web Speech API
- **Guided workout programs** — browse structured programs or generate one with AI (OpenRouter), then schedule it onto a calendar
- **Nutrition tracking** — log meals by type and search the USDA FoodData Central database for macros
- **Progress tracking** — weight graph, progress photos, and a training journal
- **Social** — friends, gym invites, and an in-app notification center
- **Gamification** — XP, levels, personal records, and streaks
- **Installable PWA** — offline-capable app shell with a service worker and web manifest

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router), React 18, TypeScript |
| Pose detection | MediaPipe Tasks Vision (client-side) |
| Database & Auth | Supabase (Postgres, Auth, Row Level Security) |
| AI generation | OpenRouter API (workout program & schedule generation) |
| Nutrition data | USDA FoodData Central API |
| Charts | Recharts |
| 3D | Three.js (muscle-group avatar) |
| State | Zustand |
| Validation | Zod |
| Styling | Global CSS with a custom design-token system (no CSS framework) |
| Deployment | Vercel |

## Getting started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (Postgres + Auth enabled)
- A [USDA FoodData Central](https://fdc.nal.usda.gov/api-key-signup.html) API key
- An [OpenRouter](https://openrouter.ai) API key

### Setup

```bash
git clone https://github.com/DasolLim/FormFixer.git
cd FormFixer
npm install
```

Create a `.env` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
USDA_API_KEY=your-usda-fooddata-central-key
OPENROUTER_API_KEY=your-openrouter-key
OPENROUTER_MODEL=anthropic/claude-3-5-sonnet
```

Provision your Supabase project with the schema this app expects — see `src/lib/database.types.ts` and the query functions under `src/lib/*/sessions.ts` for the tables each feature reads and writes.

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Other scripts

```bash
npm run build       # production build
npm run start       # serve the production build
npm run lint        # lint
npm run lint:fix    # lint, auto-fixing
```

## Project structure

```
src/
├── app/            # Next.js App Router pages and API routes
├── components/     # Shared UI components
├── features/
│   ├── pose/         # MediaPipe adapter, landmark normalization
│   └── form-engine/  # Per-exercise scoring engines, rep counter, calibration
├── lib/            # Supabase queries, domain logic, per-feature server actions
├── store/          # Zustand stores
└── styles/         # Global CSS design-token system
```

## License

MIT — see [LICENSE](LICENSE).
