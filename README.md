# FormFixer (v3 Platform Expansion)

## v3 features
- Real-time form fixer (squat, push-up, lunge)
- Program library + program detail + start program flow
- Program progress tracking (week, completed workouts, completion %)
- Nutrition logging (manual entry + USDA FoodData Central search)
- Daily macro dashboard
- Workout calendar planning + completion tracking (FullCalendar React)

## Environment variables
Create `.env` in project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
USDA_API_KEY=your-usda-fooddata-central-key
```

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Run SQL in Supabase SQL editor:
   - `supabase/schema.sql`
3. Start app:
   ```bash
   npm run dev
   ```


## Design direction
- Inspired by clean dashboard patterns used in popular fitness apps (Nike Training Club, Fitbod, Strava):
  - bold hero section
  - clear module-based navigation
  - card-first summaries for quick scanning

## New routes
- `/programs` program library
- `/programs/[slug]` program detail + progress actions
- `/nutrition` meal logging + USDA search + macro totals
- `/calendar` workout planning calendar
- Existing routes still work: `/camera`, `/dashboard`, `/profile`, `/login`

## USDA integration details
- Server-side routes keep API key private:
  - `GET /api/usda/search?q=...`
  - `GET /api/usda/food/:fdcId`
- User can always manually edit calories/macros before saving meal logs.

## Calendar integration details
- Uses local FullCalendar packages (`@fullcalendar/*`) installed via npm.
- Supports month/week views, adding planned workouts, and marking complete.

## Test steps (manual)
1. Sign up / login on `/login`.
2. Open `/programs`, start a program, mark workout complete.
3. Open `/dashboard`, verify active program progress card updates.
4. Open `/nutrition`, search USDA food, select item, edit servings/macros, save item.
5. Verify daily macro totals update on `/nutrition` and dashboard calories card.
6. Open `/calendar`, create workout event, switch month/week, mark completion.

## Known limitations / deferred
- No Stripe/payment integration in this phase.
- No premium gating in this phase.
- No food-photo nutrition API (deferred).
- No advanced recommendation engine/personalization yet.

## VS Code terminal setup (Windows PowerShell)

```powershell
# 1) Clean previous install artifacts
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue

# 2) Install JavaScript dependencies
npm install

# 3) Install optional Python helper dependency
py -m pip install -r requirements.txt

# 4) Start the app
npm run dev
```

### Install FullCalendar manually
```powershell
npm install @fullcalendar/core @fullcalendar/react @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/interaction
```

### Run checks
```powershell
npm run lint
npm run typecheck
```
