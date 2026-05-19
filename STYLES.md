# FormFixer — Styles Reference

All styling lives in a single file: `src/styles/globals.css`. There is no CSS Modules, Tailwind, or styled-components. Components use a mix of named CSS classes from this file and inline `style={}` props for one-off values.

---

## 1. Design Tokens (CSS Custom Properties)

All tokens are defined on `:root`. Override them in a theme block (`[data-theme="dark"]` etc.) to change the entire app's appearance.

### Backgrounds

| Variable | Default value | Purpose |
|---|---|---|
| `--bg-app` | `#101010` | Page root background |
| `--bg-screen` | `#1A1A1A` | Content area / navbar background |
| `--bg-card` | `#1D1D1D` | Card surface |
| `--bg-card-raised` | `#252525` | Elevated card / hover state |
| `--bg-input` | `#2A2A2A` | Input fields, ghost buttons |

### Accent (primary brand colour)

| Variable | Default value | Purpose |
|---|---|---|
| `--accent` | `#D5FF5F` | Lime green — primary CTA, active states, data highlights |
| `--accent-dim` | `#B8E04A` | Hover / pressed accent |
| `--accent-muted` | `rgba(213,255,95,0.12)` | Tinted background for accent areas |
| `--accent-glow` | `0 0 20px rgba(213,255,95,0.25)` | Box-shadow glow on accent elements |

### Text

| Variable | Default value | Purpose |
|---|---|---|
| `--text-primary` | `#F7FBFF` | Body copy, headings |
| `--text-secondary` | `#8A8A8A` | Labels, subtitles |
| `--text-muted` | `#555555` | Placeholder, disabled, de-emphasised |
| `--text-on-lime` | `#101010` | Text rendered on top of `--accent` backgrounds |
| `--text-lime` | `#D5FF5F` | Accent-coloured text on dark backgrounds |

### Semantic colours

| Variable | Default | Meaning |
|---|---|---|
| `--color-good` | `#D5FF5F` | Success / healthy form |
| `--color-warn` | `#FF6B6B` | Warning / form error (red) |
| `--color-neutral` | `#555555` | Neutral / inactive |
| `--danger` | `#FF6B6B` | Destructive actions |

### Borders & Shadows

| Variable | Default value |
|---|---|
| `--border` | `rgba(255,255,255,0.07)` |
| `--border-active` | `rgba(213,255,95,0.4)` — accent-tinted focus ring |
| `--shadow-card` | `0 4px 24px rgba(0,0,0,0.4)` |
| `--shadow-lime` | `0 4px 20px rgba(213,255,95,0.2)` |
| `--shadow-fab` | `0 4px 20px rgba(0,0,0,0.6)` |

### Font sizes

```css
--font-size-xs: 0.75rem
--font-size-sm: 0.875rem
--font-size-md: 1rem
--font-size-lg: 1.125rem
--font-size-xl: clamp(1.5rem, 2.5vw, 2rem)
```

### Backwards-compat aliases

Several older inline references use `--bg`, `--surface`, `--muted`, `--primary`, `--radius` etc. These are re-declared as aliases in `:root` so existing code doesn't break. Prefer the canonical names above for any new work.

---

## 2. Theme System

The active theme is controlled by a `data-theme` attribute on `<html>`. It is set before React hydrates via an inline `<script>` in `<head>` (FOUC prevention) and maintained by `useTheme()` in `src/lib/theme/useTheme.ts`.

### Available themes

| `data-theme` value | Accent | Backgrounds | Text |
|---|---|---|---|
| *(none / default)* | Lime `#D5FF5F` | Dark grey scale (`#101010`–`#252525`) | Near-white `#F7FBFF` |
| `dark` | Green `#22c55e` | Slightly darker grey (`#0f0f0f`–`#222222`) | Soft white `#f0f0f0` |
| `gym` | Neon `#00ff88` | True black (`#000000`–`#111111`) | Pure white; larger HUD font |

### Switching themes

