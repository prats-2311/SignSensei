import { useState, useCallback, useRef, useEffect } from 'react';
import { useLessonStore } from '../../../stores/useLessonStore';

interface GeminiTokenResponse {
  token: string;
  project_id: string;
  expires_in: number;
}

const API_LOCATION = "us-central1"; 
const MODEL_NAME = "gemini-2.0-flash-exp"; 

export function useGeminiLive() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  
  const incrementXP = useLessonStore((state) => state.incrementXP);
  const resetCombo = useLessonStore((state) => state.resetCombo);
  const setFeedback = useLessonStore((state) => state.setFeedback);
  
  const connect = useCallback(async (onAudioData?: (base64Audio: string) => void) => {
    setIsConnecting(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:8000/api/token');
      if (!res.ok) throw new Error('Failed to fetch authentication token');
      const data: GeminiTokenResponse = await res.json();
      
      const WS_URL = `wss://${API_LOCATION}-aiplatform.googleapis.com/ws/google.cloud.aiplatform.v1beta1.LlmUtilityService/StreamDirectPredict?bearer_token=${data.token}`;
      
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connected. Sending setup message.");
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
                text: "You are SignSensei, an expert American Sign Language (ASL) tutor. You are cheerful, patient, and highly encouraging. Your goal is to help the user practice ASL. You can see their video stream and hear their audio. Provide feedback and use the tools available to update the UI."
              }]
            },
            tools: [
              {
                functionDeclarations: [
                  {
                    name: "update_avatar_state",
                    description: "Triggers a specific 3D avatar animation state.",
                    parameters: {
                      type: "OBJECT",
                      properties: {
                        state: {
                          type: "STRING",
                          enum: ["idle", "thumbs_up", "head_shake"]
                        }
                      },
                      required: ["state"]
                    }
                  }
                ]
              }
            ]
          }
        };
        ws.send(JSON.stringify(setupMessage));
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
              if (call.name === 'update_avatar_state') {
                const args = call.args as any;
                if (args.state === 'thumbs_up') {
                   incrementXP(10);
                   setFeedback("Excellent signing!", "success");
                } else if (args.state === 'head_shake') {
                   resetCombo();
                   setFeedback("Not quite right, let's try again.", "error");
                } else if (args.state === 'idle') {
                   setFeedback("", "idle");
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

      ws.onclose = () => {
        console.log("WebSocket connection closed.");
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
