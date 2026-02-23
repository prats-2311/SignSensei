Here is the updated, master-level README.md for **SignSensei Live**. This document integrates our infrastructure strategy, the "Smart Framerate" logic, the Gemini Live API architecture, and the high-fidelity UI/UX (Duolingo-style) requirements.

# ---

**🤟 SignSensei Live: Technical Architecture & Specification**

## **1\. Executive Summary**

**SignSensei Live** is an immersive, AI-driven ASL (American Sign Language) tutor built for the **Gemini Live Agent Challenge**. It transforms the learning experience from passive video watching into a bidirectional, "seeing" conversation.

By leveraging the **Gemini Multimodal Live API**, the application watches the user's hand movements via webcam, provides real-time vocal feedback, and controls a 3D procedural avatar to demonstrate signs—all with the gamified polish of a modern mobile app like Duolingo.

## ---

**2\. Technical Stack**

| Layer | Technology |
| :---- | :---- |
| **Multimodal AI** | gemini-2.5-flash-native-audio-preview-12-2025 |
| **Backend** | **Python (FastAPI)** deployed on **Google Cloud Run** (Serverless Container) |
| **Frontend** | **React (Vite) PWA**, Tailwind CSS |
| **3D Engine** | Three.js \+ @react-three/fiber (Ready Player Me Avatar) |
| **UX/Animations** | framer-motion (UI), use-sound (Audio), Vibration API (Haptics) |
| **Persistence** | **Google Cloud Firestore** |
| **Deployment** | **Docker** + **Terraform** + **GitLab CI/CD** (Automated Pipeline) |

## ---

**3\. System Architecture & Workflow**

### **Phase A: Secure Provisioning (The GCP Handshake)**

To maintain security, the app never exposes the API Key.

1. **Request:** The PWA requests a token from the FastAPI backend.  
2. **Mint:** Backend calls the Google Vertex AI/GenAI service to mint a 30-minute **Ephemeral Token**.  
3. **Connect:** Frontend uses this token to open a direct **Full-Duplex WebSocket** to Gemini.

### **Phase B: The "Live" Evaluation Loop**

1. **Dynamic Streaming:** React utilizes a "Smart Framerate" hook:  
   * **Listening State:** 1 FPS (conserves tokens while AI speaks).  
   * **Action State:** 10-15 FPS (captures fluid sign motion when user practices).  
2. **Context Management:** Initialized with contextWindowCompression: { slidingWindow: {} } to allow unlimited session length by sliding the 131k token window.  
3. **Barge-In:** Native Voice Activity Detection (VAD) allows the user to interrupt the AI at any time.

### **Phase C: Asynchronous UI Orchestration**

Gemini acts as the "UI Navigator" via **Non-Blocking Function Calling**:

* log\_correct\_sign: Silently updates Firestore and increments XP without pausing the AI's speech.  
* toggle\_3d\_avatar: Voice-triggered command to overlay the Three.js model for visual help.  
* finish\_lesson: Triggers the teardown and victory sequence.

## ---

**4\. UI/UX: The "Duo" Polish Layer**

### **Visual & Motion (framer-motion)**

* **Haptic Buttons:** All interaction points use spring-physics scaling (whileTap={{ scale: 0.95 }}) to provide a physical, tactile feel.  
* **Progress Orchestration:** A layout-aware progress bar that animates smoothly across lesson milestones.  
* **Victory State:** Integration of react-confetti-explosion triggered by the finish\_lesson tool call.

### **Audio & Haptics**

* **Earcons:** High-fidelity "Ding" (Success) and "Buzzer" (Retry) sounds managed via use-sound.  
* **Tactile Feedback:** \* Success: 10ms light pulse (navigator.vibrate(10)).  
  * Error: Double buzz pulse (navigator.vibrate(\[50, 30, 50\])).

## ---

**5\. Directory Structure**

Plaintext

/signsensei-live  
 ├── /backend  
 │    ├── main.py            \# FastAPI entry point  
 │    ├── auth\_service.py    \# Ephemeral Token provisioning  
 │    ├── database.py        \# Firestore connectors  
 │    └── Dockerfile  
 ├── /frontend  
 │    ├── /src  
 │    │    ├── /canvas       \# 3D Avatar (Three.js) logic  
 │    │    ├── /hooks        \# useLiveAPI.ts, useSmartFramerate.ts  
 │    │    ├── /components   \# BouncyButton, ProgressBar, Confetti  
 │    │    └── App.tsx  
 │    └── vite.config.ts     \# PWA & Proxy configuration  
 ├── /terraform              \# Infrastructure as Code (Bonus Points)  
 │    └── main.tf            \# GCP Provider & Compute Engine setup  
 └── docker-compose.yml      \# Orchestration for local development

