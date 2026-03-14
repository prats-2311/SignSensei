import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Request
import google.auth
from google.auth.transport.requests import Request as GoogleAuthRequest
import httpx
from bs4 import BeautifulSoup
from pydantic import BaseModel, Field
from typing import List
from google import genai

app = FastAPI(title="SignSensei Token Service")

# Allow requests from our React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://signsensei.web.app",
        "http://localhost:5173", 
        "http://127.0.0.1:5173"
    ], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
async def health_check():
    return {
        "status": "ok", 
        "deployed_via": "Terraform + GitHub Actions"
    }
    
@app.post("/api/diagnostics/log")
async def receive_client_log(request: Request):
    data = await request.json()
    level = data.get("level", "info").upper()
    msg = f"[CLIENT {level}] {data.get('timestamp')} - {data.get('message')}"
    if "context" in data:
        msg += f" | CONTEXT: {data['context']}"
    
    # 96m is Cyan to stand out in the terminal logs    
    print(f"\033[96m{msg}\033[0m")
    return {"status": "Logged"}

# --- GENERATIVE EXERCISE ARCHITECTURE ---
class GenerateLessonRequest(BaseModel):
    prompt: str = Field(..., description="The user's desired practice sentence, e.g., 'going for coffee'")

class LessonWord(BaseModel):
    word: str
    description: str

class GenerateLessonResponse(BaseModel):
    lessonId: str
    title: str
    description: str
    path: List[LessonWord]
    bossStageSentence: str

@app.post("/api/generate-lesson", response_model=GenerateLessonResponse)
async def generate_dynamic_lesson(req: GenerateLessonRequest):
    """
    Uses Gemini 2.5 Flash to generate a complete custom ASL lesson based
    on a natural language prompt from the user.
    """
    try:
        # Use standard Gemini API with API Key (avoids Vertex AI region/version issues)
        client = genai.Client(
            api_key=os.environ["GOOGLE_API_KEY"]
        )
        
        system_instruction = '''
        You are an expert American Sign Language (ASL) curriculum designer.
        The user wants to practice a specific phrase. 
        1. Break the phrase down into the core ASL vocabulary words needed. Ignore English fluff words that aren't typically signed (e.g., 'a', 'the', 'is' depending on context).
        2. For each core word, provide a highly specific, physical description of how to execute the gesture. Include starting hand shape, movement path, and ending position.
        3. Create a title and a short encouraging description for the lesson.
        4. Create a unique, URL-safe lessonId (e.g., 'custom_coffee_shop').
        5. Provide the 'bossStageSentence', which is just the core words separated by spaces.
        '''
        
        # Bulletproof method: Embed schema in system prompt & use JSON mode
        # This bypasses all SDK version/transformer bugs entirely.
        schema_text = """
        {
            "type": "object",
            "properties": {
                "lessonId": {"type": "string"},
                "title": {"type": "string"},
                "description": {"type": "string"},
                "path": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "word": {"type": "string"},
                            "description": {"type": "string"}
                        },
                        "required": ["word", "description"]
                    }
                },
                "bossStageSentence": {"type": "string"}
            },
            "required": ["lessonId", "title", "description", "path", "bossStageSentence"]
        }
        """
        
        full_system_instruction = f"{system_instruction}\n\nIMPORTANT: You must output valid JSON that strictly follows this schema:\n{schema_text}"
        
        response = await client.aio.models.generate_content(
            model='gemini-3.1-flash-lite-preview', # Confirmed from Vertex AI Console
            contents=req.prompt,
            config={
                "system_instruction": full_system_instruction,
                "response_mime_type": "application/json",
                "temperature": 0.2
            },
        )
        
        import json
        result_dict = json.loads(response.text)
        return result_dict
        
    except Exception as e:
        import traceback
        print(f"Error generating dynamic lesson: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to generate lesson via Gemini API")

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
        credentials.refresh(GoogleAuthRequest())
        
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
