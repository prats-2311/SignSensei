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
  const actionWindowStartTimeRef = useRef<number>(0);
  const connectionTimestampRef = useRef<number>(0);
  const audioCallbackRef = useRef<((base64Audio: string) => void) | undefined>(undefined);
  
  const connect = useCallback(async (onAudioData?: (base64Audio: string) => void) => {
    if (onAudioData) audioCallbackRef.current = onAudioData;
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
                text: `# Role
You are SignSensei, an expert, encouraging ASL tutor. Your goal is to guide the user through a progression of ASL vocabulary.

# Current State
**Active Target Word:** '${targetWord}'
**Current Lesson Path:** ${allWords.join(', ')}

# The Evaluation Protocol
You MUST strictly adhere to the following phase constraints to keep the UI synchronized:

## PHASE 1: Pre-Teaching (Current State upon loading a word)
*   **Your Goal:** Introduce the active target word and wait. The user is getting ready.
*   **Disabled Tools:** 'mark_sign_correct', 'mark_sign_incorrect', 'mark_sentence_flow'. YOU CANNOT GRADE The user in this phase.
*   **Transition Trigger:** Wait for the user to explicitly say "Ready" or "Let's Go". Only upon this trigger, execute the 'trigger_action_window' tool to enter Phase 2.

## PHASE 2: Recording & Grading (Active only after calling trigger_action_window)
*   **For Single Words:** A timer has started. The user is actively moving their hands. You must evaluate their movements IMMEDIATELY. Call 'mark_sign_correct' the INSTANT you see the correct gesture. DO NOT wait for them to say 'Done'.
*   **For Boss Stage (Sentence):** You must wait for the user to verbally say "Done" or "Finished" before calling 'mark_sentence_flow'. DO NOT grade the sequence until they utter the completion signal.
*   **Post-Action:** Calling any grading tool reconnects the socket automatically.`
              }]
            },
            tools: [
              {
                functionDeclarations: [
                  {
                    name: "trigger_action_window",
                    description: "Transitions to Phase 2. Call ONLY when the user verbally says 'Ready' for the CURRENT word. Do NOT call this immediately after loading a word.",
                  },
                  {
                    name: "show_sign_reference",
                    description: "AVAILABLE IN PHASE 1. Shows a video of a human performing the CURRENT target sign. Call this if the user asks for help or wants to see a video.",
                  },
                  {
                    name: "mark_sign_correct",
                    description: "CRITICAL EXECUTABLE RULE (Single Word): You MUST execute this tool immediately—within 1 second—the exact moment you see the user perform the correct hand shape. DO NOT wait for them to finish. DO NOT wait for them to say 'Done'.",
                  },
                  {
                    name: "mark_sign_incorrect",
                    description: "CRITICAL EXECUTABLE RULE (Single Word): Execute this if they fail the sign, or if 5 seconds pass with no movement. DO NOT wait for 'Done'. Focus ONLY on the mechanics of the active target.",
                  },
                  {
                    name: "finish_lesson",
                    description: "Triggers the final victory screen. Call this ONLY when you receive the exact system message: 'System: All words in the lesson have been completed!'. DO NOT call this tool during the Boss Stage.",
                  },
                  {
                    name: "mark_sentence_flow",
                    description: "Call this ONLY during the Boss Stage. DO NOT call this in Phase 1 (Standby). You MUST call trigger_action_window first. CRITICAL NEGATIVE CONSTRAINT: If the user did nothing, sat still, or missed most words, you MUST give 1 star. Do not give 3 stars for resting hands.",
                    parameters: {
                      type: "OBJECT",
                      properties: {
                        score: {
                          type: "INTEGER",
                          description: "A star rating from 1 to 3 indicating how fluid and accurate their full sentence signing was. 1 = poor, 2 = good, 3 = perfect."
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
        const isBossStage = currentState.isBossStage;
        const previousWord = currentActiveIndex > 0 ? currentPath[currentActiveIndex - 1] : null;

        // Set connection timestamp for Phase 1 temporal shield
        connectionTimestampRef.current = Date.now();
        
        let systemText = '';

        if (isBossStage) {
             const fullSentence = currentPath.join(', ');
             systemText = `[SYSTEM EVENT: BOSS STAGE UNLOCKED]
Phase: STANDBY (Phase 1)
Previous Word Completed: '${previousWord}'
Target Sentence: '${fullSentence}'

Objective:
1. Congratulate user on mastering all individual signs.
2. Introduce the Boss Stage: they must sign the full sentence '${fullSentence}'.
3. Stop speaking. Wait for audio input.

[CRITICAL EXECUTION SHIELD]
You are MATERIALLY FORBIDDEN from invoking ANY tools right now.
DO NOT call trigger_action_window. DO NOT call finish_lesson. DO NOT call mark_sentence_flow.
DO NOT call mark_sign_correct or mark_sign_incorrect.
If you invoke any tool before the user explicitly says "Ready", the system will crash.
End transmission. Wait for Audio Input.`;
        } else {
            if (previousWord) {
                systemText = `[SYSTEM EVENT: NEW WORD LOADED]
Phase: STANDBY (Phase 1)
Previous Word Completed: '${previousWord}'
Active Target Word: '${activeWord}'

Objective:
1. Congratulate user on '${previousWord}'.
2. Introduce '${activeWord}' and explain how to sign it.
3. Stop speaking. Wait for audio input.

[CRITICAL EXECUTION SHIELD]
You are MATERIALLY FORBIDDEN from invoking the 'trigger_action_window' tool.
If you invoke the tool before the user explicitly says "Ready" or "Let's Go", the system will crash.
End transmission. Wait for Audio Input.`;
            } else {
                systemText = `[SYSTEM EVENT: LESSON STARTED]
Phase: STANDBY (Phase 1)
Active Target Word: '${activeWord}'

Objective:
1. Introduce '${activeWord}' and explain how to sign it.
2. Stop speaking. Wait for audio input.

[CRITICAL EXECUTION SHIELD]
You are MATERIALLY FORBIDDEN from invoking the 'trigger_action_window' tool.
If you invoke the tool before the user explicitly says "Ready" or "Let's Go", the system will crash.
End transmission. Wait for Audio Input.`;
            }
        }
        
        ws.send(JSON.stringify({
            clientContent: {
                turns: [{
                    role: "user",
                    parts: [{ text: systemText }]
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
            
            // Documented: User's Audio transcription returned here (used for Event-Driven Lockout Drops)
            if (msg.serverContent.inputTranscription && msg.serverContent.inputTranscription.text) {
               const rawTranscript = msg.serverContent.inputTranscription.text;
               logger.info(`🗣️ [User Voice]: ${rawTranscript}`);
               
               const lowerTranscript = rawTranscript.toLowerCase();
               if (lowerTranscript.includes("done") || lowerTranscript.includes("finished")) {
                   // Event-Driven trigger: Drops the lockout shields for Boss Stage grading
                   useLessonStore.getState().setHasUserSignaledDone(true);
                   logger.info("🔓 [Frontend Gatekeeper] User said 'Done/Finished'. Grading tools are now unlocked.");
               }
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
            
            const responses: { id: string; name: string; response: { result: string } }[] = [];

            for (const call of calls) {
              if (call.name === 'mark_sign_correct') {
                const store = useLessonStore.getState();
                
                // --- TEMPORAL GATEKEEPER (HYBRID UX: FAST SUCCESS) ---
                // 3. The Reconnection architecture guarantees every new WebSocket starts with a perfectly clean context state.
                // Therefore, we no longer need the 2.5 second lockout. If Gemini sees the sign correctly in 500ms, let it pass!
                const TEMPORAL_LOCKOUT = 500; // Reduced from 2500ms to allow true Fast UX, just 500ms to debounce
                const timeSinceStart = Date.now() - actionWindowStartTimeRef.current;

                if (timeSinceStart < TEMPORAL_LOCKOUT && store.isPracticeModeActive) {
                    logger.warn(`🚫 [Temporal Lockout] Gemini attempted to mark correct too quickly (${timeSinceStart}ms)! Hand-waiving debounce.`);
                    const currentWord = store.lessonPath[store.currentStepIndex];
                    responses.push({
                        id: call.id,
                        name: call.name,
                        response: { 
                            result: `[SYSTEM ERROR - TEMPORAL LOCKOUT] You attempted to grade the user just ${timeSinceStart}ms after starting the timer.
CRITICAL INSTRUCTION: DO NOT SPEAK. DO NOT APOLOGIZE. GENERATE NO AUDIO. Watch the user SILENTLY for at least ${TEMPORAL_LOCKOUT}ms. Target: '${currentWord}'.` 
                        }
                    });
                    continue; 
                }

                // --- FRONTEND GATEKEEPER ---
                // Physically prevents the AI from grading if the Phase 2 timer never started.
                if (!store.isPracticeModeActive) {
                    logger.warn("🚫 [System Lockout] Gemini attempted to call mark_sign_correct before trigger_action_window was called! Ignoring hallucination.");
                    const currentWord = store.lessonPath[store.currentStepIndex];
                    responses.push({
                        id: call.id,
                        name: call.name,
                        response: { 
                            result: `[SYSTEM ERROR - ACTION BLOCKED] You attempted to grade the user before calling trigger_action_window.
CRITICAL INSTRUCTION: DO NOT SPEAK. DO NOT APOLOGIZE. GENERATE NO AUDIO. Wait silently in Phase 1 Standby mode. DO NOT evaluate the user until they say 'Ready' and you call trigger_action_window. Target: '${currentWord}'.` 
                        }
                    });
                    continue; 
                }

                logger.info("✅ [Gemini Engine] mark_sign_correct triggered! Dispatching UI State Update.");
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
                    resultMessage = "System: All words in the lesson have been completed! The curriculum is finished. Your objective: Enthusiastically congratulate the user on finishing the lesson. Do NOT ask them to sign any more words. Enter a permanent standby mode. DO NOT call trigger_action_window or any other evaluation tools.";
                    
                    responses.push({
                       id: call.id,
                       name: call.name,
                       response: { result: resultMessage }
                    });
                } else if (newState.isBossStage) {
                     // --- BOSS STAGE TRANSITION: OPTIMISTIC DISCONNECT ---
                     // When the last individual word is completed, advanceStep() sets isBossStage = true.
                     // We MUST disconnect and reconnect so the new setup message properly introduces
                     // the Boss Stage with clean context. Keeping the stale connection causes hallucination loops.
                     logger.info("⚡ [Gemini Engine] Boss Stage unlocked! Initiating Optimistic Disconnect for Boss Stage transition...");
                     ws.close();
                     wsRef.current = null;
                     setIsConnected(false);
                     
                     // Reconnect after the green checkmark plays out (2 seconds for Boss Stage intro)
                     setTimeout(() => {
                         if (audioCallbackRef.current) {
                             connect(audioCallbackRef.current);
                         }
                     }, 2000);
                     
                     // Don't push a toolResponse — this connection is dead!
                     continue;
                } else {
                    // --- NEW RECONNECTION ARCHITECTURE ---
                    logger.info("⚡ [Gemini Engine] Initiating Optimistic Disconnect for clean state transfer...");
                    ws.close(); // Forcefully kill the sticky connection
                    wsRef.current = null;
                    setIsConnected(false);
                    
                    // Reconnect after the green checkmark plays out (1.5 seconds)
                    setTimeout(() => {
                        if (audioCallbackRef.current) {
                            connect(audioCallbackRef.current);
                        }
                    }, 1500);
                    
                    // We DO NOT push a toolResponse because this connection is dead!
                    continue; 
                }
                
              } else if (call.name === 'mark_sign_incorrect') {
                const store = useLessonStore.getState();

                // --- TEMPORAL GATEKEEPER (HYBRID UX: PATIENT FAILURE) ---
                const timeSinceStart = Date.now() - actionWindowStartTimeRef.current;
                if (timeSinceStart < 4000 && store.isPracticeModeActive) { // Increased to 4 seconds for a grace period
                    logger.warn(`🚫 [Temporal Lockout - Grace Period] Gemini attempted to mark incorrect too quickly (${timeSinceStart}ms)! Forcing patience.`);
                    const currentWord = store.lessonPath[store.currentStepIndex];
                    responses.push({
                        id: call.id,
                        name: call.name,
                        response: { 
                            result: `[SYSTEM ERROR - TEMPORAL LOCKOUT] You attempted to fail the user just ${timeSinceStart}ms after starting the timer. 
CRITICAL INSTRUCTION: DO NOT SPEAK. DO NOT APOLOGIZE. You must give them at least 4 seconds to figure it out. Watch silently and wait. Target: '${currentWord}'.` 
                        }
                    });
                    continue; 
                }
                
                // --- FRONTEND GATEKEEPER ---
                // Physically prevents the AI from grading if the Phase 2 timer never started.
                if (!store.isPracticeModeActive) {
                    logger.warn("🚫 [System Lockout] Gemini attempted to call mark_sign_incorrect before trigger_action_window was called! Ignoring hallucination.");
                    const currentWord = store.lessonPath[store.currentStepIndex];
                    responses.push({
                        id: call.id,
                        name: call.name,
                        response: { 
                            result: `[SYSTEM ERROR - ACTION BLOCKED] You attempted to grade the user before calling trigger_action_window.
CRITICAL INSTRUCTION: DO NOT SPEAK. DO NOT APOLOGIZE. GENERATE NO AUDIO. Wait silently in Phase 1 Standby mode. DO NOT evaluate the user until they say 'Ready' and you call trigger_action_window. Target: '${currentWord}'.` 
                        }
                    });
                    continue; 
                }

                logger.warn("❌ [Gemini Engine] mark_sign_incorrect triggered!");
                
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
                   response: { result: `
[SYSTEM OVERRIDE: TOOL EXECUTION SUCCESSFUL]
The user failed the sign for the target word: '${currentWord || 'unknown'}'.

Your Immediate Objective:
1. Verbally state: "That is not the sign for ${currentWord || 'unknown'}." or similar.
2. Provide a constructive tip on how to fix their hand shape or movement specifically for '${currentWord || 'unknown'}'.
3. CRITICAL: DO NOT mention any other signs they may have accidentally performed. Only talk about '${currentWord || 'unknown'}'.
4. Tell them they can say "Show me" to watch the reference video, or "Ready" to try '${currentWord || 'unknown'}' again.
5. Enter Phase 1 (Standby) and wait.

# CRITICAL PHASE 1 RULES:
* DO NOT advance the curriculum. 
* DO NOT call trigger_action_window.
* DO NOT evaluate my resting hands.
* You must wait for the human to verbally say "Ready" before calling the timer again.
` }
                });
                
              } else if (call.name === 'show_sign_reference') {
                logger.info("🎥 [Gemini Engine] show_sign_reference triggered. Popping up video modal and pausing AI.");
                const state = useLessonStore.getState();
                const signName = state.lessonPath[state.currentStepIndex];
                
                if (state.isBossStage) {
                    // Intercept video request during Boss Stage because there is no single video for a full sentence
                    state.setAiPaused(false);
                    const fullSentence = state.lessonPath.join(', ');
                    responses.push({
                        id: call.id,
                        name: call.name,
                        response: {
                           result: `SYSTEM ERROR: You cannot open a video during the Boss Stage. Your Objective: Apologize and verbally explain to the user that there is no video for the full sentence '${fullSentence}'. Tell them they must try to remember the individual signs and string them together.`
                        }
                    });
                } else {
                    state.setAiPaused(true);
                    state.setReferenceSign(signName);
                    
                    // Universal State Re-Injection
                    // We must explicitly anchor the target word so the AI doesn't hallucinate 
                    // what video it just opened based on older transcript memories.
                    responses.push({
                       id: call.id,
                       name: call.name,
                       response: { 
                           result: `
[SYSTEM EVENT: VIDEO REFERENCE OPENED]
Phase: STANDBY (Phase 1)
Active Target Word: '${signName}'
Status: Video is now playing for the user.

Objective:
1. Say: "I've pulled up the video for '${signName}'."
2. Stop speaking. Wait for audio input.

[CRITICAL EXECUTION SHIELD]
You are in Phase 1. DO NOT call mark_sign_correct or mark_sign_incorrect.
When the user says "Ready", call trigger_action_window.
Then execute FAST UX: grade IMMEDIATELY on gesture detection. DO NOT wait for "Done".
End transmission. Wait for Audio Input.
` 
                       }
                    });
                }
                
              } else if (call.name === 'trigger_action_window') {
                // --- PHASE 1 TEMPORAL SHIELD ---
                // Prevents the AI from hallucinating trigger_action_window immediately upon connection.
                // The AI must wait at least 3 seconds after connecting to give the user time to hear the intro.
                const timeSinceConnection = Date.now() - connectionTimestampRef.current;
                const PHASE1_COOLDOWN = 3000;
                
                if (timeSinceConnection < PHASE1_COOLDOWN) {
                    logger.warn(`🚫 [Phase 1 Shield] Gemini hallucinated trigger_action_window just ${timeSinceConnection}ms after connection! Blocking.`);
                    const state = useLessonStore.getState();
                    const currentWord = state.lessonPath[state.currentStepIndex];
                    responses.push({
                        id: call.id,
                        name: call.name,
                        response: {
                            result: `[SYSTEM ERROR: FATAL - EXECUTION SHIELD TRIGGERED]
You invoked trigger_action_window before the user said "Ready".
The user has NOT spoken yet. You connected ${timeSinceConnection}ms ago.
CRITICAL: DO NOT SPEAK. DO NOT APOLOGIZE. GENERATE NO AUDIO.
You must wait for the user to verbally say "Ready" before calling this tool.
Target: '${currentWord}'.`
                        }
                    });
                    continue;
                }

                logger.info(`⏱️ [Gemini Engine] ${call.name} triggered. Dispatching event to start practice mode.`);
                window.dispatchEvent(new Event('trigger_action_window'));
                actionWindowStartTimeRef.current = Date.now();
                
                // Clear the video modal to ensure it's not blocking the practice view
                const state = useLessonStore.getState();
                state.setReferenceSign(null);
                state.setAiPaused(false);
                
                const isBossStage = state.isBossStage;
                const activeWord = state.lessonPath[state.currentStepIndex];

                let actionMessage = "";
                
                if (isBossStage) {
                    actionMessage = `
[SYSTEM CONFIGURATION OVERRIDE: SILENT MODE ACTIVATED]
Target Sequence: '${state.lessonPath.join(', ')}'
Task: Watch user sign sequence. Wait for 'Done' signal.
Voice_Output: FALSE (Do not generate conversational audio responses to this block).
CRITICAL RULE: FORBIDDEN to call mark_sentence_flow until user explicitly says 'Done' or 'Finished'.
`;
                } else {
                    actionMessage = `
[SYSTEM CONFIGURATION OVERRIDE: SILENT MODE ACTIVATED]
Target Word: '${activeWord}'
Task: Execute 'mark_sign_correct' precisely when gesture matches target.
Voice_Output: FALSE (Do not generate conversational audio responses to this block).
CRITICAL RULE: Execute instantly on detection. DO NOT WAIT for 'Done'.
`;
                }

                responses.push({
                   id: call.id,
                   name: call.name,
                   response: { result: actionMessage }
                });
                
                // ALWAYS RESET THE BOSS STAGE SHIELD ON A NEW ATTEMPT
                state.setHasUserSignaledDone(false);
                
                // Dispatch a custom event that LiveSession.tsx can listen for
                window.dispatchEvent(new CustomEvent('start-practice-mode'));
                
                const currentWord = state.lessonPath[state.currentStepIndex];
                
                // Universal State Re-Injection
                // Explicitly bind the target word so the LLM doesn't grade a multi-word sequence
                // against the wrong target if the user fumbles.
                if (state.isBossStage) {
                    const fullSentence = state.lessonPath.join(', ');
                    responses.push({
                        id: call.id,
                        name: call.name,
                        response: { 
                            result: `
[SYSTEM CONFIGURATION OVERRIDE: SILENT MODE ACTIVATED]
Phase: BOSS_STAGE_RECORDING
Target: '${fullSentence}'
Rules:
1. Observe user's hand movements.
2. Voice_Output: FALSE. End transmission. Do not speak. 
3. DO NOT call mark_sentence_flow until the exact moment the user verbally says 'Done' or 'Finished'.
`
                        }
                    });
                } else {
                    responses.push({
                       id: call.id,
                       name: call.name,
                       response: { 
                           result: `
[SYSTEM CONFIGURATION OVERRIDE: SILENT MODE ACTIVATED]
Phase: SINGLE_WORD_RECORDING
Target: '${currentWord}'
Rules:
1. Observe video stream continuously.
2. Voice_Output: FALSE. End transmission. Do not speak.
3. Call mark_sign_correct IMMEDIATELY upon seeing the correct sign. DO NOT wait for them to speak.
4. Call mark_sign_incorrect if 5s pass with no movement or incorrect sign.
`
                       }
                    });
                }
                
              } else if (call.name === 'finish_lesson') {
                const lessonState = useLessonStore.getState();

                if (lessonState.isBossStage && !lessonState.isLessonComplete) {
                     logger.warn("🚫 [System Lockout] Gemini attempted to call finish_lesson before Boss Stage was evaluated! Ignoring hallucination.");
                     responses.push({
                         id: call.id,
                         name: call.name,
                         response: { 
                             result: `[SYSTEM ERROR] You attempted to finish the lesson, but the Boss Stage is still active. 
CRITICAL INSTRUCTION: DO NOT SPEAK. YOU MUST WAIT FOR THE USER TO COMPLETE THE BOSS STAGE.` 
                         }
                     });
                     continue;
                }

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

                // --- TEMPORAL AND EVENT-DRIVEN GATEKEEPER (HYBRID UX: STRICT BOSS STAGE) ---
                const timeSinceStart = Date.now() - actionWindowStartTimeRef.current;
                const store = useLessonStore.getState();
                
                // Physical Minimum Time: Impossible to sign a multi-word sequence in under 5 seconds.
                if (timeSinceStart < 5000 && store.isPracticeModeActive) { 
                    logger.warn(`🚫 [Temporal Lockout - Boss Stage] Gemini attempted to grade Boss Stage too quickly (${timeSinceStart}ms)! Blocking.`);
                    const fullSentence = store.lessonPath.join(', ');
                    responses.push({
                        id: call.id,
                        name: call.name,
                        response: {
                            result: `[SYSTEM ERROR - TEMPORAL LOCKOUT] You attempted to grade the entire sentence just ${timeSinceStart}ms after starting the timer.
CRITICAL INSTRUCTION: DO NOT SPEAK. DO NOT APOLOGIZE. Watch the user SILENTLY for at least 5 seconds, AND wait for them to explicitly say 'Done'. Target: '${fullSentence}'.`
                        }
                    });
                    continue;
                }

                // --- FRONTEND GATEKEEPER (ANTI-HALLUCINATION) ---
                // Physically prevents the AI from grading if the Phase 2 timer never started.
                if (!store.isPracticeModeActive) {
                    logger.warn("🚫 [System Lockout] Gemini attempted to call mark_sentence_flow before trigger_action_window was called! Ignoring hallucination.");
                    const fullSentence = store.lessonPath.join(', ');
                    responses.push({
                        id: call.id,
                        name: call.name,
                        response: {
                            result: `[SYSTEM ERROR - ACTION BLOCKED] You attempted to grade the user before calling trigger_action_window.
CRITICAL INSTRUCTION: DO NOT SPEAK. DO NOT APOLOGIZE. GENERATE NO AUDIO. Wait silently in Phase 1 Standby mode. DO NOT evaluate the user until they say 'Ready' and you call trigger_action_window. Target: '${fullSentence}'.`
                        }
                    });
                    continue;
                }

                if (!store.hasUserSignaledDone && store.isPracticeModeActive) {
                    logger.warn(`🚫 [Event Lockout] Gemini attempted to grade Boss Stage before user said "Done"! Blocking.`);
                    const fullSentence = store.lessonPath.join(', ');
                    responses.push({
                        id: call.id,
                        name: call.name,
                        response: { 
                            result: `[SYSTEM ERROR - EVENT LOCKOUT] You attempted to grade the sentence sequence before the user gave the completion signal.
CRITICAL INSTRUCTION: DO NOT SPEAK. DO NOT APOLOGIZE. GENERATE NO AUDIO. You MUST WAIT SILENTLY until the human explicitly says "Done" or "Finished". Target sequence: '${fullSentence}'.` 
                        }
                    });
                    continue; 
                }
                
                const args = call.args as { score: number, feedback: string };
                const score = Math.min(3, Math.max(1, args.score !== undefined ? args.score : 3));
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
                
                // Persist the lesson score for the Saga Map stars
                if (lessonState.activeLessonId) {
                    useUserStore.getState().setLessonScore(lessonState.activeLessonId, score);
                }
                
                const passedBossStage = score >= 2;
                if (passedBossStage) {
                    responses.push({
                       id: call.id,
                       name: call.name,
                       response: { result: "System: Boss Stage passed successfully. The curriculum is complete." }
                    });
                } else {
                    // Inject Failure Amnesia Guardrail
                    const fullSentence = store.lessonPath.join(', ');
                    responses.push({
                       id: call.id,
                       name: call.name,
                       response: { 
                           result: `[SYSTEM OVERRIDE: BOSS STAGE FAILED]
The user scored ${score}/3. They did not pass the Boss Stage.
They must retry the Boss Stage.

Your Immediate Objective:
1. Explain why they got a low score and encourage them to try again.
2. Wait in standby mode for them to say "Ready" again.

CRITICAL RULES FOR RETRY:
* You are STILL in the Boss Stage. The target is STILL the full sentence: '${fullSentence}'.
* YOU MUST NOT use 'mark_sign_correct' or 'mark_sign_incorrect' under ANY circumstances during this retry.
* DO NOT call trigger_action_window until they say "Ready".
* CRITICAL: YOU MUST NOT CALL 'mark_sentence_flow' AGAIN until AFTER you have called 'trigger_action_window' and the human signals completion. Do not grade resting hands in standby mode.`
                       }
                    });
                }
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

    } catch (err: unknown) {
      console.error(err);
      if (err instanceof Error) {
          setError(err.message);
      } else {
          setError("An unknown error occurred during connection.");
      }
      setIsConnecting(false);
    }
  }, []);

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
