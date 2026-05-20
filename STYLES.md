# FormFixer — Styles Reference

All styling lives in a single file: `src/styles/globals.css`. There is no CSS Modules, Tailwind, or styled-components. Components use named CSS classes from this file combined with inline `style={}` props for one-off or data-driven values (progress percentages, gradient backgrounds, dynamic colours).

---

## 1. Design Tokens (CSS Custom Properties)

All tokens are defined on `:root`. Override them in a `[data-theme]` block to retheme the entire app.

### Backgrounds

| Variable | Default value | Purpose |
|---|---|---|
| `--bg-app` | `#101010` | Page root background |
| `--bg-screen` | `#1A1A1A` | Content area / navbar background |
| `--bg-card` | `#1D1D1D` | Card surface |
| `--bg-card-raised` | `#252525` | Elevated card / hover state |
| `--bg-input` | `#2A2A2A` | Input fields, ghost buttons, toggle tracks |

### Accent (primary brand colour)

| Variable | Default value | Purpose |
|---|---|---|
| `--accent` | `#D5FF5F` | Lime green — primary CTA, active states, data highlights |
| `--accent-dim` | `#B8E04A` | Hover / pressed accent |
| `--accent-muted` | `rgba(213,255,95,0.12)` | Tinted background for accent-adjacent areas |
| `--accent-glow` | `0 0 20px rgba(213,255,95,0.25)` | Box-shadow glow on accent elements |

### Text

| Variable | Default value | Purpose |
|---|---|---|
| `--text-primary` | `#F7FBFF` | Body copy, headings |
| `--text-secondary` | `#8A8A8A` | Labels, subtitles |
| `--text-muted` | `#555555` | Placeholder, disabled, de-emphasised |
| `--text-on-lime` | `#101010` | Text on top of `--accent` backgrounds |
| `--text-lime` | `#D5FF5F` | Accent-coloured text on dark backgrounds |

### Semantic colours

| Variable | Default | Meaning |
|---|---|---|
| `--color-good` | `#D5FF5F` | Success / healthy form (aliases `--accent`) |
| `--color-warn` | `#FF6B6B` | Warning / form error (red) |
| `--color-neutral` | `#555555` | Neutral / inactive |
| `--danger` | `#FF6B6B` | Destructive actions (delete, irreversible) |

### Borders & Shadows

| Variable | Default value | Purpose |
|---|---|---|
| `--border` | `rgba(255,255,255,0.07)` | Default card/input border |
| `--border-active` | `rgba(213,255,95,0.4)` | Focus ring / active selection border |
| `--shadow-card` | `0 4px 24px rgba(0,0,0,0.4)` | Card elevation |
| `--shadow-lime` | `0 4px 20px rgba(213,255,95,0.2)` | Accent-glow shadow |
| `--shadow-fab` | `0 4px 20px rgba(0,0,0,0.6)` | FAB shadow |

### Font size scale

```css
--font-size-xs: 0.75rem
--font-size-sm: 0.875rem
--font-size-md: 1rem
--font-size-lg: 1.125rem
--font-size-xl: clamp(1.5rem, 2.5vw, 2rem)
```

### Backwards-compat aliases

Some older inline references use `--bg`, `--surface`, `--muted`, `--primary`, `--radius`, etc. These are re-declared as aliases on `:root` so existing code doesn't break. Use the canonical names above for all new work.

---

## 2. Theme System

The active theme is controlled by a `data-theme` attribute on `<html>`, set by the `useTheme()` hook in `src/lib/theme/useTheme.ts`.

### Available themes

| `data-theme` value | Description |
|---|---|
| *(none / omitted)* | Default dark — same as `dark` |
| `dark` | Default dark slate palette |
| `light` | Light backgrounds, dark text |
| `gym` | High-contrast; suited for bright gym environments |

### `useTheme(userId?)` hook

Located at `src/lib/theme/useTheme.ts`. Returns `{ theme, setTheme, cycleTheme }`.

```ts
export type Theme = 'light' | 'dark' | 'gym';
const THEMES: Theme[] = ['dark', 'light', 'gym'];
```

