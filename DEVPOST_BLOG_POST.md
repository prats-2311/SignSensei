---
title: "How I Built a Real-Time ASL Tutor That Sees Your Hands — Using Gemini Live API"
tags: "gemini, googlecloud, javascript, ai"
---

I watched CODA last year. If you haven't seen it — it's about a hearing girl raised by deaf parents, and her journey navigating two worlds. I walked away from that film with one question stuck in my head:

**Why is there a Duolingo for French, Spanish, and Japanese — but nothing that can actually *watch* you sign, and tell you if you got it right?**

Not a video library. Not a chatbot. Something that sees your hands.

I spent the last month finding out if that was possible. The result is **SignSensei** — a real-time ASL tutor powered by Google Gemini Live 2.5 Flash.

> *I created this project for the purposes of entering the Gemini Live Agent Challenge hackathon. #GeminiLiveAgentChallenge*

---

## The Problem With Every Existing ASL Tool

Every ASL learning app I found does one of two things:
1. Shows you a video of someone signing
2. Shows you a diagram of hand positions

Neither one can tell you if **your** hands are right. They're passive. You watch, you guess, you hope. There's no feedback loop.

This isn't a product gap — it's a technical gap. Until recently, no AI could handle continuous, real-time vision AND bidirectional voice simultaneously, with low enough latency for a natural tutoring conversation.

Then Gemini Live launched.

---

## Why Gemini Live Changes Everything

Gemini Live 2.5 Flash is the only model that can:
- Watch your camera **continuously** (not one-shot images)
- Listen to your voice in real time
- Respond with natural spoken audio
- Handle interruptions
- Call tools to trigger structured actions

This is the specific combination SignSensei needed. Every other approach I considered had a fatal flaw:

| Approach | Problem |
|---|---|
| Vision API (batch) | Too slow — 2-3 sec latency, no voice |
| ChatGPT Vision | No real-time stream, no audio |
| Gemini Flash (non-Live) | Turn-based, not conversational |
| **Gemini Live 2.5 Flash** | ✅ Real-time, bidirectional, vision + voice |

---

## The Architecture — What I Learned the Hard Way

### 1. Direct WebSocket Connection (Ephemeral Token Pattern)

The most important architectural decision: **the browser connects directly to Vertex AI**, not through our backend.

```typescript
// frontend/src/features/live-session/hooks/useGeminiLive.ts

const res = await fetch(`${baseUrl}/api/token`); // Backend mints token
const data = await res.json();

const WS_URL = `wss://us-central1-aiplatform.googleapis.com/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent?bearer_token=${data.token}`;

const ws = new WebSocket(WS_URL); // Direct to Vertex AI
```

The backend (FastAPI on Cloud Run) never sees the video or audio stream. It only mints a short-lived ephemeral token using Application Default Credentials. This keeps GCP credentials server-side while eliminating transcoding latency.

**Result: Sub-second feedback on hand grading.**

---

### 2. The Smart Standby Engine — Solving Hallucinations

My first build sent camera frames continuously. The AI would grade random hand positions during idle moments. It was chaotic.

**The fix: 0 FPS standby, 5 FPS active.**

```typescript
// When AI is speaking instructions — camera off
useEffect(() => {
  if (!videoCaptureRef.current) return;
  
  if (isPracticeModeActive) {
    videoCaptureRef.current.setFrameRate(5);  // User is signing
  } else {
    videoCaptureRef.current.setFrameRate(0);  // AI is talking
  }
}, [isPracticeModeActive]);
```

The camera activates only when the user explicitly clicks "I'm Ready." The AI has a clean visual context and a specific task. Hallucinations dropped dramatically.

---

### 3. Context Window Hygiene — The Biggest Surprise

My first architecture maintained one WebSocket connection for an entire lesson (6+ words). At word 3-4, the AI would start confusing prior grading context with the current evaluation. It would "remember" a previous incorrect sign and apply that memory to the current word.

**The solution: Fresh connection per word.**

| Session Type | Connection Strategy |
|---|---|
| Individual word practice | Fresh WebSocket, injected system prompt |
| Retry after incorrect sign | Same connection (AI needs correction memory) |
| Boss Stage (full sentence) | Single persistent connection |

This is the **Context Window Hygiene** pattern. Each word starts with a clean prompt and zero contamination from prior rounds. The Boss Stage intentionally retains context because evaluating a sequence requires remembering each sign.

The key insight: **stateless context = predictable grading.**

---

### 4. Deterministic Grading — No AI Hallucination of Progress

The AI cannot advance the curriculum on its own. Every lesson step is gated by a **tool call** that the frontend validates against Zustand state.

```typescript
// Tool call from Gemini triggers curriculum advance
case 'mark_sign_correct':
  const currentStore = useLessonStore.getState();
  if (!currentStore.isGradingWindowActive) {
    // Reject — grading window not open
    return;
  }
  currentStore.advanceToNextWord(); // Zustand updates truth
  break;
