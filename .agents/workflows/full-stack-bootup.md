---
description: Starts up the Full Stack (Backend + Frontend) and verifies they are healthy.
---

# Full Stack Bootup Workflow

This workflow automates the process of starting the FastAPI backend, starting the React frontend, and verifying that both services are accessible. Use this whenever returning to the project to ensure everything is running smoothly.

## Step 1: Start the Backend (FastAPI)
The backend is responsible for minting the ephemeral Gemini tokens using Google Cloud ADC. It runs on port 8000.

// turbo
```bash
cd backend && source venv/bin/activate && uvicorn main:app --reload > backend.log 2>&1 &
echo "Backend started in background (PID: $!). Waiting for initialization..."
sleep 3
```

## Step 2: Verify Backend Health
We test the backend by attempting to hit a known fast endpoint. A success means the server is up and listening.

// turbo
```bash
curl -fIs http://localhost:8000/docs > /dev/null
if [ $? -eq 0 ]; then
    echo "✅ Backend is healthy and responding on http://localhost:8000"
else
    echo "❌ Backend failed to start or is not responding. Check backend/backend.log"
    exit 1
fi
```

## Step 3: Start the Frontend (Vite/React)
The frontend serves the PWA and the WebSocket connections. It runs on port 5173.

// turbo
```bash
cd frontend && npm run dev > frontend.log 2>&1 &
echo "Frontend started in background (PID: $!). Waiting for initialization..."
sleep 4
```

## Step 4: Verify Frontend Health
We ping the Vite dev server to ensure it compiled successfully and is serving the application.

// turbo
```bash
curl -fIs http://localhost:5173 > /dev/null
if [ $? -eq 0 ]; then
    echo "✅ Frontend is healthy and responding on http://localhost:5173"
else
    echo "❌ Frontend failed to start or is not responding. Check frontend/frontend.log"
    exit 1
fi
```

## Step 5: Final Status Report
Provides a clean output confirming the stack is ready for development.

// turbo
```bash
echo ""
echo "🚀 SIGN SENSEI LIVE: FULL STACK IS RUNNING 🚀"
echo "------------------------------------------------"
echo "🌐 Frontend URL:  http://localhost:5173"
echo "⚙️  Backend API:   http://localhost:8000/docs"
echo "------------------------------------------------"
echo "You can view logs manually via 'cat backend.log' or 'cat frontend.log'"
```