- **Persistence**: reads from and writes to `localStorage` under the key `'ff-theme'`.
- **Supabase sync**: when `userId` is supplied, writes `theme_preference` to `profiles` on every change.
- **`applyTheme(t)`**: calls `document.documentElement.setAttribute('data-theme', t)` immediately.
- **`cycleTheme()`**: steps `dark → light → gym → dark`.

### Usage

`useTheme` is currently consumed only by `AccountTab` inside `src/app/profile/page.tsx`. The 3-segment theme toggle (Dark / Light / Gym) renders as a `grid(3, 1fr)` of buttons using `--accent-muted` / `--accent` active highlight.

### Note on FOUC

There is currently **no** inline `<script>` in `layout.tsx` for flash-of-wrong-theme prevention. The theme applies after React mounts. If FOUC becomes a problem, add an inline `<script>` to `<head>` that reads `localStorage['ff-theme']` and calls `document.documentElement.setAttribute(...)` synchronously.

---

## 3. Typography

**Font:** Poppins (Google Fonts, weights 200–800). Loaded via `<link>` in `app/layout.tsx`. Falls back to `-apple-system, BlinkMacSystemFont, sans-serif`.

Base: `font-size: 16px`, `line-height: 1.4`, `-webkit-font-smoothing: antialiased`.

Headings (`h1`–`h6`) are reset: `font-weight: 700; letter-spacing: -0.01em; margin: 0`.

### Utility classes

| Class | Effect |
|---|---|
| `.font-tabular` | `font-variant-numeric: tabular-nums; letter-spacing: -0.02em` |
| `.text-lime` | `color: var(--text-lime)` |
| `.text-muted` | `color: var(--text-secondary)` |
| `.text-primary` | `color: var(--text-primary)` |

---

## 4. Layout

### Page container

`.page-container` is the main content wrapper rendered by `PageContainer` in `app/layout.tsx`:
- Mobile: `max-width: 430px`, `padding-top: 68px` (clears fixed navbar), `padding-bottom: 88px` (clears bottom tab nav)
- Desktop (≥1024px): `max-width` expands, top/bottom padding adjusts

### Section helpers

| Class | Effect |
|---|---|
| `.ui-section` | `flex column; gap: 16px` |
| `.section-gap` | `margin-bottom: 16px` |
| `.ui-section-title` | `20px 700` section heading |
| `.ui-section-subtitle` | `13px secondary` |
| `.ui-section-description` | `13px secondary` description |
| `.desktop-centered-col` | `width: 100%; flex column; gap: 16px`; on desktop: `max-width: 720px; margin: auto` |

### Two-column page grids

| Class | Mobile | Desktop (≥1024px) |
|---|---|---|
| `.camera-page-layout` | `flex column; gap: 16px` | `grid 1fr 400px; gap: 24px` |
| `.dashboard-desktop-grid` | `flex column; gap: 16px` | `grid 1fr 380px; gap: 24px` |
| `.nutrition-desktop-grid` | `flex column; gap: 16px` | `grid 1fr 1fr; gap: 24px` |
| `.social-desktop-grid` | `flex column; gap: 16px` | `grid 1fr 1fr; gap: 24px` |

`.social-desktop-grid` is used by the **Profile hub** (`app/profile/page.tsx`) for the left-column profile card and right-column tab content split.

Column helpers used inside these grids:

| Class | Purpose |
|---|---|
| `.social-col-left` | Left column — `flex column; gap: 16px` |
| `.social-col-right` | Right column — `flex column; gap: 16px` |

`.desktop-only` is `display: none !important` on mobile, `display: block !important` on desktop.

---

## 5. Navbar

Fixed top bar (`z-index: 100`). Hydration-safe: all auth-dependent elements (logout button, profile avatar) are gated on a `mounted` state that flips in `useEffect`, so the server and client render identically during hydration.

### Mobile (< 1024px)

- Height: `60px`
- Left: `.navbar-user` — avatar placeholder + greeting text
- Right: `.navbar-end` — sign-in link (unauthenticated) or profile avatar circle (authenticated, post-mount)

### Desktop (≥ 1024px)

- Left: `.navbar-brand-wrap` — "FormFixer" wordmark
- Centre: `.desktop-nav-links` — horizontal pill nav links
- Right: `.navbar-end` — profile avatar circle