`useTheme(userId)` returns `{ theme, cycleTheme }`. Calling `cycleTheme()` steps through `light → dark → gym → light`. The theme is persisted to `localStorage` and synced to `profiles.theme_preference` in Supabase.

### FOUC prevention

An inline `<script>` in `app/layout.tsx` reads `localStorage` and calls `document.documentElement.setAttribute('data-theme', ...)` synchronously before the page paints.

### Transition suppression

All elements have CSS transitions on `background-color`, `border-color`, and `color`. When the theme cycles, `data-theme-changing` is briefly set on `<html>` (removed after two `requestAnimationFrame` ticks), which strips all transitions during the switch to avoid a visible flash.

```css
[data-theme-changing] *, [data-theme-changing] *::before, [data-theme-changing] *::after {
  transition: none !important;
}
```

---

## 3. Typography

**Font:** Poppins (Google Fonts, weights 200–800). Falls back to `-apple-system, BlinkMacSystemFont, sans-serif`.

Base: `font-size: 16px`, `line-height: 1.4`, `-webkit-font-smoothing: antialiased`.

Headings (`h1`–`h6`) are reset to `font-weight: 700; letter-spacing: -0.01em; margin: 0`.

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

`.page-container` is the main content wrapper:
- Mobile: `max-width: 430px`, `padding-top: 68px` (clears fixed navbar), `padding-bottom: 88px` (clears bottom tab nav)
- Tablet (≥640px): `max-width: 520px`, wider horizontal padding
- Desktop (≥1024px): `max-width: 1280px`, `padding-top: 88px`, `padding-bottom: 60px`, transparent background (body shows instead)
- Wide (≥1440px): `max-width: 1400px`, `padding: 0 80px`

### Section helpers

| Class | Effect |
|---|---|
| `.ui-section` | `flex column; gap: 16px` — standard section spacing |
| `.section-gap` | `margin-bottom: 16px` |
| `.ui-section-title` | `20px bold` section heading |
| `.ui-section-subtitle` | `13px secondary` subtitle |
| `.ui-section-description` | `13px secondary` description under title |
| `.desktop-centered-col` | `width: 100%; flex column; gap: 16px` — on desktop: `max-width: 720px; margin: auto` |

### Page layout grids

| Class | Mobile | Desktop (≥1024px) |
|---|---|---|
| `.camera-page-layout` | `flex column; gap: 16px` | `grid 1fr 400px; gap: 24px` |
| `.dashboard-desktop-grid` | `flex column; gap: 16px` | `grid 1fr 380px; gap: 24px` |
| `.nutrition-desktop-grid` | `flex column; gap: 16px` | `grid 1fr 1fr; gap: 24px` |
| `.social-desktop-grid` | `flex column; gap: 16px` | `grid 1fr 1fr; gap: 24px` |

`.desktop-only` is `display: none !important` on mobile; `display: block !important` on desktop.

---

## 5. Navbar

The navbar is a fixed top bar (`z-index: 100`). It has two visual modes:

### Mobile (< 1024px)

- Height: `60px`
- Left: `.navbar-user` — avatar placeholder + greeting text
- Right: `.navbar-end` — theme toggle + sign-in/logout button + profile avatar circle

### Desktop (≥ 1024px)

- Height: `64px`, `padding: 0 60px` (80px at ≥1440px)
- Left: `.navbar-brand-wrap` — "FormFixer" wordmark in accent colour
- Centre: `.desktop-nav-links` — horizontal pill-shaped nav links
- Right: `.navbar-end` — theme toggle + profile avatar circle

Mobile-only elements (`.navbar-user`, `.navbar-bell-btn`) are hidden via `display: none` at ≥1024px. `.navbar-brand-wrap` and `.desktop-nav-links` are hidden on mobile and revealed with `display: flex !important` at ≥1024px.

### Profile avatar

The profile avatar is a 34×34px circle rendered inline in `.navbar-end` via `style={}` in `Navbar.tsx`. It shows user initials, highlights with `--accent` background when `/profile` is the active route, and links to `/profile`.

