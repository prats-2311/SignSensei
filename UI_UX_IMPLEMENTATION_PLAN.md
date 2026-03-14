# SignSensei — Premium UI/UX Implementation Plan

> **Last Updated:** 2026-03-14  
> **Status:** Planning — Awaiting Phase 1 approval  
> **Design Session Summary:** Full codebase analysis + screenshot audit completed. Mascot chosen (cosmic purple ILY hand with tiny palm-face eyes). PWA icon designed. Phased plan agreed upon.

---

## 🎯 Core Design Decisions (Locked)

| Decision | Choice |
|---|---|
| **Color palette** | Dark cosmic — deep indigo/purple (`#0f0c29` → `#302b63` → `#0A0A0F`) |
| **Mascot** | Cosmic purple ILY-sign hand with tiny glowing eyes on palm |
| **Logo/PWA icon** | Same ILY hand mascot, with purple glow on dark background |
| **Typography** | Outfit (sans) — must be properly loaded from Google Fonts |
| **Card system** | Glassmorphism only — `bg-white/5 backdrop-blur-xl border-white/10` |
| **Layout** | Three-column on `md:` (sidebar + content + right rail), bottom nav on mobile |
| **Orientation** | Portrait + Landscape (`"orientation": "any"` in manifest) |
| **Mascot engine** | Framer Motion (Phase 1), Rive upgrade (future) |
| **Solarized tokens** | Completely replaced with dark theme |

---

## 📋 Phase Overview

| Phase | Name | Scope | User Check-in |
|---|---|---|---|
| **1** | Design Foundation | Tokens, fonts, PWA icons, shared components, PWA polish | ✅ Required after Phase 1 |
| **2** | Mascot & Emotion System | Hand mascot component, all emotion states, placement across app | ✅ Required after Phase 2 |
| **3** | Layout Revolution | Three-column layout, sidebar nav, decks cards, lesson node overhaul | ✅ Required after Phase 3 |
| **4** | New Screens & Features | Splash screen, onboarding tour, profile screen | ✅ Required after Phase 4 |
| **5** | LiveSession UX Overhaul | Landscape mode, PiP camera, unified glassmorphism card | ✅ Required after Phase 5 |

---

---

# PHASE 1 — Design Foundation

> **Goal:** Every screen should feel like it belongs to a single premium dark app before we add any new features.  
> **Principle:** Foundation first. Everything else depends on this being correct.

## 1.1 — CSS Design Token Overhaul

**File:** `frontend/src/index.css`

**Problem:** The CSS uses Solarized color tokens (`#fdf6e3` cream background, `#073642` dark teal foreground) that conflict with the hardcoded dark galaxy UI in `App.tsx`. The result: cream cards floating on a black screen.

**What to change:**
- Replace `:root` and `.dark` token blocks entirely
- New dark theme as the **one and only theme** (no light mode — this is a dark-first PWA)
- Token set:

```css
:root {
  /* Backgrounds */
  --background: #0A0A0F;           /* Pure cosmic black */
  --background-elevated: #12111a;  /* Slight elevation */
  
  /* Card surfaces (glassmorphism) */
  --card: rgba(255,255,255,0.05);  /* Transparent glass */
  --card-border: rgba(255,255,255,0.1);
  --card-foreground: #e8e6f0;
  
  /* Brand */
  --primary: #a855f7;              /* Purple-500 */
  --primary-foreground: #ffffff;
  --primary-glow: rgba(168,85,247,0.4);
  
  --secondary: #6366f1;            /* Indigo-500 */
  --secondary-foreground: #ffffff;
  
  /* Accent */
  --accent: #c084fc;               /* Purple-400 */
  --accent-foreground: #ffffff;
  
  /* Feedback */
  --success: #4ade80;              /* Green-400 */
  --error: #f87171;                /* Red-400 */
  --warning: #facc15;              /* Yellow-400 */
  
  /* Text */
  --foreground: #e8e6f0;           /* Off-white */
  --muted: #4a4a6a;                /* Dark muted */
  --muted-foreground: #9898b8;     /* Muted text */
  
  /* Border */
  --border: rgba(255,255,255,0.1);
  
  /* XP / Streak / Gems (gamification) */
  --xp-color: #a855f7;
  --streak-color: #f97316;         /* Orange-500 */
  --gem-color: #60a5fa;            /* Blue-400 */
  
  /* Radius */
  --radius: 1rem;                  /* 16px — rounded-2xl is the base */
  --radius-lg: 1.5rem;             /* 24px — rounded-3xl */
  --radius-full: 9999px;           /* pill shapes */
  
  /* Font */
  --font-sans: 'Outfit', system-ui, sans-serif;
  --font-mono: 'Space Mono', monospace;
}
```

**Remove:** The `.dark {}` block — there is only one theme now.

---

## 1.2 — Google Fonts Loading

**File:** `frontend/index.html`

**Problem:** `Outfit` and `Space Mono` are referenced in CSS tokens but never imported. The app is using system fonts silently falling back.

**Add to `<head>`:**
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
```

Also add:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
```
> The `viewport-fit=cover` is critical for the iPhone notch and home indicator safe area.

---

## 1.3 — PWA Icon Replacement