### Relevant classes

| Class | Purpose |
|---|---|
| `.navbar` | Fixed top bar |
| `.navbar-end` | Right slot — flex row, gap 8px |
| `.navbar-auth-btn` | Sign in pill button |
| `.navbar-brand-wrap` | Desktop wordmark link |
| `.desktop-nav-links` | Centred horizontal nav link container |
| `.desktop-nav-link` | Individual nav link pill |
| `.desktop-nav-link.active` | Accent colour + accent-muted background |

---

## 6. Bottom Tab Nav (mobile)

`.bottom-nav` is a fixed `72px` bar at the bottom of the screen on mobile (hidden at ≥1024px). Safe-area inset: `padding-bottom: env(safe-area-inset-bottom)`.

Four tabs: Dashboard, Camera, Programs, Nutrition.

| Class | Purpose |
|---|---|
| `.bottom-nav` | Fixed bottom bar |
| `.nav-item` | Individual tab — icon + label |
| `.nav-item.active` | Accent colour; icon gets `drop-shadow` glow |
| `.nav-badge` | Small red dot for unread counts |

---

## 7. Cards

| Class | Description |
|---|---|
| `.card` | Standard card — `border-radius: 20px`, `padding: 20px`, `box-shadow: var(--shadow-card)` |
| `.card-raised` | `--bg-card-raised` background |
| `.card-accent` | Accent background (content inside uses `--text-on-lime`) |

The `<Card>` React component (`src/components/ui/Card.tsx`) wraps `.card` and accepts `variant?: 'default' | 'raised' | 'white' | 'accent'`.

---

## 8. Buttons

All buttons share `.btn` as a base class. Compose with one variant modifier and optionally `.btn-full`.

```html
<button class="btn btn-primary">Save</button>
<button class="btn btn-secondary">Cancel</button>
<button class="btn btn-ghost">Dismiss</button>
<button class="btn btn-dark">Continue Week 3</button>
<button class="btn btn-primary btn-full">End session & save</button>
```

| Modifier | Background | Text | Typical use |
|---|---|---|---|
| `.btn-primary` | `--accent` | `--text-on-lime` | Primary CTA |
| `.btn-secondary` | `--bg-card` + `--border` outline | `--text-primary` | Alert, Accept/Decline actions |
| `.btn-ghost` | `--bg-input` | `--text-primary` | Tertiary / destructive-safe actions |
| `.btn-dark` | `--bg-card-raised` | `--text-primary` | Dark-surface CTAs (e.g. on gradient cards) |

Base `.btn`: `height: 52px`, `border-radius: 999px`, `padding: 0 28px`. On desktop: `height: 44px`, `font-size: 14px`.

The `<Button>` React component (`src/components/ui/Button.tsx`) wraps these classes with `variant?: 'solid' | 'secondary' | 'ghost' | 'dark'` (`'solid'` maps to `btn-primary`).

### Camera-specific buttons

| Class | Purpose |
|---|---|
| `.cam-main-btn` | Full-width `56px` start/stop button |
| `.cam-main-btn-start` | Accent fill |
| `.cam-main-btn-stop` | Red tint |
| `.cam-ctrl-btn` | Secondary control buttons |

---

## 9. Tabs

The generic `<Tabs<T>>` component lives at `src/components/ui/Tabs.tsx`. It renders a pill-shaped tab switcher.

```ts
type TabItem<T extends string> = { key: T; label: ReactNode };
// Props: tabs, active, onChange, style?
```

Visual spec:
- **Track**: `--bg-input` background, `border-radius: 999px`
- **Active tab**: `--accent` background, `--text-on-lime` text
- **Inactive tab**: `transparent` background, `--text-secondary` text

Use this for any multi-tab switcher that lives _within_ a page section. The profile page tab bar uses underline-style inline `style={}` instead (different visual language).

---

## 10. Forms

| Class | Purpose |
|---|---|
| `.form-input` | Standard text input — `height: 48px`, `border-radius: 12px`, `--bg-input` background, `--border-active` focus ring |
| `.form-label` | `flex column; gap: 6px; font-size: 13px` label + input wrapper |
| `.exercise-select` | Styled `<select>` with SVG chevron, `height: 48px` |

