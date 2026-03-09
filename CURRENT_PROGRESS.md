# SignSensei Architecture & Agent Context

This document provides a comprehensive overview of the SignSensei application architecture, specifically focusing on the Gemini Live API multimodal integration, the 3-Phase learning protocol, state management, and the various anti-hallucination guardrails that have been implemented. 

**Read this document entirely before modifying the codebase, as the Gemini Live API integration contains critical micro-timing and state synchronization rules.**

---

## 1. Tech Stack
*   **Frontend:** React (Vite), TypeScript, TailwindCSS, Zustand (State Management).
*   **Backend:** Python, FastAPI, Uvicorn.
*   **AI Engine:** Gemini Live API (`gemini-live-2.5-flash-native-audio`), communicating via WebSockets (BidiGenerateContent).
*   **Media Capture:** Custom `AudioManager.ts` (Web Audio API, PCM 16kHz) and `VideoCapture.ts` (Canvas to JPEG).

---

## 2. Core Architecture: Frontend-Driven AI
Unlike traditional chatbot apps, **the React Frontend (`Zustand`) is the absolute Source of Truth**, not the LLM. 

Because the Gemini Live API is stateless and prone to context drifting/hallucinations during long audio sessions, we employ **Universal State Re-Injection**. Every single time Gemini executes a Tool Call, the Frontend responds exactly with What the target word is, What Phase we are in, and What Gemini's next immediate objective is. 

### Backend Role
The backend (`main.py`) acts solely as a lightweight utility service:
1.  **Minting ephemeral access tokens** using Google Application Default Credentials so the frontend can open a direct WebSocket to Gemini.
2.  **Scraping SignASL.org** for reference videos cache.
3.  **Diagnostic Logging**: The frontend pipes transcriptions and debug logs to the backend terminal for developer observability.

---

## 3. The 3-Phase Evaluation Protocol
To prevent the AI from prematurely grading the user or talking over them, the lesson flow is strictly separated into three phases inside the `systemInstruction` payload (defined in `useGeminiLive.ts`).

### PHASE 1: Pre-Teaching (Standby)
*   **State:** The camera sends frames at **1 FPS** (to save quota/tokens).
*   **AI Role:** Introduce the target word verbally and answer questions.
*   **User Actions allowed:** The user can say "Show me the video". 
*   **Tools:** The AI can call `show_sign_reference` which pops up a video modal. By checking `isBossStage`, the AI intercepts video requests during the boss stage and verbally explains no full-sentence video exists.
*   **Transition Trigger:** The AI waits for the user to verbally say **"Ready"**. When it hears this, the AI must call the `trigger_action_window` tool.

### PHASE 2: Recording (Practice Mode)
*   **State:** The frontend immediately cranks the camera to **15 FPS** for high-fidelity gesture tracking. 
*   **AI Role:** **STAY SILENT.** The AI is forbidden from generating audio. It must watch the user's hands closely.
*   **Tools:** **ALL TOOLS ARE DISABLED.**
*   **Transition Trigger:** The user performs the sign and verbally says **"Done"**. 

### PHASE 3: Grading
*   **State:** The AI evaluates the 15 FPS video buffer *immediately preceding* the "Done" signal.
*   **AI Role:** Evaluate the sign accuracy.
*   **Tools (Individual Words):** Calls `mark_sign_correct` or `mark_sign_incorrect`. 
*   **Tools (Boss Stage):** Calls `mark_sentence_flow(score, feedback)` to grade a multi-word sequence out of 5 stars.
*   **Post-Action:** The UI advances the lesson and automatically kicks the AI back into Phase 1 constraints.

---

## 4. Critical Bug Fixes & Guardrails Implemented
LLMs are inherently "agreeable" and prone to race conditions when paired with real-time browser MediaStreams. The following guardrails MUST NOT BE REMOVED:

### A. The Temporal Gatekeeper (Eager Evaluation Fix)
**The Bug:** When the Action Window opened, the AI would sometimes panic and instantly grade the user just 600ms later, before the human could even move.
**The Fix:** Inside `useGeminiLive.ts`, we track `actionWindowStartTimeRef`. If the AI calls an evaluation tool in `< 2000ms`, the frontend violently rejects the tool call with a `SYSTEM ERROR: This is physically impossible`, forcing the LLM to wait.

### B. The Frontend Gatekeeper (Hallucinated Lockout)
**The Bug:** The AI's audio sensors sometimes misheard room noise and called `mark_sign_correct` during Phase 1 without the user ever saying "Ready".
**The Fix:** If the AI fires an evaluation tool while `!store.isPracticeModeActive`, the frontend intercepts it. **Crucially**, the error message explicitly re-binds the current target word (`Reminder: The target word is strictly 'X'`). This prevents Lockout Amnesia, where an error previously caused the AI to forget where it was and fall back to the first word "hello".

### C. Extreme Negative Evaluating Constraints (The "Resting Hands" Bug)
**The Bug:** If the user sat perfectly still and just said "Done", the LLM would mark the invisible sign as Correct out of pure "agreeableness".
**The Fix:** The tool descriptions in the setup payload heavily utilize extreme negative constraints: *"CRITICAL: If the user did nothing, sat still, or did not attempt the sign at all, you MUST NOT call this tool. Do not mark resting hands as correct."*

### D. Visual Cross-Contamination (The "Wrong Sign" distracted hallucination)
**The Bug:** If the target word was "my", but the user intentionally signed "hello", Gemini's visual parser would recognize "hello", override its text prompt mapping, and begin evaluating/lecturing the user about "hello" while completely forgetting the target word was "my".
**The Fix:** `trigger_action_window` and `mark_sign_incorrect` were hardened with mathematically explicit focus binding: *"The ONLY acceptable successful behavior is the exact target word. DO NOT mention any other signs they may have accidentally performed."* This isolates the LLM's visual engine to a binary Pass/Fail of only the active word.

### E. Atomic Boss Stage Transition (Race Condition Fix)
**The Bug:** Reaching the end of the lesson caused a race condition where the AI was told "Next word is X" and "You are in the Boss Stage" simultaneously, causing a catastrophic memory wipe. 
**The Fix:** The Boss Stage injection was merged directly into the `mark_sign_correct` JSON payload response. The frontend uses `else if (isBossStage)` to inject the Boss Stage rules exactly when the last word resolves, guaranteeing an atomic, conflict-free state transition.

### F. Boss Stage Double-Trigger (The State Machine Loop)
**The Bug:** When completing the Boss Stage, the AI would sometimes hallucinatel the `mark_sign_correct` tool (causing the Boss Stage to infinitely restart), and the frontend blindly displayed the Victory Modal even if the user failed.
**The Fix:** 
1. **The Nuclear Phase 3 Constraint:** The ATOMIC BOSS STAGE INJECTION prompt was updated to explicitly forbid the AI from using `mark_sign_correct`, commanding it to strictly use `mark_sentence_flow`. 
2. **State Failure Hook:** `completeLessonFlow` in the Zustand store was hardened to evaluate the score. If the user fails (`score < 3`), the Victory Modal is blocked and the UI forces the Boss Stage to stay active until passed.

---

## 5. Next Immediate Steps
1. The curriculum tracking, AI visual processing, Boss Stage transitions, and fail-safes are currently **STABLE**.
2. Work can now safely pivot to expanding features, such as injecting 3D Avatar state triggers, building out new Lesson Paths in `curriculum.ts`, or implementing UI/UX enhancements without breaking the core Gemini integration.