**Directory:** `frontend/public/`

**Problem:** Current icons use a closed-fist gradient hand that doesn't match the new mascot. We have the new ILY cosmic hand icon designed.

**What to replace:**
- `icon-512x512.png` → New ILY hand mascot, dark indigo background, purple glow (generated)
- `icon-192x192.png` → Same, resized to 192×192
- `apple-touch-icon.png` → Same, resized to 180×180 (iOS crops to rounded square automatically)
- `favicon-32x32.png` → Simplified hand silhouette at 32px
- `favicon-16x16.png` → Ultra-simplified — just the 3-finger ILY silhouette

**`manifest.json` updates:**
```json
{
  "orientation": "any",            // Was "portrait" — unlock landscape
  "background_color": "#0A0A0F",   // Already correct
  "theme_color": "#a855f7"         // Update to new primary purple-500
}
```

---

## 1.4 — Global Background & Body Reset

**File:** `frontend/src/index.css` (add to base layer)

**Problem:** `overflow: hidden` on `AppContent` conflicts with PWA scroll. Body has no default background so white flashes occur before React renders.

**Add:**
```css
@layer base {
  html, body, #root {
    height: 100%;
    min-height: 100dvh;            /* Dynamic viewport — fixes iOS Safari bar */
    background-color: var(--background);
    -webkit-tap-highlight-color: transparent;  /* Remove blue flash on tap */
    -webkit-overflow-scrolling: touch;          /* Momentum scroll on iOS */
    overscroll-behavior: none;                  /* Prevent pull-to-refresh on map */
  }

  * {
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* Safe area utilities for iPhone notch + home indicator */
  .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
  .pt-safe { padding-top: env(safe-area-inset-top); }
  .px-safe { 
    padding-left: env(safe-area-inset-left);
    padding-right: env(safe-area-inset-right);
  }
}
```

**`App.tsx` fix:** Remove `overflow-hidden` from root `AppContent` div. Replace `min-h-screen` with `min-h-dvh` throughout.

Also: Move the animated gradient background OUT of `MapScreen` and into the **global `AppContent` wrapper** so all screens share the same cosmic background:
```tsx
// AppContent — always render the cosmic gradient background
<div className="fixed inset-0 -z-10 bg-[#0A0A0F]">
  <div className="absolute inset-0 bg-gradient-to-b from-[#0f0c29] via-[#302b63] to-[#24243e]" />
  <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
  <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-indigo-500/10 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '12s' }} />
</div>
```

---

## 1.5 — Shared Component Library Expansion

**Directory:** `frontend/src/shared/ui/`

New components to build:

### 1.5.1 — `GlassCard.tsx`
The glassmorphism card system. Replaces `Card.tsx`'s flat solarized shadow.

```
Variants:
  - "base"     → bg-white/5 backdrop-blur-md border-white/10
  - "elevated" → bg-white/10 backdrop-blur-xl border-white/15 shadow-2xl
  - "surface"  → bg-white/3 border-white/5 (for inner nested cards)
```

### 1.5.2 — `Badge.tsx`
Replaces the inline `div` gamification badges in the header (XP, Streak, Gems).

```
Props: icon, value, color (xp | streak | gem | custom)
```

Example output:
```
[ 🔥 7 ]  [ 💎 50 ]  [ ⭐ Lvl 1 ]
```
Each badge: `bg-white/8 border border-white/10 rounded-full px-3 py-1.5` with a subtle glow matching the badge color.

### 1.5.3 — `Input.tsx`
The AI lesson generator currently uses inline-styled `<input>` elements. Extract to a reusable component.

```
Props: placeholder, value, onChange, onKeyDown, rightElement, disabled
```

### 1.5.4 — `Modal.tsx` (Dialog)
Replaces ALL inline modal-building (`referenceSign` modal in `App.tsx`, custom overlays).

```
Props: isOpen, onClose, title, children, size (sm | md | lg | fullscreen)
Features:
  - Focus trap (Tab key cycles within modal)
  - Escape key closes
  - Background scroll lock (body overflow-hidden when open)
  - Backdrop click closes (optional)
  - Entry animation: zoom-in + fade-in
```

### 1.5.5 — `Toast.tsx` + `useToast.ts` hook
Replaces ALL `alert()` and `window.confirm()` calls.

```
Types: success | error | info | warning
Position: bottom-center (above bottom nav)
Duration: auto-dismiss at 4s, with manual close X
```

### 1.5.6 — `ConfirmDialog.tsx`
Replaces `window.confirm()` in `DecksScreen` (delete deck).

```
Props: isOpen, title, message, onConfirm, onCancel, confirmLabel, confirmVariant (danger | primary)
```

### 1.5.7 — `Skeleton.tsx`
Loading placeholder for decks, profile data, etc.

```
Variants: text (one line), card (full card), avatar (circle)
Built with Tailwind's animate-pulse
```

### 1.5.8 — `ProgressBar.tsx` Updates
Existing component needs:
- `role="progressbar"` + `aria-valuenow` + `aria-valuemin` + `aria-valuemax`
- Size variants: `sm` (h-1), `md` (h-2, current), `lg` (h-4)
- Color should use CSS variable, not inline `style`

---

