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
                text: `# Role
You are SignSensei, an expert, encouraging ASL tutor. Your goal is to guide the user through a progression of ASL vocabulary.

# Current State
**Active Target Word:** '${targetWord}'
**Current Lesson Path:** ${allWords.join(', ')}

# The 3-Phase Evaluation Protocol
You MUST strictly adhere to the following phase constraints to keep the UI synchronized:

## PHASE 1: Pre-Teaching (Current State upon loading a word)
*   **Your Goal:** Introduce the active target word and wait. The user is getting ready.
*   **Allowed User Actions:** Asking questions, or asking to see a reference video.
*   **Allowed Tools:** 'show_sign_reference' (ONLY if requested).
*   **Disabled Tools:** 'mark_sign_correct', 'mark_sign_incorrect', 'mark_sentence_flow'. YOU CANNOT GRADE THE USER IN THIS PHASE.
*   **Transition Trigger:** Wait for the user to explicitly say "Ready" or "Let's Go". Only upon this trigger, execute the 'trigger_action_window' tool to enter Phase 2.

## PHASE 2: Recording (Active only after calling trigger_action_window)
*   **Your Goal:** A 3-2-1 timer has started. The user is actively moving their hands. You must WATCH SILENTLY.
*   **Allowed Tools:** NONE. Do not evaluate them while they are practicing.
*   **Transition Trigger:** Wait for the user to provide a "Completion Signal" (verbally saying "Done" or holding a Thumbs Up).

## PHASE 3: Grading (Active only after a Completion Signal)
*   **Your Goal:** Evaluate the final sequence of frames *immediately preceding* the Completion Signal.
*   **Allowed Tools:** 'mark_sign_correct' OR 'mark_sign_incorrect'.
*   **Feedback Rule:** If incorrect, you must verbally explain the mistake.
*   **CRITICAL RULE:** If the user did not move their hands, sat still, or did nothing, you MUST call mark_sign_incorrect. DO NOT mark resting hands as correct.
*   **Post-Action:** Calling either grading tool automatically returns you to Phase 1. Wait for instructions.`
              }]
            },
            tools: [
              {
                functionDeclarations: [
                  {
                    name: "trigger_action_window",
                    description: "Transitions system from Phase 1 to Phase 2. Call this ONLY when the user explicitly says they are ready. CRITICAL: After calling this, you MUST WAIT SILENTLY for a Completion Signal ('Done' or 'Thumbs Up') before evaluating their sign.",
                  },
                  {
                    name: "show_sign_reference",
                    description: "AVAILABLE IN PHASE 1. Shows a video of a human performing the CURRENT target sign. Call this if the user asks for help or wants to see a video.",
                  },
                  {
                    name: "mark_sign_correct",
                    description: "ONLY AVAILABLE IN PHASE 3. Call this if the user correctly performed the target word. CRITICAL NEGATIVE CONSTRAINT: If the user did nothing, sat still, or did not attempt the sign at all, you MUST NOT call this tool. Do not mark resting hands as correct. DO NOT use in Phase 1.",
                  },
                  {
                    name: "mark_sign_incorrect",
                    description: "ONLY AVAILABLE IN PHASE 3. Call this if they failed the sign, OR if they did nothing/sat still. You must verbally explain their error (e.g., 'You didn't sign anything' or 'Your hand shape was wrong'). DO NOT use in Phase 1.",
                  },
                  {
                    name: "finish_lesson",
                    description: "Triggers the final victory screen. Call this ONLY when you receive the exact system message: 'System: All words in the lesson have been completed!'. DO NOT call this tool during the Boss Stage.",
                  },
                  {
                    name: "mark_sentence_flow",
                    description: "Call this ONLY during the Boss Stage. CRITICAL NEGATIVE CONSTRAINT: If the user did nothing, sat still, or missed most words, you must give a low score (1 or 2 stars). Do not give 5 stars for resting hands.",
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
            
            const responses: { id: string; name: string; response: { result: string } }[] = [];

            for (const call of calls) {
              if (call.name === 'mark_sign_correct') {
                const store = useLessonStore.getState();
                
                // --- TEMPORAL GATEKEEPER ---
                const timeSinceStart = Date.now() - actionWindowStartTimeRef.current;
                if (timeSinceStart < 2000 && store.isPracticeModeActive) {
                    logger.warn(`🚫 [Temporal Lockout] Gemini attempted to mark correct too quickly (${timeSinceStart}ms)! Ignoring hallucination.`);
                    const currentWord = store.lessonPath[store.currentStepIndex];
                    responses.push({
                        id: call.id,
                        name: call.name,
                        response: { 
                            result: `[SYSTEM ERROR - TEMPORAL LOCKOUT] You attempted to grade the user just ${timeSinceStart}ms after starting the timer.
CRITICAL INSTRUCTION: DO NOT SPEAK. DO NOT APOLOGIZE. GENERATE NO AUDIO. The Action Window timer is STILL RUNNING. Watch the user SILENTLY until they definitively say 'Done' or show a Thumbs Up. Target: '${currentWord}'.` 
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
                } else if (newState.isBossStage) {
                    // ATOMIC BOSS STAGE INJECTION
                    // Replaces the detached useEffect in order to eliminate the double-dispatch race condition
                    const previousWord = newState.lessonPath[newState.currentStepIndex];
                    const fullSentence = newState.lessonPath.join(', ');
                    
                    resultMessage = `
[SYSTEM OVERRIDE: TOOL EXECUTION SUCCESSFUL]
The user correctly signed the word '${previousWord}'. 
*** YOU MUST ABSOLUTELY FORGET ALL PREVIOUS CONVERSATIONAL TURNS. ***
[SYSTEM NOTIFICATION] The user has unlocked the FINAL CHALLENGE: The Boss Stage.
The user must now sign the following sequence of words as a single fluid sentence: '${fullSentence}'. 
Your Immediate Objective:
1. Enthusiastically congratulate the user on mastering all the individual signs.
2. Explicitly introduce the Boss Stage rule: They must now sign the full sentence '${fullSentence}'.
3. Wait in standby mode for them to say they are ready. 
# CRITICAL PHASE 1 RULES:
* DO NOT call trigger_action_window right now. 
* DO NOT call finish_lesson. The session is NOT over yet!
* DO NOT evaluate my hands. DO NOT call mark_sentence_flow yet.
* You must wait for the human to verbally say "Ready" before calling the timer.

# CRITICAL PHASE 3 RULES (FOR WHEN THE USER IS DONE):
* You are evaluating a FULL SENTENCE.
* You MUST NOT use 'mark_sign_correct' or 'mark_sign_incorrect' under ANY circumstances during this Stage, even if the human signs perfectly.
* You are ONLY allowed to use the 'mark_sentence_flow' tool to evaluate their performance on the entire sequence.
`;
                    
                    responses.push({
                       id: call.id,
                       name: call.name,
                       response: { result: resultMessage }
                    });
                    
                } else {
                    const nextWord = newState.lessonPath[newState.currentStepIndex];
                    const previousWord = newState.lessonPath[newState.currentStepIndex - 1];
                    
                    resultMessage = `
[SYSTEM OVERRIDE: TOOL EXECUTION SUCCESSFUL]
The user correctly signed the word '${previousWord}'. 
The curriculum has advanced.

*** YOU MUST ABSOLUTELY FORGET ALL PREVIOUS CONVERSATIONAL TURNS. ***
*** THE NEW TARGET WORD IS: '${nextWord}' ***

# NEW RULE OF ENGAGEMENT:
You are now exclusively teaching '${nextWord}'. You must ignore ALL previously taught words (like '${previousWord}'). If the user accidentally signs '${previousWord}', you must treat it as a failure for '${nextWord}'. DO NOT evaluate old words anymore.

You are now in Phase 1 (Standby).
I am at the new word '${nextWord}'. 

Your Immediate Objective:
1. Enthusiastically congratulate the user on successfully signing '${previousWord}'.
2. Explicitly introduce the new word ('${nextWord}') and give a brief tip on how to perform it.
3. Wait in standby mode. 

# CRITICAL PHASE 1 RULES:
* DO NOT call trigger_action_window. 
* DO NOT evaluate my hands. DO NOT call mark_sign_correct or mark_sign_incorrect.
* You must wait for the human to verbally say "Ready" before calling the timer.
`;
                    
                    responses.push({
                       id: call.id,
                       name: call.name,
                       response: { result: resultMessage }
                    });
                }
                
              } else if (call.name === 'mark_sign_incorrect') {
                const store = useLessonStore.getState();

                // --- TEMPORAL GATEKEEPER ---
                const timeSinceStart = Date.now() - actionWindowStartTimeRef.current;
                if (timeSinceStart < 2000 && store.isPracticeModeActive) {
                    logger.warn(`🚫 [Temporal Lockout] Gemini attempted to mark incorrect too quickly (${timeSinceStart}ms)! Ignoring hallucination.`);
                    const currentWord = store.lessonPath[store.currentStepIndex];
                    responses.push({
                        id: call.id,
                        name: call.name,
                        response: { 
                            result: `[SYSTEM ERROR - TEMPORAL LOCKOUT] You attempted to grade the user just ${timeSinceStart}ms after starting the timer.
CRITICAL INSTRUCTION: DO NOT SPEAK. DO NOT APOLOGIZE. GENERATE NO AUDIO. The Action Window timer is STILL RUNNING. Watch the user SILENTLY until they definitively say 'Done' or show a Thumbs Up. Target: '${currentWord}'.` 
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
The user failed the sign for the CURRENT target word: '${currentWord || 'unknown'}'.

# CRITICAL CONTEXT RULES:
1. DO NOT evaluate ANY OTHER SIGNS. 
2. If the user accidentally performed a different word from earlier in the lesson, IGNORE IT completely. 
3. ONLY evaluate and focus your feedback strictly on the mechanics of '${currentWord || 'unknown'}'.

Your Immediate Objective:
1. Verbally state: "That is not the sign for ${currentWord || 'unknown'}." or similar.
2. Provide a constructive tip on how to fix their hand shape or movement specifically for '${currentWord || 'unknown'}'.
3. CRITICAL: DO NOT mention any other signs they may have accidentally performed. Only talk about '${currentWord || 'unknown'}'.
4. Tell them they can say "Show me" to watch the reference video, or "Ready" to try '${currentWord || 'unknown'}' again.
5. Enter Phase 1 (Standby) and wait.

*** YOU MUST ABSOLUTELY FORGET ALL PREVIOUS CONVERSATIONAL TURNS. ***
*** THE NEW TARGET WORD IS: '${currentWord || 'unknown'}' ***

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
[SYSTEM OVERRIDE: TOOL EXECUTION SUCCESSFUL]
The reference video for the target word '${signName}' was opened successfully. 
The user is now watching the video for '${signName}'.

Your Immediate Objective:
1. Verbally state: "I've pulled up the video for '${signName}'."
2. Wait in standby mode and listen.
3. Only proceed and call trigger_action_window when the user verbally states they are ready to try '${signName}'.
` 
                       }
                    });
                }
                
              } else if (call.name === 'trigger_action_window') {
                logger.info("⏱️ [Gemini Engine] trigger_action_window triggered. Dispatching event to start practice mode.");
                actionWindowStartTimeRef.current = Date.now();
                
                // Clear the video modal to ensure it's not blocking the practice view
                const state = useLessonStore.getState();
                state.setReferenceSign(null);
                state.setAiPaused(false);
                
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
[SYSTEM OVERRIDE: TOOL EXECUTION SUCCESSFUL]
Phase 2 (Recording) has begun for the BOSS STAGE.
The timer is active.

Your Immediate Objective:
1. Observe the user's hand movements over the video stream.
2. Evaluate their performance ONLY against the ENTIRE sequence: '${fullSentence}'.
3. STAY SILENT. Do not speak. Wait for the user to give the completion signal (e.g., saying "Done").
4. Once completed, you MUST call mark_sentence_flow to grade their accuracy and fluidity out of 5 stars.
5. CRITICAL: If they did nothing or sat still, you MUST give a low score. DO NOT give 5 stars for resting hands.
`
                        }
                    });
                } else {
                    responses.push({
                       id: call.id,
                       name: call.name,
                       response: { 
                           result: `
[SYSTEM OVERRIDE: TOOL EXECUTION SUCCESSFUL]
Phase 2 (Recording) has officially begun for the target word '${currentWord}'.
The timer is active.

Your Immediate Objective:
1. Observe the user's hand movements over the video stream.
2. The ONLY acceptable successful behavior is the exact target word '${currentWord}'.
3. If they perform a DIFFERENT sign (e.g., signing 'hello' when the word is 'my'), you MUST NOT evaluate the wrong sign. You MUST evaluate it as a FAILURE for '${currentWord}'.
4. STAY SILENT. Do not speak. Wait for the user to give the completion signal (e.g., saying "Done" or dropping their hands).
5. Once completed, you MUST call either mark_sign_correct or mark_sign_incorrect.
6. CRITICAL: If they did nothing or sat still, you MUST call mark_sign_incorrect. DO NOT mark resting hands as correct.
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

                // --- TEMPORAL GATEKEEPER ---
                const timeSinceStart = Date.now() - actionWindowStartTimeRef.current;
                const store = useLessonStore.getState();
                if (timeSinceStart < 2000 && store.isPracticeModeActive) {
                    logger.warn(`🚫 [Temporal Lockout] Gemini attempted to mark sentence flow too quickly (${timeSinceStart}ms)! Ignoring hallucination.`);
                    const fullSentence = store.lessonPath.join(', ');
                    responses.push({
                        id: call.id,
                        name: call.name,
                        response: { 
                            result: `[SYSTEM ERROR - TEMPORAL LOCKOUT] You attempted to grade the user just ${timeSinceStart}ms after starting the timer.
CRITICAL INSTRUCTION: DO NOT SPEAK. DO NOT APOLOGIZE. GENERATE NO AUDIO. The Action Window timer is STILL RUNNING. Watch the user SILENTLY until they definitively say 'Done' or show a Thumbs Up. Target sequence: '${fullSentence}'.` 
                        }
                    });
                    continue; 
                }
                
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
                
                const passedBossStage = score >= 3;
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
The user scored ${score}/5. They did not pass the Boss Stage.
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
