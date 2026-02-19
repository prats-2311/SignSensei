import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import google.auth
from google.auth.transport.requests import Request

app = FastAPI(title="SignSensei Token Service")

# Allow requests from our React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

@app.get("/api/token")
async def generate_gemini_token():
    """
    Mints an ephemeral token using Application Default Credentials (ADC).
    Requires GOOGLE_APPLICATION_CREDENTIALS to be set in the environment,
    or runs seamlessly on Google Cloud Run using the attached service account.
    """
    try:
        # Request standard Cloud Platform scope
        credentials, project = google.auth.default(
            scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
        
        # Refresh the credentials to get a fresh access token
        credentials.refresh(Request())
        
        return {
            "token": credentials.token,
            "project_id": project,
            # Tokens typically expire in 3600 seconds (1 hour)
            "expires_in": 3600 
        }
    except Exception as e:
        print(f"Error generating token: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate Gemini Live API token")

if __name__ == "__main__":
    import uvicorn
    # When deployed to Cloud Run, it defines the PORT env var
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
