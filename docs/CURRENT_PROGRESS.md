# SignSensei Live - Current Progress Tracker

*This document acts as the primary source of truth for the AI Assistant across chat sessions. It must be updated at the end of key milestones.*

## 🟢 Completed
- **Architecture Set:** Decided on a Split-Brain state management (Zustand + TanStack Query) and Dual-Engine animation (Three.js + Rive).
- **Frontend Scaffold:** React + Vite PWA created, initial routing and layout implemented in `App.tsx`.
- **Backend Setup:** FastAPI Python backend running with a single `auth.py` service.
- **Authentication:** Successfully configured Google Cloud ADC and created an endpoint (`/api/token`) that securely mints ephemeral Gemini tokens.
- **Live WebSocket Hook:** Created the `useGeminiLive.ts` hook capable of connecting to the Multimodal API, sending a BidiSetup message, and streaming base64 media.
- **UI Theming:** Implemented native Tailwind CSS v4 variables (e.g., `bg-primary`, `text-card-foreground`) and stripped all hardcoded colors from components.
- **Hardware Integration:** successfully tested browser microphone and webcam permissions.
- **Gemini Handshake:** Successfully established BidiGenerateContent connection targeting `gemini-live-2.5-flash-native-audio` on Vertex AI.
- **AI Tool Calling:** Successfully passed the `update_avatar_state` schema to Gemini and verified it triggers Zustand UI state updates (XP increase, animations) based on voice commands.
- **Gemini Engine Hardening:** Fixed Severe Context Overload API crashes by implementing a "Context Rotation" strategy with Semantic Decoupling to forcefully manage the AI's memory window mid-session.
- **State Synchronization:** Bulletproofed the `isPracticeModeActive` tracking to perfectly sync the frontend UI camera framerates with the AI's internal evaluation phases, preventing rapid-fire hallucination loops.

## 🟡 Current Status (In Progress)
The core infrastructure for the Live AI Tutor is fully functional! We have a stable WebSocket connection, the ability to stream audio/video to the model, and the model is successfully firing JSON tool calls that govern our UI state. The next major phase is converting the AI's logic to control the actual 3D avatar and structuring the exercise logic using the `CURRENT_PROGRESS.md` steps.

## 🔴 Immediate Next Steps
1. Playback AI Audio: Implement the parsing logic in `useGeminiLive.ts` to decode incoming AI Audio chunks and play them back in the browser smoothly using the `AudioManager`.
2. Connect 3D Avatar (Three.js): Map the `update_avatar_state` tool calls to explicitly drive the React Three Fiber model's animation mixer.
3. Rive Integration: Wire the smaller interactive mascot up to the same state triggers.