Focus state for `.form-input`: `border-color: var(--border-active)`, `outline: none`.

Do not recreate `.form-input` with inline styles. Apply `className="form-input"` directly to `<input>` and `<select>` elements.

---

## 11. Tags / Pills

| Class | Background | Text | Use |
|---|---|---|---|
| `.tag` | Base — `padding: 5px 12px; border-radius: 999px; font-size: 11px 700` | — | — |
| `.tag-lime` | `--accent` | `--text-on-lime` | Active filter, "Pro" badge, "Generate with AI" |
| `.tag-dark` | `--bg-input` + `--border` | `--text-secondary` | Equipment labels, recent searches, "Free plan" |
| `.tag-outline` | transparent + `--border` | `--text-secondary` | Inactive filter pills |

Filter pill pattern (Programs page):
```html
<!-- Active -->
<button class="tag tag-lime" style="border: none">All</button>
<!-- Inactive -->
<button class="tag tag-outline">Beginner</button>
```
The active lime pill gets `border: none` inline to override the browser button default; the outline pill keeps its CSS border.

---

## 12. Avatar

| Class | Size | Style |
|---|---|---|
| `.avatar-sm` | 44×44px | For `<img>` — `border-radius: 50%`, `border: 2px solid --border` |
| `.avatar-md` | 56×56px | Same |
| `.avatar-lg` | 80×80px | Same |
| `.avatar-placeholder` | 44×44px | Initials circle — `--accent-muted` bg, `--accent` text, `flex center` |
| `.avatar-placeholder-lg` | 80×80px | Same — used in profile header |

Use `.avatar-placeholder` (not `.avatar`) for initials divs since `.avatar` is for `<img>` and lacks flex centering.

---

## 13. Camera / Session HUD

### Layout

The camera page uses `.camera-page-layout` — flex column on mobile, `1fr 400px` grid on desktop. The right column is occupied by `<SessionSidePanel>`.

### Preview container

| Class | Description |
|---|---|
| `.camera-preview` | `aspect-ratio: 3/4`, `border-radius: 20px`, `overflow: hidden` |
| `.camera-preview video` | `position: absolute; inset: 0; object-fit: cover` |
| `.camera-preview canvas` | Same, `z-index: 2` (pose overlay) |

### HUD overlays

| Class | Position | Purpose |
|---|---|---|
| `.cam-hud` | base | Shared: `position: absolute; left/right: 12px; border-radius: 11px` |
| `.cam-hud-status` | `top: 68px` | Calibration status banner |
| `.cam-hud-status.cam-hud-ready` | — | Accent-tinted — calibration passed |
| `.cam-hud-status.cam-hud-warn` | — | Red-tinted — pose issue |
| `.cam-hud-bottom` | `bottom: 14px` | Bottom stats panel with blur backdrop |

### Form gauge

| Class | Purpose |
|---|---|
| `.form-gauge-track` | `height: 10px` rounded track — also used in programs and nutrition |
| `.form-gauge-fill` | Animated fill (`transition: width 0.3s`); width set via inline `style={{ width: '${pct}%' }}` |

The fill colour is data-driven: `--accent` when score ≥ 70, `--color-warn` below. On gradient cards (e.g. FeaturedProgramCard) it is overridden to `rgba(255,255,255,0.9)` inline, with the track overridden to `rgba(0,0,0,0.25)`.

### Feedback cues

| Class | Purpose |
|---|---|
| `.feedback-cue-wrap` | Container — `--bg-input` background |
| `.feedback-cue-text` | Primary cue text — `15px 600` |
| `.feedback-cue-list` | List container |
| `.feedback-cue-item` | Row with coloured dot + text |
| `.feedback-cue-dot` | 8×8px circle; colour set by severity (`--color-good` or `--color-warn`) |

---

## 14. Session Side Panel

`src/components/ui/SessionSidePanel.tsx` is the right column of the camera page. It contains four sections — all built with `.card` and design-system tokens:

1. **Form score** — `formScore` displayed at 28px tabular; `form-gauge-track` + `form-gauge-fill`; list of `feedback-cue-item` rows or a single `feedback-cue-text`
2. **Exercise picker** — `2×3 grid` of `<button>` elements; active state uses `1.5px solid var(--accent)` border + `--accent-muted` background + `--accent` text
3. **Voice cues toggle** — 44×26px pill switch; thumb slides via `left` CSS transition
4. **End session & save** — `.btn.btn-primary.btn-full`; disabled when `!isCameraRunning`

Props: `exercises`, `selectedExercise`, `onExerciseChange`, `formScore`, `topCues`, `primaryCue`, `voiceEnabled`, `onVoiceToggle`, `onSave`, `isCameraRunning`.

---

## 15. Profile Hub

The profile page (`app/profile/page.tsx`) is a 2-column desktop layout using `.social-desktop-grid`.

### Left column (`.social-col-left`)

```
.profile-header          ← centred column: avatar, name, handle, tier badge
  .avatar-placeholder-lg ← 80px initials circle
  .profile-name          ← 20px 700
  .profile-handle        ← 13px secondary
  .tag-lime / .tag-dark  ← "Pro" or "Free plan" badge
.stats-highlight-card    ← flex row: Friends / Following / Followers
  .stats-highlight-value ← 22px 700 tabular
  .stats-highlight-label ← 13px secondary
```

### Right column (`.social-col-right`)

Tab bar: underline style — `border-bottom: 2px solid var(--accent)` active indicator, `border-bottom: 2px solid transparent` inactive. Buttons use `flex: 1` to fill the bar.

**AccountTab** — cards built with `.card`:
- Username field: `className="form-input"`
- Theme toggle: `3×1 grid` of buttons, active = `1.5px solid var(--accent)` + `--accent-muted` background + `--accent` text + `--accent` icon
- Change password: `.list-row` expandable row with `ChevronRight` icon
- Delete account: button with `border: 1px solid var(--danger)`, `color: var(--danger)`

**SocialTab** — search uses `className="form-input"`, Alert button uses `className="btn btn-secondary"`, initials use `.avatar-placeholder`

**AlertsTab** — notification rows built inline (not `NotificationItem`); Accept button = `btn btn-secondary`, Decline = `btn btn-ghost`

---

## 16. Programs

`ProgramGrid` (`app/programs/ProgramGrid.tsx`) renders a filter row + optional featured card + 2-column grid.

### Filter pills

Active pill: `className="tag tag-lime"` + `border: 'none'` inline.
Inactive pill: `className="tag tag-outline"`.

### FeaturedProgramCard (in-progress)

`.card` with `style={{ background: diff.gradient }}`. White text throughout. Track: `rgba(0,0,0,0.25)`. Fill: `rgba(255,255,255,0.9)`. CTA: `btn btn-dark`.

### ProgramCard (grid item)

- Gradient header with difficulty colour + Lucide icon
- Equipment labels: `<span className="tag tag-dark">`
- CTA: `btn btn-primary` (in progress) or `btn btn-ghost` (not started)
- Grid: `gridTemplateColumns: 'repeat(2, 1fr)'`

### AIPlanCard

Last item in the grid. `border: '1px dashed var(--border)'` (inline). Hover changes border to `var(--accent)` via `onMouseEnter/Leave`. Label: `<span className="tag tag-lime">Generate with AI</span>`.

---

## 17. Nutrition

`NutritionClient` renders a 2-column layout on desktop (`.nutrition-desktop-grid`).

### Left column

- **Calories hero**: `40px` tabular lime number; `form-gauge-track` + `form-gauge-fill` (background `--accent`) for daily progress
- **Macros**: existing `MacroSummary` (when goals set) or `.nutrition-macro-bar` grid with `.accent` variant on Protein item
- **Recent searches**: `.tag-dark` pill buttons that re-run the search on click
- **Food search results**: `<div className="nutrition-food-result">` — name/brand left, `btn btn-ghost` "+ Log" right

### Right column

- **Meal log tabs**: inline 3-button row (`Breakfast / Lunch / Dinner`), `flex: 1` per button; active = `--accent` background + `--text-on-lime`, inactive = `--bg-input`
- **Log rows**: `.nutrition-log-item`
- **Empty state**: text + `btn btn-ghost` "+ Add"