## ---

**6\. Deployment & Reproducibility (README)**

### **Automated Setup (The "One-Click" Strategy)**

We utilize **Terraform** to provision the `us-central1` Cloud Run Service automatically.

1.  **Container:** GitLab CI builds the Docker image and pushes to Artifact Registry.
2.  **Infrastructure:** Terraform (`google_cloud_run_v2_service`) deploys the Revision.
3.  **SSL:** Cloud Run automatically provisions the HTTPS endpoint required for `navigator.mediaDevices.getUserMedia()`.

### **Local Development**

Bash

\# Spin up both Frontend and Backend  
docker-compose up \--build

* **Frontend:** http://localhost:5173  
* **Backend API:** http://localhost:8000


## ---


**7\. Compliance & Rules Checklist**

* \[x\] **New Project:** Created specifically for the Feb-March 2026 window.  
* \[x\] **Category:** Live Agents (Real-time Audio/Vision).  
* \[x\] **GCP Integration:** Backend hosted on **Cloud Run** (Serverless); Data in Firestore.  
* \[x\] **Beyond Text:** Uses high-framerate video and procedural 3D output.  
* \[x\] **Public Repo:** Code available for judging and testing.

---

**8. Database Schema (Firestore)**

We use a straightforward NoSQL structure to support both "Master" (Hardcoded) and "Custom" content.

### **Collections**

*   **`users/{userId}`**
    *   `xp`: (int) Total experience points.
    *   `streak`: (int) Current daily streak.
    *   `currency`: (int) "Gems" for buying avatar skins.
    *   **`users/{userId}/history`** (Sub-collection)
        *   `docId`: (timestamp) Logic for specific practice sessions.
        *   `score`: (int) Accuracy percentage.
        *   `mode`: "MASTER" | "CUSTOM"

*   **`exercises/{exerciseId}`** (The "Master" Content)
    *   `id`: "greetings_101"
    *   `category`: "Basics"
    *   `vocabulary`: `["Hello", "Thank You", "Nice to meet you"]`
    *   `difficulty`: "EASY"

*   **`custom_decks/{deckId}`** (User-Generated)
    *   `ownerId`: (ref) link to user.
    *   `vocabulary`: `["Stethoscope", "Doctor"]`
    *   `glossary`: (Map) The Generated AI definitions used for "Grounding".
    *   *Note: This is created via the `/api/context/generate` endpoint.*

---

**9. The "Duolingo" UX Architecture**

We replicate the "Hook, Action, Reward" loop of Duolingo using specific frontend mechanics.

### **A. visual Language (Animations)**
We use `framer-motion` for "Juicy" interactions.

*   **The "Bouncy" Click:**
    ```jsx
    <motion.button whileTap={{ scale: 0.9 }}>
    ```
    *Every button feels physical.*
*   **The "Correct" Pop:**
    When `log_correct_sign` is triggered:
    1.  **Confetti Explosion:** `react-confetti-explosion` fires from the center.
    2.  **XP Bar Fill:** The top progress bar animates `width` from 20% -> 30% with a spring bounce.
    3.  **Avatar Reaction:** The 3D Avatar (Three.js) transitions from "Idle" to "ThumbUp" animation.

### **B. Workflow (The Loop)**

1.  **The Map (Dashboard):**
    *   A scrolling SVG path with "Nodes" (Lessons).
    *   Completed nodes turn Gold (locked/gray -> active/color -> gold).
    *   **Custom:** A separate tab for "My Decks" (Flashcard style).

2.  **The Loading Screen (Context Injection):**
    *   While the WebSocket connects, show random "Did you know?" ASL facts.
    *   *Technical:* This hides the 1-2s latency of the Token Minting & System Instruction injection.

3.  **The Session (Live Mode):**
    *   **Split Screen:**
        *   **Top:** Gemini's Voice Visualizer (Glowing waveform).
        *   **Center:** User Camera (Mirror).
        *   **Bottom:** 3D Avatar (Teacher) - *Hidden by default, summoned by voice.*

