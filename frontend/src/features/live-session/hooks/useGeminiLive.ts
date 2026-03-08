import { useState, useCallback, useRef, useEffect } from 'react';
import { useLessonStore } from '../../../stores/useLessonStore';
import { useUserStore } from '../../../stores/useUserStore';
import { LESSONS } from '../../../data/curriculum';
import { logger } from '../../../shared/lib/logger';

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

      // Extract setup message generation so it can be rebroadcast to clear context
      const buildSetupMessage = (targetWord: string, allWords: string[]) => {
        return {
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
                text: `You are SignSensei, an expert American Sign Language (ASL) tutor. You are cheerful, patient, and highly encouraging. Your goal is to teach the user a sequence of words one at a time. THE CURRENT ACTIVE TARGET WORD IS '${targetWord}'.
                
CRITICAL EVALUATION RULES (Practice Mode):
You must evaluate the user's signing in three strict phases:
Phase 1 (Waiting): The user is getting ready. The system is operating at a low framerate to save bandwidth. Do not evaluate. Welcome them and ask if they are ready or if they want to see a video of the sign.
Phase 2 (Watching): The user pushes the 'Ready' button. The system switches to high framerate recording. The user's hands are moving, performing the sign. Actively track their movement, but DO NOT fire any tool calls yet. You must wait for them to finish.
Phase 3 (Completion & Evaluation): The user signals they are finished in ONE of two ways:
  A) Audio Signal: The user says "Done", "Check", "Finished", or similar.
  B) Visual Signal: The user holds a clear "Thumbs Up" gesture with either hand.
ONLY AFTER you detect one of these two completion signals, review the sign they performed immediately *before* the signal.
If they did the current target word correctly, call mark_sign_correct.
If they made a distinct error, call mark_sign_incorrect and verbally explain their mistake.

If they are struggling and need to see a video of the sign, call show_sign_reference. The system will handle closing the video when the user is done watching.
CRITICAL TOOL RULE: You must wait for the user to explicitly tell you they are ready to try signing. When they say they are ready, YOU MUST call trigger_action_window. Do not evaluate them until you have called this tool.
Call finish_lesson ONLY when the system tells you the lesson is complete. The system will handle all UI tracking and tell you what the next word is after every correct sign. The full sequence today is: ${allWords.join(', ')}.`
              }]
            },
            tools: [
              {
                functionDeclarations: [
                  {
                    name: "trigger_action_window",
                    description: "Call this tool ONLY when the user explicitly tells you they are ready to try signing. This will close any open videos and immediately start the 3-2-1 countdown timer.",
                  },
                  {
                    name: "show_sign_reference",
                    description: "Shows a video of a real human performing the CURRENT active ASL sign to help the user learn. Call this if they ask for help or are struggling.",
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
                  },
                  {
                    name: "mark_sentence_flow",
                    description: "Call this ONLY during the Boss Stage when the user has attempted to sign the full sentence. Evaluate their overall fluidity and accuracy.",
                    parameters: {
                      type: "OBJECT",
                      properties: {
                        score: {
                          type: "INTEGER",
                          description: "A star rating from 1 to 5 indicating how fluid and accurate their full sentence signing was."
                        },
                        feedback: {
                          type: "STRING",
                          description: "Specific, short encouraging feedback regarding their transitions between words and overall sentence flow."
                        }
                      },
                      required: ["score", "feedback"]
                    }
                  }
                ]
              }
            ],
            inputAudioTranscription: {},
            outputAudioTranscription: {}
          }
        };
      };

      ws.onopen = () => {
        console.log("WebSocket connected. Sending setup message.");
        
        const state = useLessonStore.getState();
        const targetWords = state.lessonPath;
        const currentActiveIndex = state.currentStepIndex;
        const firstWord = targetWords[currentActiveIndex] || targetWords[0] || 'hello';
        
        const setupMessage = buildSetupMessage(firstWord, targetWords);
        ws.send(JSON.stringify(setupMessage));
        
        const currentState = useLessonStore.getState();
        const currentPath = currentState.lessonPath;
        const activeWord = currentPath[currentActiveIndex] || 'hello';
        
        ws.send(JSON.stringify({
            clientContent: {
                turns: [{
                    role: "user",
                    parts: [{ text: `[SYSTEM NOTIFICATION] The WebSocket session has connected. The USER is currently at step ${currentActiveIndex + 1} of the lesson sequence. The active target word they must sign right now is '${activeWord}'. Focus ONLY on evaluating this word. Wait for them to trigger the action window.` }]
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

          // Handle incoming server content (audio and text)
          if (msg.serverContent) {
            // Documented: Model's Audio transcription returned here (Usually streamed in small word chunks)
            if (msg.serverContent.outputTranscription && msg.serverContent.outputTranscription.text) {
               logger.info(`💬 [Gemini Transcript]: ${msg.serverContent.outputTranscription.text}`);
            }
            
            // Documented: User's Audio transcription returned here
            if (msg.serverContent.inputTranscription && msg.serverContent.inputTranscription.text) {
               logger.info(`🗣️ [User Voice]: ${msg.serverContent.inputTranscription.text}`);
            }

            // Documented: Actual audio chunk payload
            if (msg.serverContent.modelTurn && msg.serverContent.modelTurn.parts) {
              const parts = msg.serverContent.modelTurn.parts;
              for (const part of parts) {
                // Legacy fallback just in case
                if (part.text) {
                  logger.info(`💬 [Gemini Transcript (v1)]: ${part.text.trim()}`);
                } else if (part.inlineData && part.inlineData.mimeType.startsWith('audio/pcm')) {
                  if (onAudioData) onAudioData(part.inlineData.data);
                }
              }
            }
          }

          // Handle tool calls
          if (msg.toolCall) {
            const calls = msg.toolCall.functionCalls;
            logger.info("📡 [Gemini WebSocket] Tool Call Payload Received", calls);
            
            const responses: any[] = [];

            for (const call of calls) {
              if (call.name === 'mark_sign_correct') {
                logger.info("✅ [Gemini Engine] mark_sign_correct triggered! Dispatching UI State Update.");
                
                const store = useLessonStore.getState();
                const userStore = useUserStore.getState();
                
                store.setMascotEmotion('success');
                store.setFeedback("Excellent signing!", "success");
                userStore.incrementXP(10);
                
                // CRITICAL FIX: The UI must reset to Phase 1 (Waiting for Ready).
                // If we don't unset practice mode here, it stays in Phase 2 (Recording) for the NEXT word,
                // and Gemini instantly grades the new word as incorrect before the human even hits Ready!
                store.setPracticeModeActive(false);
                
                store.advanceStep();
                
                // Let the success state breathe for 2 seconds, then reset
                setTimeout(() => {
                   useLessonStore.getState().resetStatusToIdle();
                   useLessonStore.getState().setFeedback("", "idle");
                }, 2000);
                
                // Fetch newly updated state
                const newState = useLessonStore.getState();
                let resultMessage = "";
                
                if (newState.isLessonComplete) {
                    // CRITICAL FIX: The UI has completely run out of words. 
                    // Do NOT ask Gemini to call `finish_lesson`. Doing so without proper context causes it to panic 
                    // and randomly fire `trigger_action_window` instead.
                    // Just tell it the lesson is over and to stand by forever.
                    resultMessage = "System: All words in the lesson have been completed! The curriculum is finished. Your objective: Enthusiastically congratulate the user on finishing the lesson. Do NOT ask them to sign any more words. Enter a permanent standby mode. DO NOT call trigger_action_window or any other evaluation tools.";
                    
                    responses.push({
                       id: call.id,
                       name: call.name,
                       response: { result: resultMessage }
                    });
                    
                    // We skip the Context Rotation block because there is no `nextWord` to rotate to!
                } else {
                    const nextWord = newState.lessonPath[newState.currentStepIndex];
                    resultMessage = `System: Lesson advanced! The NEW target word is '${nextWord}'. Your objective: Completely disregard all prior video frames. Enter Standby Mode (Phase 1). DO NOT evaluate or call trigger_action_window until the human user speaks into the microphone.`;
                    
                    responses.push({
                       id: call.id,
                       name: call.name,
                       response: { result: resultMessage }
                    });
                    
                    // CONTEXT ROTATION STRATEGY
                    // The Gemini Live API does strictly NOT allow sending a `setup` payload mid-session.
                    // Doing so kills the WebSocket. 
                    // To prevent Context Overload ("Lost in the Middle" hallucination), we cannot wipe memory.
                    // Instead, we forcefully rotate the context window out of relevance by injecting a massive, 
                    // highly redundant `clientContent` block that explicitly commands it to forget the past 
                    // and focus entirely on the new word.
                    setTimeout(() => {
                        ws.send(JSON.stringify({
                            clientContent: {
                                turns: [{
                                    role: "user",
                                    parts: [{ 
                                        text: `
[CRITICAL SYSTEM OVERRIDE - CONTEXT RESET]
The previous word was scored correctly. The curriculum has advanced.
YOU MUST ABSOLUTELY FORGET ALL PREVIOUS CONVERSATIONAL TURNS.

*** THE NEW TARGET WORD IS: '${nextWord}' ***
*** THE NEW TARGET WORD IS: '${nextWord}' ***
*** THE NEW TARGET WORD IS: '${nextWord}' ***

You are now in Phase 1 (Standby).
I am at the new word '${nextWord}'. 
Please explicitly introduce this new word and give me a brief tip on how to perform it.
After you introduce it, you MUST wait in standby mode. 
DO NOT call trigger_action_window. DO NOT evaluate. 
You must wait for the human to verbally say "Ready" before calling the timer.
` 
                                    }]
                                }],
                                turnComplete: true
                            }
                        }));
                    }, 500);
                }
                
              } else if (call.name === 'mark_sign_incorrect') {
                logger.warn("❌ [Gemini Engine] mark_sign_incorrect triggered!");
                
                const store = useLessonStore.getState();
                const userStore = useUserStore.getState();
                
                store.setMascotEmotion('error');
                store.resetCombo();
                store.setFeedback("Not quite right, let's try again.", "error");
                
                const currentWord = store.lessonPath[store.currentStepIndex];
                if (currentWord) {
                   userStore.recordWeakWord(currentWord);
                }
                
                // Let the error state breathe for 2 seconds, then reset
                setTimeout(() => {
                   useLessonStore.getState().resetStatusToIdle();
                   useLessonStore.getState().setFeedback("", "idle");
                }, 2000);

                // CRITICAL FIX: The UI must reset to Phase 1 (Waiting for Ready) on FAILURE as well.
                // If we don't unset practice mode here, the camera stays at 15fps and Gemini continues 
                // to rapid-fire grade the user's resting hands before they can even process the feedback!
                store.setPracticeModeActive(false);

                responses.push({
                   id: call.id,
                   name: call.name,
                   response: { result: `System: Incorrect sign handled. The user failed the sign for the target word '${currentWord || 'unknown'}'. Your objective: Verbally explain EXACTLY why they failed the target word '${currentWord || 'unknown'}'. Provide a brief tip on how to correct their hand shape or movement. Then, explicitly tell them they can say "Show me" to watch the reference video, or "I am ready" to try again. Enter standby mode (Phase 1) and DO NOT evaluate until they explicitly state they are ready again.` }
                });
                
              } else if (call.name === 'show_sign_reference') {
                logger.info("🎥 [Gemini Engine] show_sign_reference triggered. Popping up video modal and pausing AI.");
                const state = useLessonStore.getState();
                const signName = state.lessonPath[state.currentStepIndex];
                
                state.setAiPaused(true);
                state.setReferenceSign(signName);
                
                // Embed the instruction to wait directly into the tool completion response 
                // so Gemini doesn't treat a separate system notification as a new conversational turn
                responses.push({
                   id: call.id,
                   name: call.name,
                   response: { result: "System: Video modal opened successfully. The user is now watching the reference video. Your new objective: Wait in standby mode and listen. Only proceed and call trigger_action_window when the user verbally states they are ready to try." }
                });
                
              } else if (call.name === 'trigger_action_window') {
                logger.info("⏱️ [Gemini Engine] trigger_action_window triggered. Dispatching event to start practice mode.");
                
                // Clear the video modal to ensure it's not blocking the practice view
                const state = useLessonStore.getState();
                state.setReferenceSign(null);
                state.setAiPaused(false);
                
                // Dispatch a custom event that LiveSession.tsx can listen for
                window.dispatchEvent(new CustomEvent('start-practice-mode'));
                
                responses.push({
                   id: call.id,
                   name: call.name,
                   response: { result: "System: Countdown timer started. Wait for the user to finish signing and give the completion signal before evaluating." }
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
                   name: call.name,
                   response: { result: "ok" }
                });
              } else if (call.name === 'mark_sentence_flow') {
                logger.info("🌟 [Gemini Engine] mark_sentence_flow triggered! Boss Stage Complete.");
                
                // Typecast args to match expected shape
                const args = call.args as { score: number, feedback: string };
                const score = args.score !== undefined ? args.score : 5;
                const feedback = args.feedback || "Great job completing the flow!";
                
                const lessonState = useLessonStore.getState();
                
                // Award bonus XP for finishing the boss stage
                useUserStore.getState().incrementXP(score * 10);
                
                // Complete the flow which triggers the enhanced Victory modal
                lessonState.completeLessonFlow(score, feedback);
                
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
                   name: call.name,
                   response: { result: "System: Boss Stage evaluation complete. UI updated." }
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
    // Listen for Boss Stage transition to inject the system prompt
    const unsub = useLessonStore.subscribe((state, prevState) => {
      if (state.isBossStage && !prevState.isBossStage && wsRef.current?.readyState === WebSocket.OPEN) {
        logger.info("🔥 Boss Stage triggered. Injecting system prompt into Gemini.");
        const words = state.lessonPath.join(', ');
        wsRef.current.send(JSON.stringify({
            clientContent: {
                turns: [{
                    role: "user",
                    parts: [{ text: `[SYSTEM NOTIFICATION] You are now in the Boss Stage. The user must sign the following sequence of words as a single fluid sentence: ${words}. Wait for them to say they are ready, then start the timer. When they say done, evaluate their fluidity, accuracy, and transitions out of 5 stars using the mark_sentence_flow tool.` }]
                }],
                turnComplete: true
            }
        }));
      }
    });
    
    return () => {
       unsub();
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
