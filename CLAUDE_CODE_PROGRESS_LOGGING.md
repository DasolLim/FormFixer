# Claude Code Prompt — Progress Logging Feature
# TYPE: NEW FEATURE — add to existing app.

---

## CONTEXT

Read ARCHITECTURE.md and CLAUDE.md before touching any file.
This adds a new Progress section to the app with four sub-features:
1. Workout-tied journal
2. Weekly progress photos (private, side-by-side comparison)
3. Weight history graph (Recharts)
4. Weight logging input

Photos use a unique index on (user_id, week_number, year) enforced at the DB
level — not just application logic — so duplicate week uploads are impossible
even with concurrent requests. Weight graph uses Recharts `connectNulls` to
draw lines across missing days, which is the correct behaviour for a health
tracking graph (gaps shouldn't visually imply zero).

Implement this feature last — it is the only one requiring a new page and a
new npm package.

Install Recharts before starting:
```bash
npm install recharts
```
Recharts is a React-first charting library with built-in TypeScript support.
Use it for all graphs in this feature — do not use any other charting library.

---

## STEP 1 — DATABASE MIGRATION

Create one migration with three new tables.

```sql
-- Workout journal entries (tied to a workout session)
CREATE TABLE public.journal_entries (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    workout_session_id UUID REFERENCES public.workout_sessions(id) ON DELETE SET NULL,
    entry_date         DATE NOT NULL DEFAULT CURRENT_DATE,
    content            TEXT NOT NULL CHECK (char_length(content) <= 250),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON public.journal_entries (user_id, entry_date DESC);
CREATE UNIQUE INDEX ON public.journal_entries (user_id, entry_date);
-- One entry per user per day

-- Progress photos
CREATE TABLE public.progress_photos (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    photo_date     DATE NOT NULL,
    storage_path   TEXT NOT NULL,     -- Supabase Storage path
    signed_url     TEXT,              -- cached signed URL
    signed_url_exp TIMESTAMPTZ,       -- expiry of cached URL
    week_number    INTEGER,           -- ISO week number for grouping
    year           INTEGER,
    notes          TEXT CHECK (char_length(notes) <= 250),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON public.progress_photos (user_id, photo_date DESC);
CREATE UNIQUE INDEX ON public.progress_photos (user_id, week_number, year);
-- One photo per user per week

-- Weight log entries
CREATE TABLE public.weight_logs (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    log_date   DATE NOT NULL DEFAULT CURRENT_DATE,
    weight_kg  NUMERIC(5,2) NOT NULL CHECK (weight_kg > 0 AND weight_kg < 500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON public.weight_logs (user_id, log_date DESC);
CREATE UNIQUE INDEX ON public.weight_logs (user_id, log_date);
-- One weight entry per user per day
```

RLS on all three tables: users can only read and write their own rows.

Storage bucket for progress photos: create `progress-photos` bucket in Supabase
Storage with private access. Storage path pattern:
`progress-photos/{user_id}/{photo_id}.{ext}`

---

## STEP 2 — BACKEND ENDPOINTS

### 2a. Journal endpoints

```
POST   /progress/journal
  Body: { workout_session_id?: string, entry_date: string, content: string }
  Guard: content length ≤ 250 chars
  Logic: upsert by (user_id, entry_date) — one entry per day
  Returns: JournalEntryResponse

GET    /progress/journal
  Query params: start_date, end_date (ISO date strings)
  Returns: list[JournalEntryResponse] ordered by entry_date DESC

GET    /progress/journal/{entry_date}
  Returns: single JournalEntryResponse for that date, or 404

DELETE /progress/journal/{entry_id}
  Guard: entry.user_id == current_user.id
```

### 2b. Progress photo endpoints

```
POST   /progress/photos
  Body: multipart/form-data
    - photo: UploadFile (JPEG, PNG, or HEIC, max 5MB)
    - photo_date: Form field (ISO date string)
    - notes: Form field (optional, ≤ 250 chars)
  Logic:
    1. Validate file type (JPEG/PNG/HEIC) and size (≤ 5MB)
    2. Compute ISO week number and year from photo_date
    3. Check for existing photo this week — return 409 with message:
       "You already have a photo for this week. Delete it first to upload a new one."
    4. Upload to Supabase Storage: progress-photos/{user_id}/{uuid}.{ext}
    5. Generate signed URL (7-day expiry)
    6. INSERT into progress_photos
  Returns: ProgressPhotoResponse

GET    /progress/photos
  Returns: list[ProgressPhotoResponse] ordered by photo_date DESC, limit 52 (one year)
  Logic: for each photo, check if signed_url_exp < now() + 1 day
    If expiring: regenerate signed URL, update DB row, return fresh URL
    If valid: return cached URL

GET    /progress/photos/{photo_id}
  Returns: single ProgressPhotoResponse with fresh signed URL

DELETE /progress/photos/{photo_id}
  Guard: photo.user_id == current_user.id
  Logic: delete from Supabase Storage AND from DB

POST   /progress/photos/compare
  Body: { photo_id_a: string, photo_id_b: string }
  Guard: both photos must belong to current_user.id
  Returns: { photo_a: ProgressPhotoResponse, photo_b: ProgressPhotoResponse }
```

### 2c. Weight log endpoints

```
POST   /progress/weight
  Body: { log_date: string, weight_kg: number } | { log_date: string, weight_lb: number }
  Logic:
    - Convert lb to kg if weight_lb provided: kg = lb × 0.453592
    - Upsert by (user_id, log_date)
  Returns: WeightLogResponse

GET    /progress/weight
  Query params:
    start_date: ISO date string
    end_date:   ISO date string
    unit:       'kg' | 'lb' (default 'kg')
  Returns: list[WeightLogResponse] ordered by log_date ASC
  Logic: if unit='lb', convert weight_kg to lb in response

GET    /progress/weight/latest
  Returns: single most recent WeightLogResponse

DELETE /progress/weight/{log_id}
  Guard: log.user_id == current_user.id
```

### 2d. Schemas

Create `schemas/progress.py`:

```python
from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import Optional
import uuid


class JournalEntryCreate(BaseModel):
    workout_session_id: Optional[uuid.UUID] = None
    entry_date:         date
    content:            str = Field(..., min_length=1, max_length=250)


class JournalEntryResponse(BaseModel):
    id:                 uuid.UUID
    workout_session_id: Optional[uuid.UUID]
    entry_date:         date
    content:            str
    created_at:         datetime
    updated_at:         datetime

    class Config:
        from_attributes = True


class ProgressPhotoResponse(BaseModel):
    id:          uuid.UUID
    photo_date:  date
    signed_url:  str
    week_number: int
    year:        int
    notes:       Optional[str]
    created_at:  datetime

    class Config:
        from_attributes = True


class WeightLogCreate(BaseModel):
    log_date:   date
    weight_kg:  Optional[float] = Field(None, gt=0, lt=500)
    weight_lb:  Optional[float] = Field(None, gt=0, lt=1100)


class WeightLogResponse(BaseModel):
    id:         uuid.UUID
    log_date:   date
    weight_kg:  float
    weight_lb:  float     # always computed: weight_kg × 2.20462
    created_at: datetime

    class Config:
        from_attributes = True
```

---

## STEP 3 — FRONTEND TYPES

Add to `types/index.ts`:

```typescript
export interface JournalEntry {
  id:                 string;
  workout_session_id: string | null;
  entry_date:         string;  // ISO date
  content:            string;
  created_at:         string;
  updated_at:         string;
}

export interface ProgressPhoto {
  id:          string;
  photo_date:  string;
  signed_url:  string;
  week_number: number;
  year:        number;
  notes:       string | null;
  created_at:  string;
}

export interface WeightLog {
  id:         string;
  log_date:   string;
  weight_kg:  number;
  weight_lb:  number;
  created_at: string;
}

export interface PhotoCompareResponse {
  photo_a: ProgressPhoto;
  photo_b: ProgressPhoto;
}

export type WeightUnit = 'kg' | 'lb';
```

---

## STEP 4 — FRONTEND API CALLS

Add to `lib/api.ts`:

```typescript
const PROGRESS_BASE = `${API_URL}/progress`;

// Journal
export async function createJournalEntry(
  payload: { workout_session_id?: string; entry_date: string; content: string },
  token: string,
): Promise<JournalEntry> { ... }

export async function getJournalEntries(
  startDate: string, endDate: string, token: string,
): Promise<JournalEntry[]> { ... }

export async function getJournalEntry(
  entryDate: string, token: string,
): Promise<JournalEntry | null> { ... }

export async function deleteJournalEntry(
  entryId: string, token: string,
): Promise<void> { ... }

// Photos
export async function uploadProgressPhoto(
  formData: FormData, token: string,
): Promise<ProgressPhoto> { ... }

export async function getProgressPhotos(
  token: string,
): Promise<ProgressPhoto[]> { ... }

export async function compareProgressPhotos(
  photoIdA: string, photoIdB: string, token: string,
): Promise<PhotoCompareResponse> { ... }

export async function deleteProgressPhoto(
  photoId: string, token: string,
): Promise<void> { ... }

// Weight
export async function logWeight(
  payload: { log_date: string; weight_kg?: number; weight_lb?: number },
  token: string,
): Promise<WeightLog> { ... }

export async function getWeightLogs(
  startDate: string, endDate: string, unit: WeightUnit, token: string,
): Promise<WeightLog[]> { ... }

export async function getLatestWeight(
  token: string,
): Promise<WeightLog | null> { ... }

export async function deleteWeightLog(
  logId: string, token: string,
): Promise<void> { ... }
```

---

## STEP 5 — PROGRESS PAGE

Create `app/progress/page.tsx`. Add a "Progress" link to the existing nav.

The page has four sections rendered top to bottom. Use a tab or anchor
navigation at the top to jump between sections.

---

### SECTION 1 — Workout Journal

**Layout:**
```
┌─────────────────────────────────────────────┐
│  Today's Journal Entry                      │
│  Linked workout: [Legs & Glutes — today]    │
│  ┌─────────────────────────────────────┐    │
│  [textarea, 4 rows, max 250 chars]          │
│  Characters remaining: 178                  │
│  [Save Entry]                               │
├─────────────────────────────────────────────┤
│  Past Entries                               │
│  [2026-05-14]  "Hit a new PR on squats..."  │
│  [2026-05-07]  "Felt fatigued today..."     │
└─────────────────────────────────────────────┘
```

**Behaviour:**
- On page load, fetch today's journal entry. If it exists, pre-populate the textarea.
- If the user has a workout session logged today, auto-link via `workout_session_id`.
- Character counter updates live as user types. Goes amber at 220+, red at 250.
- "Save Entry" triggers upsert (POST /progress/journal).
- Past entries list: fetch last 30 days. Each entry shows date + first 80 chars.
  Clicking an entry expands it inline with full content + delete button.
- Delete prompts confirmation: "Delete this journal entry? This cannot be undone."

---

### SECTION 2 — Weekly Progress Photos

**Layout:**
```
┌─────────────────────────────────────────────┐
│  This Week's Photo                          │
│  [Photo upload — drag & drop or click]      │
│  PNG, JPEG, or HEIC · Max 5MB              │
│  [optional notes, 250 char limit]           │
│  Date: [date picker, defaults to today]     │
│  [Upload Photo]                             │
├─────────────────────────────────────────────┤
│  Compare Progress                           │
│  [Select photo A ▼]  vs  [Select photo B ▼] │
│  [Compare]                                  │
│                                             │
│  ┌──────────────┐  ┌──────────────┐        │
│  │  Photo A     │  │  Photo B     │        │
│  │  Week 18     │  │  Week 12     │        │
│  │  2026-05-04  │  │  2026-03-23  │        │
│  └──────────────┘  └──────────────┘        │
├─────────────────────────────────────────────┤
│  Photo History (grid)                       │
│  [photo thumb] [photo thumb] [photo thumb]  │
│  Week 18       Week 17       Week 16        │
└─────────────────────────────────────────────┘
```

**Photo upload behaviour:**
- Accept JPEG, PNG, HEIC only. Validate client-side before upload.
- Show file size error if > 5MB: "File too large. Maximum size is 5MB."
- After upload success, refresh the photo history grid.
- If a photo already exists for the selected week, show:
  "You already have a photo for this week. Delete the existing one to replace it."

**Comparison view:**
- Two `<select>` dropdowns populated from photo history.
  Each option shows: "Week {week_number} — {photo_date}"
- On "Compare": call POST /progress/photos/compare, render two photos side by side.
- Photo containers: equal width, `objectFit: 'cover'`, `aspectRatio: '3/4'`
  (portrait — standard for physique photos).
- Below each photo: week number, date, and notes if present.

**Photo history grid:**
- Thumbnail grid, 3 columns on desktop, 2 on mobile.
- Each thumbnail: `aspectRatio: '3/4'`, rounded corners.
- On hover: show date overlay and a delete icon (trash).
- Delete prompts confirmation before calling DELETE /progress/photos/{id}.

---

### SECTION 3 — Weight History Graph

**Layout:**
```
┌─────────────────────────────────────────────┐
│  Weight History                             │
│  Unit: ● kg  ○ lb        [7d][30d][1yr]    │
│                                             │
│  [Recharts LineChart]                       │
│  Y-axis: weight in selected unit            │
│  X-axis: dates                              │
│  Tooltip: "May 14 — 74.2 kg"               │
│  Data points connected across gaps          │
│                                             │
│  Trend: ↓ 1.8 kg over selected period      │
└─────────────────────────────────────────────┘
```

**Recharts implementation:**

```typescript
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

// Data shape for chart
interface WeightDataPoint {
  date:    string;  // formatted for display: "May 14"
  weight:  number;  // in selected unit
  isoDate: string;  // for sorting
}

// Chart component
<ResponsiveContainer width="100%" height={280}>
  <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
    <XAxis
      dataKey="date"
      tick={{ fontSize: 12, fill: 'var(--muted)' }}
      tickLine={false}
    />
    <YAxis
      domain={['auto', 'auto']}
      tick={{ fontSize: 12, fill: 'var(--muted)' }}
      tickLine={false}
      axisLine={false}
      unit={unit === 'kg' ? ' kg' : ' lb'}
    />
    <Tooltip
      contentStyle={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        fontSize: '13px',
      }}
      formatter={(value: number) => [`${value} ${unit}`, 'Weight']}
    />
    <Line
      type="monotone"
      dataKey="weight"
      stroke="var(--accent)"
      strokeWidth={2}
      dot={{ r: 4, fill: 'var(--accent)', strokeWidth: 0 }}
      activeDot={{ r: 6 }}
      connectNulls  // connects data points across missing days — do not remove
    />
  </LineChart>
</ResponsiveContainer>
```

**Date range selector:**
Three preset buttons: `7d`, `30d`, `1yr`.
On selection, compute `start_date = today - N days`, call `getWeightLogs`.

**Trend calculation:**
```typescript
const getTrend = (data: WeightDataPoint[]): string => {
  if (data.length < 2) return '';
  const first = data[0].weight;
  const last  = data[data.length - 1].weight;
  const diff  = last - first;
  const sign  = diff > 0 ? '↑' : '↓';
  const abs   = Math.abs(diff).toFixed(1);
  return `${sign} ${abs} ${unit} over this period`;
};
```

Display trend below the chart in muted text. Green for weight loss goal
when trending down, amber when trending up. Invert for muscle gain goal.

**Unit toggle:**
Switching unit re-fetches data with the new unit parameter. Updates Y-axis
label and tooltip. Does not change the stored data.

---

### SECTION 4 — Log Today's Weight

```
┌─────────────────────────────────────────────┐
│  Log Your Weight                            │
│                                             │
│  Today's weight: [74.2] [kg ▼]             │
│  Date: [2026-05-14]  (editable)             │
│  [Log Weight]                               │
│                                             │
│  Most recent: 74.2 kg — logged May 14      │
│                                             │
│  Recent entries:                            │
│  May 14  74.2 kg  [×]                      │
│  May 13  74.5 kg  [×]                      │
│  May 12  74.8 kg  [×]                      │
└─────────────────────────────────────────────┘
```

**Behaviour:**
- Unit toggle (kg / lb) — follows user profile preference, user can override here.
- Date field defaults to today. User can backfill past dates.
- "Log Weight" calls POST /progress/weight. On success: refresh recent entries list
  and the graph in Section 3 if it is rendered.
- Recent entries: last 7 entries. Each has a delete (×) icon.
- Deleting a weight entry prompts: "Remove this weight log? The graph will update."
- The `weight_unit` preference from the nutrition profile is the default unit here.
  If not set, default to kg.

---

## STEP 6 — NAV INTEGRATION

Add "Progress" to the existing navigation. Match the exact nav pattern used
for other sections. The route is `/progress`. Add the nav item between the
existing Nutrition and Community (or whatever the adjacent items are) sections.

---

## VERIFICATION CHECKLIST

**Database:**
- [ ] Migration creates journal_entries, progress_photos, weight_logs tables
- [ ] Unique index on (user_id, entry_date) for journal
- [ ] Unique index on (user_id, week_number, year) for photos
- [ ] Unique index on (user_id, log_date) for weight logs
- [ ] RLS on all three tables
- [ ] progress-photos Storage bucket created as private

**Journal:**
- [ ] Today's entry pre-populates if it exists
- [ ] Workout session auto-links if logged today
- [ ] Character counter live-updates
- [ ] Save triggers upsert correctly
- [ ] Past entries list renders and expands on click
- [ ] Delete with confirmation works

**Photos:**
- [ ] File type validation (JPEG/PNG/HEIC) client-side before upload
- [ ] File size validation (≤ 5MB) client-side before upload
- [ ] Duplicate week upload rejected with clear message
- [ ] Comparison view renders two photos side-by-side
- [ ] Photo dropdowns show week + date labels
- [ ] History grid 3-col desktop, 2-col mobile
- [ ] Delete photo removes from Storage AND DB

**Weight graph:**
- [ ] Recharts renders without errors
- [ ] `connectNulls` connects data points across gaps
- [ ] Unit toggle re-fetches and re-renders correctly
- [ ] Date range selector (7d / 30d / 1yr) works
- [ ] Trend calculation displays correctly
- [ ] Tooltip shows date and weight with unit

**Weight log:**
- [ ] Upsert works — logging same date updates existing entry
- [ ] Recent entries list refreshes after log or delete
- [ ] Unit toggle converts displayed values
- [ ] Graph updates after new weight logged

**General:**
- [ ] "Progress" nav item added and routes to /progress
- [ ] All four sections visible on page
- [ ] npm run type-check passes with zero errors

## CONSTRAINTS

- Follow CLAUDE.md conventions exactly
- Inline styles only — no Tailwind, no new CSS files
- Only new npm package: `recharts` — no others
- Full TypeScript type annotations
- Progress photos signed URLs must never be exposed publicly
- Use existing Supabase Storage singleton — do not create a new client