### Relevant classes

| Class | Purpose |
|---|---|
| `.navbar` | Fixed top bar |
| `.navbar-end` | Right slot — flex row, gap 8px |
| `.navbar-auth-btn` | Sign in / Log out pill button |
| `.navbar-brand-wrap` | Desktop wordmark link |
| `.desktop-nav-links` | Centred horizontal nav link container |
| `.desktop-nav-link` | Individual nav link pill |
| `.desktop-nav-link.active` | Accent colour + accent-muted background |

---

## 6. Bottom Tab Nav (mobile)

`.bottom-nav` is a fixed `72px` bar at the bottom of the screen on mobile (hidden at ≥1024px). Safe-area inset is respected via `padding-bottom: env(safe-area-inset-bottom)`.

Four tabs: Dashboard, Camera, Programs, Nutrition. Profile was moved to the navbar avatar.

| Class | Purpose |
|---|---|
| `.bottom-nav` | Fixed bottom bar |
| `.nav-item` | Individual tab — icon + label |
| `.nav-item.active` | Accent colour; icon gets a subtle `drop-shadow` glow |
| `.nav-badge` | Small red dot (for unread counts) |

---

## 7. Cards

| Class | Description |
|---|---|
| `.card` | Standard card — `border-radius: 20px`, `padding: 20px`, `box-shadow: var(--shadow-card)` |
| `.card-raised` | `bg-card-raised` background |
| `.card-accent` | Accent-colour background (values inside use `--text-on-lime`) |
| `.ui-card` | Alias for `.card` used in some older components |

On pointer-capable devices (`:hover`), `.card` and `.ui-card` lift `2px` and brighten on hover.

The `<Card>` React component in `src/components/ui/Card.tsx` renders a `.card` with an optional title and description.

---

## 8. Buttons

All buttons share `.btn` as a base class. Compose with one variant modifier and optionally `.btn-full`.

```html
<button class="btn btn-primary">Start →</button>
<button class="btn btn-secondary">Cancel</button>
<button class="btn btn-primary btn-full">Save Session</button>
```

| Modifier | Background | Text |
|---|---|---|
| `.btn-primary` | `--accent` (lime / green / neon) | `--text-on-lime` |
| `.btn-secondary` | `--bg-card` + `--border` outline | `--text-primary` |
| `.btn-ghost` | `--bg-input` | `--text-primary` |
| `.btn-dark` | `--bg-card-raised` | `--text-primary` |

Base `.btn` dimensions: `height: 52px`, `border-radius: 999px`, `padding: 0 28px`. On desktop (≥1024px), height drops to `44px` and font to `14px`.

The `<Button>` React component in `src/components/ui/Button.tsx` wraps these classes with a `variant` prop (`'solid' | 'ghost'`).

### Camera-specific buttons

| Class | Purpose |
|---|---|
| `.cam-main-btn` | Full-width `56px` rounded-rect start/stop button |
| `.cam-main-btn-start` | Accent fill — "Start Camera" |
| `.cam-main-btn-stop` | Red tint — "Stop / Save" |
| `.cam-ctrl-btn` | Secondary control buttons (Reset, Save) in a row |

---

## 9. Forms

| Class | Purpose |
|---|---|
| `.form-input` | Standard text input — `height: 48px`, `border-radius: 12px`, `--bg-input` |
| `.form-label` | `flex column; gap: 6px; font-size: 13px` wrapper for label + input pairs |
| `.exercise-select` | Styled `<select>` with custom SVG chevron, `height: 48px` |
| `.field-group` | Alias used in `SendInviteCard` — same visual pattern as `.form-label` |

Focus state for `.form-input` and `.exercise-select`: `border-color: var(--border-active)`.

Auth-specific inputs use `.auth-input` (taller at `52px`, with a focus glow ring).

---

## 10. Tags / Pills