| Class | Purpose |
|---|---|
| `.nutrition-macro-bar` | 2-col grid (4-col on desktop) |
| `.nutrition-macro-item` | Macro card; `.accent` variant = lime background |
| `.nutrition-food-result` | Search result row — hover `--border-active` |
| `.nutrition-log-item` | Meal entry row with bottom border |

---

## 18. Stat & Metric Components

| Class | Usage |
|---|---|
| `.stat-grid` | 2-col grid (4-col desktop) for dashboard stats |
| `.stat-card` | Stat with `.stat-card-value` (28px bold) + `.stat-card-label` |
| `.metric-grid` | 2-col grid for nutrition metrics |
| `.metric-card` | Card with icon, label, value, unit |
| `.metric-row` | Horizontal label:value row with bottom border |
| `.list-row` | 56px row — flex, `justify-between`, hover highlight |
| `.list-row-left` | Left slot — flex, gap 12px, 15px text |
| `.list-row-right` | Right slot — muted chevron/icon |

---

## 19. Calendar

| Class | Purpose |
|---|---|
| `.calendar-strip` | Horizontally scrollable day strip |
| `.calendar-day` | Individual day chip — rounded, 52px min-width |
| `.calendar-day.active` | Accent background |
| `.calendar-shell` | Wrapper for the month grid view |
| `.schedule-item` | Event row — icon square, title, meta |

Month header: `currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })` on a `<strong suppressHydrationWarning>` to prevent server/client locale mismatch.

---

## 20. Auth Pages

`.auth-page` centres content with `place-items: center` on a full-viewport canvas. `.auth-card` is a centred card (`max-width: 520px`).

| Class | Purpose |
|---|---|
| `.auth-input` | `height: 52px` input with focus glow |
| `.auth-submit` | Full-width accent submit button |
| `.auth-inline-link` | Accent-coloured inline text link/button |

---

## 21. Animations

| Keyframe / class | Effect |
|---|---|
| `@keyframes lime-pulse` / `.recording-indicator` | Expanding lime glow ring on live-session indicator |
| `@keyframes rep-pop` / `.rep-counted` | Scale + accent flash on rep completion |
| `@keyframes ready-flash` / `.calibration-ready` | Opacity flash (×2) on calibration pass |
| `@keyframes cue-up` / `.feedback-cue` | Slide-up + fade-in for new cues |
| `@keyframes pulse-dot` | Live dot opacity + glow pulse (1.4s infinite) |
| `SessionSummaryPanel AnimatedScore` | RAF ease-out-cubic JS counter — 0 → final score over 800ms |

---

## 22. FAB

`.fab` — 54×54px circle, `position: fixed; bottom: 88px; right: 20px`, `--accent` background, `z-index: 99`. On desktop: `bottom: 40px; right: 40px`.

---

## 23. Hydration Safety Rules

Components that render time- or locale-dependent content must handle the server/client mismatch:

| Pattern | When to apply |
|---|---|
| `suppressHydrationWarning` on the element | `toLocaleDateString()`, `toLocaleString()`, `toLocaleTimeString()` with any locale (including `undefined` or `'default'`) — output differs between Node.js and browsers |
| `const [now] = useState(() => Date.now())` | `Date.now()` used for chart coordinates — freezes to the server's render time so both renders produce the same SVG attribute values |
| `const [mounted, setMounted] = useState(false)` guard | Auth-dependent conditional rendering (e.g. Navbar logout button vs sign-in link) — server always renders the unauthenticated state; client switches after mount |
| `<Suspense>` wrapper | Any `'use client'` component that calls `useSearchParams()` — required by Next.js 14 App Router for static page generation |

---

## 24. Inline Styles vs CSS Classes

- **Use a CSS class** for reusable patterns shared across pages (buttons, cards, inputs, nav items, camera HUD, tags).
- **Use inline `style={}`** for one-off data-driven values: progress bar widths (`width: \`${pct}%\``), gradient backgrounds from data, hover effects in single-use components.

Components that are intentionally self-contained and use inline styles almost exclusively: `ProgramCard`, `ProgramGrid`, `FeaturedProgramCard`, `AIPlanCard`, `SessionSidePanel`, `MuscleHeatmap`, `SessionSummaryPanel`, profile hub tab content.