## 1.6 — Header Overhaul

**File:** `frontend/src/App.tsx` — `<header>` section  

**Problem:** Uses `bg-background/50` which resolves to beige from solarized tokens. Needs full redesign with new `Badge` components.

**New header:**
```
[ SignSensei wordmark (Outfit font, purple glow) ]  [ 🔥7 ] [ 💎50 ] [ ⭐Lvl1 ]
```
- Background: `bg-black/30 backdrop-blur-xl border-b border-white/5`
- Height: `h-16` on mobile, `h-0 hidden` on `md:` (sidebar replaces it)

---

## 1.7 — Bottom Nav Overhaul

**File:** `frontend/src/App.tsx` — `<nav>` section

**Problems identified:**
- No text labels
- Wrong active states (Trophy lit on Decks screen — this is a code bug)
- No `safe-area-inset-bottom` padding
- Placeholder 3rd tab
- Fixed height doesn't account for home indicator

**New bottom nav:**
```
[ 🗺️ Learn ] [ 📚 Decks ] [ 👤 Profile ]
```
- Each tab: Icon + Label below, stacked
- Active state: Pill background behind icon+label, `bg-primary/20 border border-primary/30`
- `padding-bottom: max(1rem, env(safe-area-inset-bottom))`
- Fix the active state bug: use `location.pathname` correctly for all 3 tabs
- 3rd tab now links to `/profile` (new screen in Phase 4)

**Icon updates:**
- Map/Home: `MapPin` or `Home` icon (not `Trophy` — Trophy = achievements)
- Decks: `Layers` ✅ (already correct)
- Profile: `User` icon

---

## 1.8 — `App.css` Cleanup

**File:** `frontend/src/App.css`

This file still has Vite's boilerplate CSS (`.logo`, `logo-spin`, `.read-the-docs`). None of it is used. **Delete the entire file contents** and replace with a single comment: `/* Styles live in index.css — this file is intentionally empty */`. Update `main.tsx` if it imports `App.css`.

---

## Phase 1 — Verification Checklist

After Phase 1 is complete, the developer (you) should:

1. **Visual check — Background:** Open every route (`/`, `/decks`, `/lesson/the-basics`). All three should have the same deep indigo cosmic gradient background. No beige/cream should appear anywhere.

2. **Visual check — Cards:** The `LiveSession` card on `/lesson/:id` should be glassmorphism (transparent, blurred), NOT cream/white.

3. **Visual check — Header:** The header bar should be dark semi-transparent, NOT beige. The badges (🔥 Streak, 💎 Gems, ⭐ Level) should appear with the new `Badge` components.

4. **Visual check — Bottom Nav:** Open Decks screen (`/decks`). The **Layers** icon should be active pink, not the Trophy icon.

5. **Font check:** Open browser DevTools → Elements → Inspect any text element → Computed Styles → `font-family` should show `Outfit` (not `system-ui` or a fallback).

6. **PWA check (iPhone):** Delete and reinstall the PWA from home screen. The splash screen should show the new ILY hand mascot icon against the dark background. The browser chrome should be purple (`theme-color: #a855f7`).

7. **Safe area check (iPhone):** At the bottom of the screen, the nav should NOT overlap the home indicator bar. There should be padding below the nav icons.

8. **Tap check (iPhone):** Tap any button quickly. There should be NO blue highlight flash. The button should just animate (scale tap via Framer Motion).

9. **Landscape check:** Rotate the phone. The app should rotate with the device. No forced portrait lock.

10. **Toast check:** In `DecksScreen`, delete a deck. You should see a proper `ConfirmDialog`, not `window.confirm()`.

---

---

# PHASE 2 — Mascot & Emotion System

> **Goal:** The cosmic purple hand mascot appears at key emotional moments throughout the app with contextually appropriate animations and messages.
>
> **Dependency:** Phase 1 must be complete first (the mascot lives on the new glassmorphism surfaces).

## 2.1 — Mascot Assets

**What we have:**
- `public/models/mascot.riv` — a generic car-driving Rive animation. **Discard it for now.**
- Generated image: Cosmic purple ILY hand (celebrate state)
- Generated image: Sad state + 3-star celebrate state comparison

**What we need:**
- Convert generated mascot images into a proper sprite/asset set:
  - `public/mascot/hand-idle.png` — open palm, relaxed
  - `public/mascot/hand-celebrate.png` — ILY sign + sparkles (3-star)
  - `public/mascot/hand-sad.png` — drooping, teardrop (1-star)
  - `public/mascot/hand-hopeful.png` — index finger pointing up (1-star message variation)
  - `public/mascot/hand-oops.png` — wagging index finger (error/wrong sign)
  - `public/mascot/hand-hyped.png` — fist pump / rock-on horns (boss stage / 2-star)
  - `public/mascot/hand-wave.png` — classic wave (greeting / tour guide)
  - `public/mascot/hand-thinking.png` — chin-tap gesture (AI is thinking)

> **Note:** These will be generated for each state and saved as PNG assets during implementation.

---

## 2.2 — `Mascot.tsx` Component

**File:** `frontend/src/shared/ui/Mascot.tsx`