| Class | Background | Text |
|---|---|---|
| `.tag` | Base — `padding: 5px 12px; border-radius: 999px; font-size: 11px bold` | — |
| `.tag-lime` | `--accent` | `--text-on-lime` |
| `.tag-dark` | `--bg-input` + `--border` | `--text-secondary` |
| `.tag-outline` | Transparent + `--border` | `--text-secondary` |

---

## 11. Avatar

| Class | Size |
|---|---|
| `.avatar-sm` | 44×44px |
| `.avatar-md` | 56×56px |
| `.avatar-lg` | 80×80px |
| `.avatar-placeholder` | 44×44px initials circle — `--accent-muted` background, `--accent` text |
| `.avatar-placeholder-lg` | 80×80px version |

The profile page uses an inline `style={}` avatar with `background: var(--accent)` to make the initials circle use the full accent colour instead of the muted tint.

---

## 12. Camera / Session HUD

All HUD elements are `position: absolute` children of `.camera-preview`.

### Preview container

| Class | Description |
|---|---|
| `.camera-preview` | `aspect-ratio: 3/4`, `border-radius: 20px`, `overflow: hidden` |
| `.camera-preview video` | `position: absolute; inset: 0; object-fit: cover` |
| `.camera-preview canvas` | Same as video, `z-index: 2` (pose overlay) |
| `.camera-preview-wrap` | Flex wrapper that stretches the preview to fill a column on desktop |

### HUD overlays

| Class | Position | Purpose |
|---|---|---|
| `.cam-hud` | base | Shared: `position: absolute; left/right: 12px; border-radius: 11px` |
| `.cam-hud-top` | `top: 12px` | Legacy status banner with blur backdrop |
| `.cam-hud-status` | `top: 68px` | Current status banner (sits below exercise picker) |
| `.cam-hud-status.cam-hud-ready` | — | Accent-tinted — calibration passed |
| `.cam-hud-status.cam-hud-warn` | — | Red-tinted — pose issue warning |
| `.cam-hud-bottom` | `bottom: 14px` | Bottom stats panel with blur backdrop |

### Exercise picker

| Class | Purpose |
|---|---|
| `.cam-hud-exercise` | Absolute-positioned container at `top: 14px` |
| `.cam-exercise-pill` | Styled `<select>` — dark glass, custom SVG chevron |
| `.cam-live-badge` | "● LIVE" badge — accent-tinted |
| `.cam-live-dot` | Pulsing dot inside the LIVE badge |

### HUD stats

| Class | Purpose |
|---|---|
| `.cam-stats-row` | Flex row of stat cells |
| `.cam-stat` | Individual stat cell — semi-transparent background |
| `.cam-stat-lime` | Accent-background variant (rep count) |
| `.cam-stat-val` | Large bold tabular value |
| `.cam-stat-lbl` | Tiny uppercase label |

### Session stat pills (outside camera preview)

`.stat-pill` / `.session-stat-pill` — card-style pills with value + label, `.dark` / `.lime` modifier for accent fill.

### Form gauge

| Class | Purpose |
|---|---|
| `.form-gauge-wrap` | Padding wrapper |
| `.form-gauge-track` | `height: 10px` rounded track |
| `.form-gauge-fill` | Animated fill bar (`transition: width 0.3s`) |

### Feedback cues

| Class | Purpose |
|---|---|
| `.feedback-cue-wrap` | Container — `--bg-input` background |
| `.feedback-cue-text` | Primary cue text — `15px 600` |
| `.feedback-cue-item` | Individual cue in a list with a coloured dot |
| `.feedback-cue-dot` | 8×8px circle — colour set by severity |

---

## 13. Stat & Metric Components

| Class | Usage |
|---|---|
| `.stat-grid` | 2-col grid (4-col on desktop) for dashboard stats |
| `.stat-card` | Individual stat with `.stat-card-value` (28px bold) + `.stat-card-label` |
| `.metric-grid` | 2-col grid for nutrition metrics |
| `.metric-card` | Card with icon circle, label, large value, unit |
| `.metric-row` | Horizontal label:value row with a bottom border |
| `.list-row` | 56px row with left+right slots; hover highlight |

