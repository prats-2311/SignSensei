import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import google.auth
from google.auth.transport.requests import Request
import httpx
from bs4 import BeautifulSoup

app = FastAPI(title="SignSensei Token Service")

# Allow requests from our React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*","http://localhost:5173", "http://127.0.0.1:5173"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

# Simple in-memory cache to prevent spamming signasl.org during a session
# In production, use Redis or Memcached
video_cache = {}

@app.get("/api/sign/{word}")
async def get_sign_video(word: str):
    """
    Scrapes signasl.org for the given word and returns the first .mp4 video URL found.
    """
    word = word.lower().strip()
    
    # Check Cache first
    if word in video_cache:
        return {"word": word, "video_url": video_cache[word]}
        
    url = f"https://www.signasl.org/sign/{word}"
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=10.0)
            if response.status_code != 200:
                raise HTTPException(status_code=404, detail="Word not found in ASL dictionary")
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # The site embeds videos using standard HTML5 <video> tags
            # We look for the first <source src="... .mp4"> tag
            videos = soup.find_all('video')
            for video in videos:
                source = video.find('source')
                if source and source.has_attr('src'):
                    src = source['src']
                    if src.endswith('.mp4'):
                        video_cache[word] = src
                        return {"word": word, "video_url": src}
            
            raise HTTPException(status_code=404, detail="No video found for this word")
            
    except httpx.RequestError as e:
        print(f"Scraping Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch ASL video")

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