**Core component:**
```typescript
interface MascotProps {
  emotion: 'idle' | 'celebrate' | 'sad' | 'hopeful' | 'oops' | 'hyped' | 'wave' | 'thinking';
  message?: string;        // speech bubble text
  messageType?: 'default' | 'success' | 'error' | 'info';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showBubble?: boolean;
}
```

**Animation variants (Framer Motion):**
```
idle:      gentle up-down float, 2s loop, 4px amplitude
celebrate: scale 1→1.2→1, rotate ±5deg, 0.4s, + sparkle particles
sad:       slow droop (translateY +8px), subtle left-right wobble 1s
hopeful:   tilt right 10deg, slow pulse glow
oops:      fast left-right shake (10px, 0.1s intervals), red tint flash
hyped:     rapid bounce (12px, 0.15s), glow brighten
wave:      rotate wrist-style -15°→+15°, 1s loop
thinking:  slow side-to-side sway, muted purple glow
```

**Speech bubble design:**
- Appears below (or above) the mascot image
- `bg-white/10 backdrop-blur rounded-2xl border border-white/15 px-4 py-3`
- Text in Outfit medium weight, `text-foreground`
- Small triangle pointer connecting to mascot
- Fade-in with 200ms delay after mascot animation starts
- Character limit guideline: max 60 chars (2 lines on mobile)

---

## 2.3 — Emotion-to-Message Mapping

**File:** `frontend/src/shared/lib/mascotMessages.ts`

A lookup table for all contextual messages:

```typescript
export const MASCOT_MESSAGES = {
  // Lesson flow
  word_correct:   { emotion: 'celebrate', messages: ['Nailed it! ✨', 'Perfect sign! 🌟', 'You got it!'] },
  word_incorrect: { emotion: 'oops',      messages: ['Almost! Try again 💪', 'Keep going, you\'re close!'] },
  
  // Boss stage
  boss_entry:     { emotion: 'hyped',     messages: ['Time to put it all together! 👑', 'Final challenge — you\'ve got this!'] },
  
  // Victory scores
  score_1_star:   { emotion: 'sad',       messages: ['You\'ll get them next time 💙', 'Every great signer started here. Keep going!'] },
  score_2_star:   { emotion: 'hopeful',   messages: ['So close to perfect! 🌙', 'Almost there — practice makes permanent!'] },
  score_3_star:   { emotion: 'celebrate', messages: ['FLAWLESS! You\'re incredible! 🌟', 'A natural! ILY! 🤟'] },
  
  // Other moments
  tour_step:      { emotion: 'wave',      messages: [] },  // Per-step messages defined in tour config
  loading:        { emotion: 'thinking',  messages: ['Loading your lesson...', 'Preparing your tutor...'] },
  idle_greeting:  { emotion: 'wave',      messages: ['Welcome back!', 'Let\'s sign something today! 🤟'] },
}
```

One message is picked randomly from the `messages[]` array each time — avoids repetition.

---

## 2.4 — Mascot Placement Map

### A. `VictoryModal.tsx`
- Replace the `<Trophy>` icon at the top with a **large `<Mascot>`** component (`size="xl"`)
- After the star reveal animation completes, mascot animates to its score-based emotion state
- Speech bubble appears with the contextual message (1/2/3 star variants)

### B. `LiveSession.tsx` — Bottom right (replaces broken pink Rive square)
- Small `<Mascot size="sm">` in fixed position
- Emotion driven by `mascotEmotion` in `useLessonStore`
- When `mascotEmotion === 'success'` → celebrate animation then returns to idle
- When `mascotEmotion === 'error'` → oops animation
- Show speech bubble only on non-idle states for 3 seconds, then hide