---

## 14. Profile & Social

| Class | Purpose |
|---|---|
| `.profile-header` | Centred column — avatar, name, handle, tier badge |
| `.stats-highlight-card` | Horizontal stat row — friends / following / followers |
| `.stats-highlight-value` | `22px bold tabular` stat number |

The profile page itself uses a tab bar built with inline `style={}` and a `border-bottom: 2px solid var(--accent)` active indicator.

---

## 15. Nutrition

| Class | Purpose |
|---|---|
| `.nutrition-macro-bar` | 2-col grid (4-col on desktop) |
| `.nutrition-macro-item` | Individual macro card; `.accent` variant uses lime background |
| `.nutrition-search-bar` | `flex; gap: 8px` search row |
| `.nutrition-search-input` | `height: 50px; border-radius: 14px` input |
| `.nutrition-search-btn` | Accent square button |
| `.nutrition-food-result` | Clickable result row — hover highlights with `--border-active` |
| `.nutrition-log-item` | Meal entry row with bottom border |

---

## 16. Calendar

| Class | Purpose |
|---|---|
| `.calendar-strip` | Horizontally scrollable day strip |
| `.calendar-day` | Individual day chip — rounded, 52px min-width |
| `.calendar-day.active` | Accent background |
| `.schedule-item` | Event row — icon square, title, meta, action link |
| `.calendar-shell` | Wrapper that applies the app palette to FullCalendar |

---

## 17. Auth Pages

`.auth-page` centres content with CSS Grid `place-items: center` on a full-viewport canvas. `.auth-card` is a centred card (`max-width: 520px`).

| Class | Purpose |
|---|---|
| `.auth-input` | `height: 52px` input with focus glow |
| `.auth-submit` | Full-width `height: 52px` accent submit button |
| `.auth-inline-link` | Accent-coloured inline text button |

---

## 18. Animations

| Keyframe / class | Effect |
|---|---|
| `@keyframes lime-pulse` / `.recording-indicator` | Expanding lime glow ring — used on live-session indicator |
| `@keyframes rep-pop` / `.rep-counted` | Scale + accent colour flash on rep completion |
| `@keyframes ready-flash` / `.calibration-ready` | Opacity flash (×2) when calibration passes |
| `@keyframes cue-up` / `.feedback-cue` | Slide-up + fade-in for new feedback cues |
| `@keyframes pulse-dot` | Live dot opacity + glow pulse (1.4s, infinite) |
| `SessionSummaryPanel AnimatedScore` | RAF-based ease-out-cubic counter (JS, not CSS) — animates the session score from 0 to the final value over 800ms |

---

## 19. FAB (Floating Action Button)

`.fab` — 54×54px circle, `position: fixed; bottom: 88px; right: 20px`, accent background, `z-index: 99`. On desktop it moves to `bottom: 40px; right: 40px`.

---

## 20. Home / Marketing Page

Classes prefixed `.home-` apply only to the `(marketing)/page.tsx` landing page. They are scoped to `.home-page` and use the same design tokens as the app.

Key patterns:
- `.home-hero` — full-viewport hero section with a radial lime glow pseudo-element
- `.home-hero-h1` — `clamp(2.6rem, 6vw, 5rem)` responsive headline
- `.home-cta-primary` / `.home-cta-secondary` — hero CTA pill buttons
- `.home-camera-mockup` — decorative phone mockup with pose overlay

---

## 21. Inline Styles vs CSS Classes

The codebase mixes named classes with inline `style={}`. The convention is:

- **Use a CSS class** for reusable patterns that appear on multiple pages (buttons, cards, nav items, form inputs, camera HUD).
- **Use inline `style={}`** for one-off values that are local to a single component (specific widths, colours derived from data, dynamic values like progress bar percentages, hover effects in small components like `ProgramCard`).

The `ProgramGrid`, `MuscleHeatmap`, `SessionSummaryPanel`, and the profile hub tabs all use inline styles almost exclusively — they are self-contained and their styles are not shared elsewhere.