```

Gemini must call `mark_sign_correct` with a valid grading window open. The client rejects tool calls outside the expected window. This eliminates curriculum hallucinations where the AI might "pretend" the user passed a sign they didn't perform.

---

## What I Built — Full Feature List

- 🎓 **Live AI Tutoring** — Gemini watches your webcam and grades signs in real time
- 🎤 **Voice First** — AI speaks instructions, user signs, says "Done" to trigger grading
- 🗺️ **Saga Map** — Gamified curriculum with unlockable lesson nodes
- ⚔️ **Boss Stage** — Full sentence signing to complete each lesson
- ✨ **AI Deck Generator** — Type any topic, Gemini generates a custom ASL lesson
- 🌐 **Community Decks** — Publish decks publicly, browse by 8 categories
- 👤 **Anonymous Sessions** — No sign-up required, try instantly
- 🎭 **Mascot Emotion System** — 7-state mascot tied to grading outcomes (Rive animated)
- 🎮 **Gamification** — XP, streaks, stars, gems

---

## Google Cloud Stack

| Service | Usage |
|---|---|
| **Vertex AI** | Gemini Live 2.5 Flash — BidiGenerateContent WebSocket |
| **Google GenAI SDK** | Gemini 2.0 Flash Lite — AI Deck Generation |
| **Cloud Run** | FastAPI backend — ephemeral token minting |
| **Firebase Hosting** | React/Vite frontend CDN |
| **Firestore** | User profiles, XP/streak, deck library |
| **Firebase Auth** | Anonymous sessions + Google Sign-in |
| **Artifact Registry** | Docker image storage |
| **Secret Manager** | API credentials (zero hardcoded keys) |
| **Workload Identity Federation** | Keyless CI/CD via GitHub Actions |
| **Terraform** | Full IaC for Cloud Run, Artifact Registry, IAM |

---

## Try It

🔗 **Live:** [signsensei.web.app](https://signsensei.web.app) — no account required  
📦 **Code:** [github.com/prats-2311/SignSensei](https://github.com/prats-2311/SignSensei)

No sign-up. Open the app, click Get Started, and you're learning ASL in under 10 seconds.

---

## A Note to the Gemini Live API Team

Gemini Live already has a camera. It already runs in millions of pockets. What SignSensei proves is what that platform becomes when you focus it — on a curriculum, on honest grading, on a learner who deserves a patient, always-available teacher.

To the Google Gemini Live API team: you built something that didn't exist before. A model that sees, hears, and speaks simultaneously in real time. SignSensei is one answer to the question of what to do with that. There are 70 million deaf people and hundreds of millions who want to learn their language. 

The API is ready. The world is waiting.

---

*Built with ❤️ for the Gemini Live Agent Challenge. This post was created for the purposes of entering the hackathon.*

*#GeminiLiveAgentChallenge #GeminiLive #GoogleCloud #ASL #AI*
