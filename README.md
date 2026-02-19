# 🤟 SignSensei Live

![Status](https://img.shields.io/badge/Status-Development-yellow) ![Stack](https://img.shields.io/badge/Stack-React_|_FastAPI_|_Gemini-blue)

**SignSensei Live** is an immersive, AI-driven ASL (American Sign Language) tutor built for the [Gemini Live Agent Challenge](https://ai.google.dev/competition).

It transforms language learning from passive video watching into a **real-time, bidirectional conversation** where the AI can "see" your hands and give instant feedback.

## 🚀 Features

*   **Multimodal Live API:** Uses Gemini 2.5 Flash to process video and audio streams in real-time.
*   **"Smart Framerate" Engine:** Dynamically switches between 1 FPS (Listening) and 15 FPS (Action) to optimize token usage.
*   **Dual-Engine Animation:**
    *   **3D Avatar (Three.js):** Procedural "Teacher" for accurate sign demonstration.
    *   **2D Mascot (Rive):** "Duolingo-style" feedback and gamification.
*   **State Management:** High-performance "Split-Brain" architecture using Zustand (Client) and TanStack Query (Server).

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React (Vite), TypeScript, Tailwind CSS, Framer Motion |
| **Backend** | Python (FastAPI) - *Token Minting Only* |
| **AI Model** | Gemini 2.5 Flash (via WebSocket) |
| **Deployment** | Google Cloud Run (Serverless Container) |
| **Infrastructure** | Terraform + Docker |

## 📦 Getting Started

### Prerequisites
*   Node.js v18+
*   Python 3.10+
*   Google Cloud Project with Vertex AI API enabled.

### 1. Clone & Install
```bash
git clone https://github.com/your-username/signsensei.git
cd signsensei
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
*App will run at `http://localhost:5173`*

### 3. Google Cloud Authentication (Required for Backend)
The backend uses Application Default Credentials (ADC) to mint ephemeral Gemini API tokens securely.

1.  **Install Google Cloud CLI:** Follow the instructions for your OS at [Google Cloud Docs](https://cloud.google.com/sdk/docs/install).
    *   *macOS/Homebrew:* `brew install --cask google-cloud-sdk`
2.  **Initialize & Authenticate:**
    ```bash
    gcloud init
    # (Select your project, e.g., 'SignSensei-Live')
    
    gcloud auth application-default login
    # (Log in via browser to save local credentials)
    ```

### 4. Backend Setup
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```
*API will run at `http://localhost:8000`*

## 📂 Project Structure (Feature-Sliced Design)

```
signsensei/
├── frontend/
│   ├── src/features/    # Business Logic (Live Session, Dashboard)
│   ├── src/shared/      # Reusable UI/Lib (Buttons, Logger)
│   ├── src/stores/      # State Management (Zustand)
│   └── src/App.tsx      # Main Layout
├── backend/
│   ├── main.py          # FastAPI Entry Point
│   └── auth.py          # Token Service
└── terraform/           # GCP Infrastructure
```

## 📜 License
MIT