4.  **The Victory Screen:**
    *   "Lesson Complete!" fanfare.
    *   **Three Stats:** Accuracy %, XP Earned, Streak Day.
    *   **Double or Nothing:** A gamified ad-hook to keep them engaged.

## ---


---

**10. The Dual-Engine Animation Strategy**

We use **Two** distinct animation engines to balance "Mobile Performance" with "Instructional Accuracy."

### **Engine A: The "Teacher" (Three.js + Procedural)**
*Used ONLY when the user asks for "3D Help" or "Show me."*

*   **Goal:** Accurate, rotatable representation of Sign Language.
*   **Tech:** Three.js loading a **Ready Player Me** avatar.
*   **The Pipeline:**
    1.  **Input:** User asks "Show me 'Hello'".
    2.  **Data Fetch:** System looks up the **HamNoSys** string for "Hello" (e.g., `[RightHand] [Flat_B] [Forehead] -> [Arc_Out]`).
    3.  **Retargeting:** We map HamNoSys coordinates to RPM Bone Rotations (`RightHandThumb1`, `RightHandIndex1`, etc.).
    4.  **Inverse Kinematics (IK):** A `CCDIKHelper` ensures the hand genuinely touches the forehead target (preventing clipping).
    5.  **Render:** The loop plays this interpolation on the 3D Canvas overlay.

### **Engine B: The "Feedback" (Rive 2D)**
*Used 90% of the time for UI/UX, Gamification, and Feedback.*

*   **Goal:** "Duolingo-like" responsiveness, battery saving, and "Juicy" interactions.
*   **Why Rive?** It runs at 60FPS on the UI thread without heating up the GPU.
*   **Role:**
    *   **The Mascot:** A 2D flat owl/robot that sits in the corner.
    *   **State Machine:**
        *   `Idle`: Blinking, looking around.
        *   `Listening`: Cup hand to ear (Triggered by VAD).
        *   `Success`: Thumbs up + Jump (Triggered by `log_correct_sign`).
        *   `Confusion`: Head scratch (Triggered if confidence score is < 0.5).
*   **Integration:**
    *   Rive inputs are driven directly by our `useLiveAPI` hook.
    *   *Example:* `riveInput.value = "Listening"` when `isVolumeAboveThreshold` is true.

## ---



---

**11. Engineering Standards & Best Practices**

To ensure a "Production-Ready" scalable codebase, we adhere to Strict Engineering Guidelines.

### **A. Architecture Pattern: Feature-Sliced Design (FSD)**
We strictly avoid generic `components/` folders. Code is organized by **Business Domain** to ensure modularity.

*   `src/features/live-session`: Core WebSocket and MediaPipe logic.
*   `src/features/dashboard`: Progress map and deck selection.
*   `src/shared/ui`: Reusable "Dumb" components (Buttons, Cards).
*   `src/shared/lib`: Global utilities (Logger, Firebase).

### **B. Observability & Logging**
*   **Structured Logging:** We do not use `console.log`. We use a shared `logger` utility that wraps logs with context (`{ context: "WebSocket", latency: 45ms }`) for easier debugging in production.
*   **Error Boundaries:** Each major feature (LiveSession) is wrapped in a React Error Boundary to prevent the entire app from crashing if the Avatar engine fails.

---

**12. State Management Strategy**

We use a "Split-Brain" architecture to handle the high-performance demands of 60FPS animation vs. async data syncing.

### **A. High-Frequency State (Zustand)**
*   **Purpose:** Instant UI updates without re-renders.
*   **Use Case:** The "Live" loop. When `log_correct_sign` fires, we update the `xp` store.
*   **Why?** Allows the XP bar to bounce instantly while the camera stream stays stable.

### **B. Async Server State (TanStack Query)**
*   **Purpose:** Data fetching, caching, and **Optimistic Updates**.
*   **Use Case:** Saving lesson history to Firestore.
*   **Why?** The UI shows "Lesson Saved!" immediately, while the network request happens in the background.

### **C. Mutable State (Refs)**
*   **Purpose:** Heavy objects that should *never* trigger re-renders.
*   **Use Case:** The `WebSocket` instance, `MediaStream`, and `AudioContext`.

## ---
