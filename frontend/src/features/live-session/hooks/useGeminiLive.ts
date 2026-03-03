import { useState, useCallback, useRef, useEffect } from 'react';
import { useLessonStore } from '../../../stores/useLessonStore';
import { useUserStore } from '../../../stores/useUserStore';
import { LESSONS } from '../../../data/curriculum';

interface GeminiTokenResponse {
  token: string;
  project_id: string;
  expires_in: number;
}

const API_LOCATION = "us-central1"; 
const MODEL_NAME = "gemini-live-2.5-flash-native-audio"; 

export function useGeminiLive() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  
  const incrementXP = useUserStore((state) => state.incrementXP);
  const resetCombo = useLessonStore((state) => state.resetCombo);
  const setFeedback = useLessonStore((state) => state.setFeedback);
  
  const connect = useCallback(async (onAudioData?: (base64Audio: string) => void) => {
    setIsConnecting(true);
    setError(null);
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      const res = await fetch(`${baseUrl}/api/token`);
      if (!res.ok) throw new Error('Failed to fetch authentication token');
      const data: GeminiTokenResponse = await res.json();
      
      const WS_URL = `wss://${API_LOCATION}-aiplatform.googleapis.com/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent?bearer_token=${data.token}`;
      
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connected. Sending setup message.");
        
        const state = useLessonStore.getState();
        const targetWords = state.lessonPath;
        const firstWord = targetWords[0] || 'hello';
        
        const setupMessage = {
          setup: {
            model: `projects/${data.project_id}/locations/${API_LOCATION}/publishers/google/models/${MODEL_NAME}`,
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: "Aoede"
                  }
                }
              }
            },
            systemInstruction: {
              parts: [{
                text: `You are SignSensei, an expert American Sign Language (ASL) tutor. You are cheerful, patient, and highly encouraging. Your goal is to teach the user a sequence of words one at a time. The system starts you on the word '${firstWord}'. You must physically see the user sign the current word correctly. When they get it right, YOU MUST call mark_sign_correct. If they make a distinct error, call mark_sign_incorrect and verbally explain their mistake. If they are struggling and need to see a video of the sign, call show_sign_reference. Call finish_lesson ONLY when the system tells you the lesson is complete. The system will handle all UI tracking and tell you what the next word is after every correct sign. The full sequence today is: ${targetWords.join(', ')}.`
              }]
            },
            tools: [
              {
                functionDeclarations: [
                  {
                    name: "show_sign_reference",
                    description: "Shows a video of a real human performing the CURRENT active ASL sign to help the user learn. Call this if they are struggling.",
                  },
                  {
                    name: "mark_sign_correct",
                    description: "Call this immediately when the user successfully signs the current word. The system will automatically advance the UI and tell you the next word.",
                  },
                  {
                    name: "mark_sign_incorrect",
                    description: "Call this when the user makes a clear mistake trying to sign the current word.",
                  },
                  {
                    name: "finish_lesson",
                    description: "Triggers the end-of-lesson victory screen when you determine the user has completed their practice session.",
                  }
                ]
              }
            ]
          }
        };
        ws.send(JSON.stringify(setupMessage));
        
        // Tell Gemini the first word immediately upon connection
        const firstWordInit = useLessonStore.getState().lessonPath[0] || 'hello';
        ws.send(JSON.stringify({
            clientContent: {
                turns: [{
                    role: "user",
                    parts: [{ text: `System Notification: The session has started. The first word for the user to learn is '${firstWordInit}'.` }]
                }],
                turnComplete: true
            }
        }));
        
        setIsConnected(true);
        setIsConnecting(false);
      };

      ws.onmessage = async (event) => {
        try {
          let txt = "";
          if (event.data instanceof Blob) {
             txt = await event.data.text();
          } else {
             txt = event.data;
          }
          
          const msg = JSON.parse(txt);
          
          // Handle Setup Complete
          if (msg.setupComplete) {
              console.log("Gemini Setup Complete!");
          }

          // Handle incoming audio
          if (msg.serverContent && msg.serverContent.modelTurn) {
            const parts = msg.serverContent.modelTurn.parts;
            for (const part of parts) {
              if (part.inlineData && part.inlineData.mimeType.startsWith('audio/pcm')) {
                console.log(`Received audio chunk length: ${part.inlineData.data.length}`);
                if (onAudioData) onAudioData(part.inlineData.data);
              }
            }
          }

          // Handle tool calls
          if (msg.toolCall) {
            console.log("Tool call received:", msg.toolCall);
            const calls = msg.toolCall.functionCalls;
            const responses: any[] = [];

            for (const call of calls) {
              if (call.name === 'mark_sign_correct') {
                const store = useLessonStore.getState();
                const userStore = useUserStore.getState();
                
                store.setMascotEmotion('success');
                store.setFeedback("Excellent signing!", "success");
                userStore.incrementXP(10);
                store.advanceStep();
                
                // Fetch newly updated state
                const newState = useLessonStore.getState();
                let resultMessage = "";
                
                if (newState.isLessonComplete) {
                    resultMessage = "System: Lesson complete! You must now call finish_lesson.";
                } else {
                    const nextWord = newState.lessonPath[newState.currentStepIndex];
                    resultMessage = `System: UI advanced, user rewarded. The next word to teach is '${nextWord}'. Tell the user what the next word is and start evaluating them for it.`;
                }

                responses.push({
                   id: call.id,
                   response: { result: resultMessage }
                });
                
              } else if (call.name === 'mark_sign_incorrect') {
                const store = useLessonStore.getState();
                const userStore = useUserStore.getState();
                
                store.setMascotEmotion('error');
                store.resetCombo();
                store.setFeedback("Not quite right, let's try again.", "error");
                
                const currentWord = store.lessonPath[store.currentStepIndex];
                if (currentWord) {
                   userStore.recordWeakWord(currentWord);
                }

                responses.push({
                   id: call.id,
                   response: { result: "System: UI updated to show error state. Provide verbal feedback to the user." }
                });
                
              } else if (call.name === 'show_sign_reference') {
                const state = useLessonStore.getState();
                const signName = state.lessonPath[state.currentStepIndex];
                
                state.setAiPaused(true);
                state.setReferenceSign(signName);
                
                responses.push({
                   id: call.id,
                   response: { result: "System: User is now watching the reference video. AI Evaluation is paused." }
                });
                
              } else if (call.name === 'finish_lesson') {
                const lessonState = useLessonStore.getState();
                lessonState.setLessonComplete(true);
                
                // Unlock the next lesson in the Saga Map
                if (lessonState.activeLessonId) {
                   const currentIndex = LESSONS.findIndex(l => l.id === lessonState.activeLessonId);
                   if (currentIndex >= 0 && currentIndex < LESSONS.length - 1) {
                       const nextLessonId = LESSONS[currentIndex + 1].id;
                       useUserStore.getState().unlockLesson(nextLessonId);
                   }
                }
                
                responses.push({
                   id: call.id,
                   response: { result: "ok" }
                });
              }
            }

            if (responses.length > 0) {
               ws.send(JSON.stringify({
                  toolResponse: {
                     functionResponses: responses
                  }
               }));
            }
          }
        } catch (e) {
          console.error("Failed to parse incoming message", e);
        }
      };

      ws.onerror = (e) => {
        console.error("WebSocket error:", e);
        setError("WebSocket encountered an error.");
        setIsConnected(false);
        setIsConnecting(false);
      };

      ws.onclose = (event) => {
        console.log("WebSocket connection closed.", event.code, event.reason);
        setIsConnected(false);
      };

    } catch (err: any) {
      console.error(err);
      setError(err.message);
      setIsConnecting(false);
    }
  }, [incrementXP, resetCombo, setFeedback]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const sendAudioData = useCallback((base64Data: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const msg = {
        realtimeInput: {
          mediaChunks: [{
            mimeType: "audio/pcm;rate=16000",
            data: base64Data
          }]
        }
      };
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const sendVideoData = useCallback((base64Data: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const msg = {
        realtimeInput: {
          mediaChunks: [{
            mimeType: "image/jpeg",
            data: base64Data
          }]
        }
      };
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  useEffect(() => {
    return () => {
       disconnect();
    }
  }, [disconnect]);

  return {
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    sendAudioData,
    sendVideoData
  };
}