### C. `App.tsx` — Lesson node on `MapScreen`
- Position mascot **next to the currently active/unlocked node** (like Duolingo's Duo on the path)
- Not floating in the corner — actually sitting beside the node circle
- Idle animation when no lesson is selected
- Wave animation when lesson popup card appears

### D. `SplashScreen.tsx` (new in Phase 4)
- Center stage: `<Mascot size="xl" emotion="wave">` with greeting message
- Loading state transitions to `emotion="thinking"`

### E. Onboarding Tour (Phase 4)
- Mascot appears at each tour step with `emotion="wave"` and step-specific speech bubble content

---

## 2.5 — `useLessonStore.ts` Updates

The `mascotEmotion` field already exists. Extend its type:
```typescript
mascotEmotion: 'idle' | 'success' | 'error' | 'listening' 
// Extend to:
mascotEmotion: 'idle' | 'celebrate' | 'oops' | 'sad' | 'hopeful' | 'hyped' | 'wave' | 'thinking';
```

Update all calls to `setMascotEmotion()` to use the new vocabulary:
- `'success'` → `'celebrate'` 
- `'error'` → `'oops'`
- `'listening'` → `'thinking'`

---

## Phase 2 — Verification Checklist

1. **Complete a word correctly:** Mascot should animate to `celebrate` with a sparkle burst. Speech bubble should show a positive message. Then return to `idle` after 2-3 seconds.

2. **Make an incorrect sign:** Mascot should animate to `oops` (shake animation). Speech bubble shows "Almost! Try again." Red color tint briefly.

3. **Reach Boss Stage:** Mascot should animate to `hyped`, speech bubble says "Final challenge — you've got this!"

4. **Complete lesson with 1 star:** In `VictoryModal`, mascot should be visibly `sad` (drooping), speech bubble says a hopeful message like "You'll get them next time."

5. **Complete lesson with 3 stars:** Mascot should be in full `celebrate` mode, confetti fires, ILY pose.

6. **Check LiveSession bottom corner:** Should NOT be a pink square. Should be the hand mascot in a small circle.

7. **Check Saga Map:** Mascot should be visible near the active (unlocked) lesson node in idle/wave state.

---

---

# PHASE 3 — Layout Revolution

> **Goal:** The app layout adapts beautifully to all screen sizes. Mobile gets optimized portrait UX. Tablet and desktop get the full three-column experience.

## 3.1 — Responsive Layout Shell

**File:** `frontend/src/App.tsx` — Restructure `AppContent`

**Target structure:**
```
Mobile (< 768px)                 Tablet/Desktop (≥ 768px)
┌──────────────────┐             ┌─────────┬──────────────┬────────────┐
│ [Header w/ stats]│             │         │   [Content]  │ [Right     │
├──────────────────┤             │ [Side   │              │  Rail]     │
│                  │             │  bar]   │              │            │
│  [Content Area]  │             │         │              │            │
│                  │             │         │              │            │
├──────────────────┤             └─────────┴──────────────┴────────────┘
│  [Bottom Nav]    │             No bottom nav on md:+ (sidebar replaces)
└──────────────────┘
```

**Grid implementation:**
```
md: grid grid-cols-[240px_1fr_300px] h-dvh
```

---

## 3.2 — Left Sidebar Component

**File:** `frontend/src/shared/ui/Sidebar.tsx` (new)

- **Visible:** `md:flex hidden` (hidden on mobile, shown on tablet+)
- **Width:** `w-60` (240px)
- **Background:** `bg-black/40 backdrop-blur-xl border-r border-white/5`
- **Height:** `h-dvh sticky top-0` (full height, scrolls independently)

**Content:**
```
[App Name: "SignSensei" in Outfit font, purple glow]

─────────  Navigation  ─────────
[ 🗺️  Learn         ]   ← active: rounded pill bg-primary/20
[ 📚  Decks         ]
[ 👤  Profile       ]

─────────  Support  ─────────
[ ❓  Help & Tour   ]   ← relaunches onboarding tour
[ ⚙️  Settings      ]   ← future

─────────  Stats  ──────────
[ 🔥  7 day streak  ]
[ 💎  50 gems       ]
[ ⭐  Level 1       ]
```

Each nav item: `flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold`  
Active: `+ bg-primary/20 text-primary border border-primary/30`  
Inactive: `text-muted-foreground hover:bg-white/5 hover:text-foreground`

---

## 3.3 — Right Rail Component

**File:** `frontend/src/shared/ui/RightRail.tsx` (new)

- **Visible:** `lg:flex hidden` (only on large screens, 1024px+)
- **Width:** `w-[300px]`

**Widget cards (all use GlassCard):**

### Daily Goal Widget
```
[━━━━━━━━░░░░] 35 / 100 XP
"You're on a roll! Keep signing."
```

### Streak Widget
```
🔥 7 day streak
[Mon ✓] [Tue ✓] [Wed ✓] [Thu ✓] [Fri ✓] [Sat ✓] [Sun —]
```

### Weak Words Widget
```
📚 Words to Practice
[ coffee ] [ hello ] [ my ]
"The AI noticed you struggle with these."
```
Populated from `useUserStore().weakWords`

### Quick AI Deck Widget  
```
✨ Create a Deck
[ I want to learn... ] [→]
```
The AI generator input from `MapScreen` moves here on desktop, freeing up the map.

---

## 3.4 — Saga Map Screen Overhaul

**File:** `frontend/src/App.tsx` — `MapScreen`

### 3.4.1 — Node Redesign
Current nodes: plain circles with emoji, `w-28 h-28`.

New nodes:
- Unlocked: `w-24 h-24` circle with gradient background matching lesson color, thick `border-4 border-white/30`, inner glow `shadow-[0_0_30px_rgba(168,85,247,0.4)]`
- Locked: Same size but `opacity-40`, `blur-[0.5px]`, `border-white/10`, no glow
- Current/Active: Pulsing ring animation — `animate-ping` outer ring at `scale-125 opacity-30`
- Star indicators below node: larger, `w-5 h-5` per star

### 3.4.2 — Node Label (Always Visible)
Add a lesson title label below each node (not just in the popup):
```
[Node circle]
★★☆
The Basics
```
Title: `text-xs font-bold text-center text-white/80 mt-3`

### 3.4.3 — Lesson Detail — Bottom Sheet (replaces broken popup)
**Problem:** Current `absolute left-[120px]` popup overflows on mobile.  
**Solution:** A **bottom sheet** that slides up when a node is tapped.

```
┌────────────────────────────┐
│  ▬  (drag handle)          │
│  🌟🌟☆                     │
│  The Basics                │
│  Learn to say Hello...     │
│  [HELLO] [MY] [NAME] ...   │
│  [ ▶ START ] [📖 Preview]  │
└────────────────────────────┘
```

Implementation: `fixed bottom-0 left-0 right-0` with `translate-y` animation, backdrop behind it.

### 3.4.4 — Section Divider (Duolingo-style)
Between lesson groups, add a horizontal section label:
```
─────────── UNIT 1: Foundations ───────────
─────────── UNIT 2: Nature ─────────────────
```
(This requires adding a `unit` field to `curriculum.ts`)

### 3.4.5 — AI Lesson Generator (Mobile)
On mobile, the `"I want to learn..."` bar stays at the top of the map, but is re-styled with the new `Input` component and proper glassmorphism.

On desktop (`md:`+), this moves to the Right Rail widget (section 3.3).

---

## 3.5 — DecksScreen Overhaul

**File:** `frontend/src/features/dashboard/DecksScreen.tsx`

### 3.5.1 — Extract `DeckCard`
Move `DeckCard` out of `DecksScreen` into its own file: `frontend/src/features/dashboard/DeckCard.tsx`. This fixes the re-render bug.

### 3.5.2 — Card Redesign
Current: Flat grey box with invisible borders.  
New: `GlassCard variant="elevated"` with:
- A gradient accent line at the top (2px, matching lesson color or primary purple)
- Deck title in `text-lg font-bold` Outfit
- Word tags: `Badge` component in a pill style, subtle purple background
- Creator name (if community deck)
- Timestamp: "2 days ago" (relative time)
- Play button: `Button variant="primary" size="md"` — full impact, not tiny `h-8`

### 3.5.3 — Empty States
Replace plain text empty states with proper illustrated cards:
- My Decks empty: Mascot in `wave` pose with "Generate your first deck above! 🤟"
- Community empty: `Globe` icon large, "No public decks yet. Be the first!"

### 3.5.4 — Loading State
Replace `"Loading decks..."` text with `Skeleton` cards — two placeholder card shapes with pulse animation.

### 3.5.5 — Section Headers Redesign
```
Before: MY DECKS (tiny label)
After: 
┌─────────────────────┐
│  📁 My Decks   (1)  │   ← GlassCard as a section header
└─────────────────────┘
```

---

## Phase 3 — Verification Checklist

1. **Desktop layout (1024px+):** Open app in browser at full width. You should see three columns: left sidebar, center content, right rail. Bottom nav should be hidden.

2. **Tablet layout (768px–1024px):** Sidebar visible, right rail hidden. Center content fills remaining space.

3. **Mobile layout (<768px):** Only the content area visible. Bottom nav at bottom with labels.

4. **Active nav state:** Navigate to each route and confirm only that route's nav item is highlighted (left sidebar + bottom nav).

5. **Lesson node tap (mobile):** Tap an unlocked lesson node. A bottom sheet should slide up from the bottom with lesson details. The old `absolute left-[120px]` popup should be gone.

6. **DeckCard:** Each deck card should use the premium glassmorphism style. Tags should be readable. Play button should be prominent.

7. **Decks loading state:** On slow connection, skeleton cards should appear instead of text.

8. **Delete deck:** Clicking delete should show a `ConfirmDialog` modal, NOT `window.confirm()`.

---

---

# PHASE 4 — New Screens & Features

> **Goal:** First-time users are onboarded with the mascot. Users can view their learning history. The app feels complete.

## 4.1 — Splash / Loading Screen

**File:** `frontend/src/features/splash/SplashScreen.tsx` (new)

**When it shows:**
- App first loads (before Firebase Auth resolves and user store hydrates)
- The current experience: white flash → React renders → Firestore fetch

**Design:**
```
                    (full screen, cosmic background)

              🤚 [Mascot: large, waving]

           S i g n S e n s e i
         Learn ASL with AI  

          [━━━━━━━━░░░░░░░░░]   (subtle loading bar)
```

- Background: The same cosmic gradient as the rest of the app
- Mascot: `emotion="wave"` transitioning to `emotion="thinking"` once loading starts, back to `emotion="celebrate"` or `emotion="wave"` when done
- App name: Outfit Black, `text-4xl`, soft purple glow text-shadow
- Loading bar: `ProgressBar` component (`size="sm"`) filling from 0 → 100% (timed ~2s minimum, regardless of actual load time for UX smoothness)
- Exit animation: Fade out → dissolve into the main app

**Implementation:** Wrap `AppContent` in a hook `useAppLoading` that tracks Firebase Auth + Firestore hydration state.

---

## 4.2 — Onboarding Tour

### 4.2.1 — Tour State
**File:** `frontend/src/stores/useUserStore.ts`  
Add field: `hasCompletedTour: boolean` (defaults `false`, persisted, synced to Firestore)

### 4.2.2 — Tour Trigger
- On first load (after splash): if `!hasCompletedTour` → auto-start tour
- Replay: A `?` button at the top of the left sidebar (desktop) or in the header (mobile)

### 4.2.3 — Tour Steps Config

**File:** `frontend/src/data/tourSteps.ts`

```typescript
export const TOUR_STEPS = [
  {
    id: 'welcome',
    target: null,  // Full-screen step, no target
    title: 'Welcome to SignSensei! 🤟',
    message: 'I\'m your ASL guide! Let me show you around.',
    mascotEmotion: 'wave',
  },
  {
    id: 'map_nodes',
    target: '[data-tour="lesson-node"]',  // CSS selector
    title: 'Your Learning Path',
    message: 'Tap a circle to start a lesson. Complete lessons to unlock the next!',
    mascotEmotion: 'wave',
  },
  {
    id: 'ai_generator',
    target: '[data-tour="ai-input"]',
    title: 'AI Lesson Creator ✨',
    message: 'Type anything and I\'ll generate a custom ASL lesson for you!',
    mascotEmotion: 'hyped',
  },
  {
    id: 'stats_header',
    target: '[data-tour="header-stats"]',
    title: 'Your Progress',
    message: 'Track your streak 🔥, gems 💎, and level ⭐ here.',
    mascotEmotion: 'wave',
  },
  {
    id: 'decks',
    target: '[data-tour="nav-decks"]',
    title: 'Dynamic Decks 📚',
    message: 'Find all your custom lessons and community decks here.',
    mascotEmotion: 'wave',
  },
  {
    id: 'profile',
    target: '[data-tour="nav-profile"]',
    title: 'Your Profile 👤',
    message: 'See your full learning history and stats here.',
    mascotEmotion: 'idle',
  },
  {
    id: 'done',
    target: null,
    title: 'You\'re ready! 🎉',
    message: 'Start with "The Basics" or create your own lesson. Happy signing!',
    mascotEmotion: 'celebrate',
  }
];
```

### 4.2.4 — `TourOverlay.tsx` Component

**File:** `frontend/src/features/tour/TourOverlay.tsx`

**Design:**
- Dimmed backdrop with `bg-black/60 backdrop-blur-sm`
- Highlighted target element: a bright ring/hole punched in the overlay using `box-shadow: 0 0 0 9999px rgba(0,0,0,0.6)` technique or clip-path
- Mascot + speech bubble positioned near (not obscuring) the highlighted element
- Navigation: `[Skip] [← Prev] [Next →]` or `[Done]` on last step
- Progress: small dots at bottom `● ○ ○ ○ ○ ○ ○`

---

## 4.3 — Profile Screen

**Route:** `/profile`  
**File:** `frontend/src/features/profile/ProfileScreen.tsx` (new)

**Design (mobile, portrait):**
```
┌────────────────────────────┐
│  👤 Profile                │
│                            │
│  [🤚 Mascot: idle, small]  │
│  Anonymous Learner         │ ← (Firebase Auth display name if set)
│  Level 3 · 340 XP         │
│                            │
│  ─── Stats ───             │
│  🔥 7 streak │ 💎 50 gems  │
│                            │
│  ─── Lesson History ───    │
│  [The Basics    ★★★]       │
│  [Forest Friends ★★☆]      │
│  [Coffee Break  ★★★]       │
│                            │
│  ─── Words to Practice ─── │
│  [coffee] [hello] [my]     │
│                            │
│  ─── My Decks ───          │
│  [3 decks created] →       │
└────────────────────────────┘
```

**Data sources (all from `useUserStore`):**
- `xp`, `streak`, `gems` → Stats grid
- `lessonScores` → Lesson history list with star ratings
- `weakWords` → Words to practice (top 5 most-failed)
- Firestore `decks` collection → My creations count

**Lesson History Card:**
Each lesson in history:
- Title + Emoji from `LESSONS` curriculum data
- Star rating (1–3 stars, animated on mount)
- "Practice again" quick-play button

---

## Phase 4 — Verification Checklist

1. **Splash screen (fresh load):** Close the app completely (remove from iOS app switcher or clear cache). Reopen. You should see the mascot + "SignSensei" text + loading bar before the main app appears.

2. **Tour (first-time user):** Clear `localStorage` key `signsensei-user-storage` in DevTools. Reload. After splash, the onboarding tour should automatically begin.

3. **Tour replay:** Click the `?` button in the header/sidebar. Tour should restart from the beginning.

4. **Tour highlights:** At each tour step, the relevant UI element should be visually highlighted (ring around it). The mascot should be visible with the correct speech bubble.

5. **Profile screen:** Navigate to `/profile`. Stats (XP, streak, gems) should match what's shown in the header. Lesson history should show completed lessons with correct star counts.

6. **Weak words:** After failing a word sign during a lesson, navigate to Profile. That word should appear in the "Words to Practice" section.

---

---

# PHASE 5 — LiveSession UX Overhaul

> **Goal:** The live lesson screen is the most important screen in the app. It should feel premium, focused, and work beautifully in both portrait and landscape.

## 5.1 — Portrait Mode Redesign

**File:** `frontend/src/features/live-session/components/LiveSession.tsx`

### 5.1.1 — Replace Cream Card with Glassmorphism
- Replace `bg-card border border-border` with `GlassCard variant="elevated"`
- The card should no longer be a floating beige island — it should look like a premium dark glass panel

### 5.1.2 — Button Hierarchy Fix
Current: "I'm Ready" (pink, lg) + "END SESSION" (red, lg) — equal visual weight.

New:
```
[ I'm Ready 🤟 ]         ← Primary, full-width, prominent
  
[ End Session ]          ← Ghost/text-only, small, right-aligned
                         ← Users must mean to tap it
```
The "END SESSION" button should be demoted to `variant="ghost" size="sm"` with a subtle `text-destructive` color. No more big red banner.

### 5.1.3 — Word Stepper Redesign
Current: Small pill pills in a flex-wrap row, `h-9`.

New: Horizontal scrollable stepper if many words, with:
- Completed words: filled primary pill with checkmark
- Current word: outlined pill with glow + subtle pulse
- Future words: very muted, small without glow
- Boss stage indicator: A separate pulsing section appears above the stepper when `isBossStage`

### 5.1.4 — Feedback Banner Redesign
Move error/success feedback banner to **above** the "I'm Ready" button (so user reads it first).

New design: 
```
┌──────────────────────────────┐
│ 🤚 [Mascot: oops/celebrate]  │  ← Mascot appears here during feedback
│ ────────────────────────── │
│ ❌ You didn't quite get      │  ← Feedback text, larger
│    COFFEE. Fists rotating    │
└──────────────────────────────┘
```

### 5.1.5 — "ACTIVATE SENSORS" Label
Rename this button to something more welcoming:
```
"Start Lesson 🤟"   or   "Begin Practice"
```

---

## 5.2 — Landscape Mode Layout

**Trigger:** `@media (orientation: landscape) and (max-height: 480px)` — targets phones in landscape only (not tablets, which have taller landscape viewports).

**Layout:**
```
┌────────────────────────────────────────┐
│ [Word Stepper — horizontal scroll]     │  ← top bar, compact h-10
├───────────────────┬────────────────────┤
│                   │   [PiP Camera]     │
│  [Feedback /      │   [small, top-     │
│   AI Status /     │    right corner]   │
│   Mascot]         │                    │
│                   │   [I'm Ready]      │
│                   │   [End Session]    │
└───────────────────┴────────────────────┘
```

Key changes in landscape:
- Word stepper becomes `overflow-x-auto flex-nowrap` single horizontal row (no wrap)
- PiP camera appears in top-right quadrant
- Controls and feedback in left quadrant
- Bottom nav hidden in landscape on mobile (use `hidden landscape:hidden` appropriately)

---

## 5.3 — PiP Camera

**File:** `frontend/src/features/live-session/components/LiveSession.tsx`

The `<video ref={videoRef}>` element is currently `className="hidden"`. In landscape mode, make it visible:

- **Portrait mode:** Keep `hidden` (camera runs but no visible preview)
- **Landscape mode:** Show as a PiP:
  ```
  <video 
    className="landscape:block hidden rounded-2xl border-2 border-primary/40 shadow-lg shadow-primary/20 w-40 h-28 object-cover"
  />
  ```
- A small "camera on" indicator badge overlaid on the PiP

---

## 5.4 — Victory → Full-Screen Modal Enhancement

**File:** `frontend/src/shared/ui/VictoryModal.tsx`

- Use new `Modal` component for focus trap + Escape key
- Mascot as the central element (replaces Trophy icon)
- Stars animate below the mascot
- After star reveal: mascot shifts to score-based emotion state with message
- Stats grid: Show `XP earned THIS lesson` not total accumulated XP (need to track lesson delta)
- Confetti fires correctly — z-index fix so it appears above the modal backdrop but below the modal content

---

## Phase 5 — Verification Checklist

1. **LiveSession portrait:** Start a lesson on mobile (portrait). The session card should look glassmorphic (no cream). "END SESSION" should be visually subdued, not equal weight to "I'm Ready."

2. **LiveSession landscape (phone):** Rotate phone to landscape during a lesson. The layout should switch to two-column. The PiP video preview should appear in the top-right corner showing your camera feed.

3. **Boss stage:** When boss stage activates, the indicator should appear above the word stepper, not replace it.

4. **Feedback placement:** After an incorrect sign, the error feedback should appear ABOVE the "I'm Ready" button with the mascot in `oops` state.

5. **Victory modal:** Complete a lesson. The VictoryModal should show the mascot prominently. Confetti should fire over and around the modal (not hidden behind it). Stars should animate in sequence.

6. **Keyboard (Escape):** With the Reference Sign modal open, pressing Escape should close it.

7. **Focus trap:** With any modal open, pressing Tab should cycle focus within the modal only.

---

---

# Implementation Rules (For Every Phase)

1. **Phase Gate:** Never start a new phase until the previous phase's verification checklist is passed and you (the user) explicitly give the green light.

2. **Re-check after every major component:** After implementing any component that touches more than one screen, a visual spot-check of all affected screens must be done.

3. **Mobile-first at all times:** Every component is designed for `375px` portrait first, then scaled up.

4. **No solarized tokens:** If any `bg-card`, `text-muted-foreground`, `border-border`, etc. resolve to cream/beige after Phase 1, it's a bug to fix before proceeding.

5. **Accessibility non-negotiables:**
   - All icon-only buttons must have `aria-label`
   - All modals must have focus traps
   - All interactive elements that aren't `<button>` must have `role="button"` + `tabIndex={0}`

6. **The mascot is always the last thing added** to any new screen — it layers on top of a solid UI foundation, never a distraction from broken UI underneath.
