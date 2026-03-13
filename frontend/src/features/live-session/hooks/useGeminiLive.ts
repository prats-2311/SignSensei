import { useState, useCallback, useRef, useEffect } from 'react';
import { useLessonStore } from '../../../stores/useLessonStore';
import { useUserStore } from '../../../stores/useUserStore';
import { LESSONS } from '../../../data/curriculum';
import type { LessonWord } from '../../../data/curriculum';
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
  const connectionTimestampRef = useRef<number>(0);
  const audioCallbackRef = useRef<((base64Audio: string) => void) | undefined>(undefined);
  // FIX (Bug 3): Guards against duplicate trigger_grading_window calls from LLM output batching.
  // A useRef is used (not Zustand) because it must update synchronously to block the second call
  // that arrives within ~500ms of the first.
  const isGradingWindowActiveRef = useRef<boolean>(false);
  
  const connect = useCallback(async (onAudioData?: (base64Audio: string) => void) => {
    if (onAudioData) audioCallbackRef.current = onAudioData;
    // FIX (Bug 1): Reset gating flags at the start of every new connection.
    // Without this, hasUserSignaledDone stays 'true' from the previous word's "Done" signal,
    // causing the Trojan Horse to fire immediately on the first user_is_resting_or_calibrating
    // call of the new session — before the user has signed anything.
    useLessonStore.getState().setHasUserSignaledDone(false);
    isGradingWindowActiveRef.current = false;
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
      const buildSetupMessage = (targetLessonWord: LessonWord, allWords: LessonWord[]) => {
        const targetWord = targetLessonWord.word;
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
**Acceptance Criteria for Target Word:** '${targetLessonWord.description}'
**Current Lesson Path:** ${allWords.map(w => w.word).join(', ')}

# STRICT 3-PHASE STATE MACHINE
You must obey these phases absolutely. Calling a tool outside its designated phase is a critical error that corrupts the session.

## PHASE 1 — STANDBY
* Introduce the target word and explain how to sign it.
* Wait for the user to say "Ready" or "Let's Go".
* ONLY tool you may call: 'trigger_action_window'.
* FORBIDDEN in this phase: ALL grading tools, 'user_is_resting_or_calibrating', 'trigger_grading_window'.

## PHASE 2 — OBSERVATION
* Activated ONLY after you call 'trigger_action_window'.
* Your ONLY job is to watch the video stream silently.
* ONLY tool you may call: 'user_is_resting_or_calibrating'. Loop it continuously.
* DO NOT listen for any verbal cues. DO NOT attempt to grade anything.
* FORBIDDEN in this phase: ALL grading tools, 'trigger_action_window'.
* The client system will send you an override command in the tool response when the user signals completion. Wait for this command.

## PHASE 3 — EVALUATION
* Activated ONLY when you receive a [SYSTEM OVERRIDE: DONE SIGNAL RECEIVED] command from the client.
* Upon receiving this command, you MUST immediately call 'trigger_grading_window'.
* After calling 'trigger_grading_window', analyze the video frames and call a grading tool.
* Authorized tools: 'mark_sign_correct', 'mark_sign_incorrect', 'mark_sentence_flow'.
* FORBIDDEN in this phase: 'user_is_resting_or_calibrating', 'trigger_action_window'.`
              }]
            },
            tools: [
              {
                functionDeclarations: [
                  {
                    name: "trigger_action_window",
                    description: "PHASE 1 ONLY. Call this when the human says 'Ready' or 'Let's Go' to transition to Phase 2 (Observation). Do NOT call this at any other time.",
                  },
                  {
                    name: "show_sign_reference",
                    description: "PHASE 1 ONLY. Shows a reference video for the current target sign. Call this if the user asks to see how it's done or requests help.",
                  },
                  {
                    name: "user_is_resting_or_calibrating",
                    description: "PHASE 2 ONLY. Call this continuously in a loop while watching the video stream. Do not call any other tool while in Phase 2. The client system will send you a special override command in the response when the human signals completion.",
                  },
                  {
                    name: "trigger_grading_window",
                    description: "PHASE 2 to PHASE 3 TRANSITION. Call this ONLY when you receive the [SYSTEM OVERRIDE: DONE SIGNAL RECEIVED] command from the client in a tool response. Do NOT call this on your own initiative.",
                  },
                  {
                    name: "mark_sign_correct",
                    description: "PHASE 3 ONLY (Single Word). Call this ONLY in Phase 3 after analyzing video frames, if the human perfectly executed the required physical mechanics of the target sign.",
                  },
                  {
                    name: "mark_sign_incorrect",
                    description: "PHASE 3 ONLY (Single Word). Call this ONLY in Phase 3 after analyzing video frames, if the human failed the sign. Provide the specific physical reason.",
                    parameters: {
                      type: "OBJECT",
                      properties: {
                        reason_category: {
                          type: "STRING",
                          description: "Must be one of: 'NO_MOVEMENT', 'WRONG_SIGN', 'POOR_FORM', or 'REQUESTED_HELP'"
                        },
                        specific_feedback: {
                          type: "STRING",
                          description: "A short, specific sentence explaining exactly what they did wrong physically and how to fix it."
                        }
                      },
                      required: ["reason_category", "specific_feedback"]
                    }
                  },
                  {
                    name: "finish_lesson",
                    description: "SYSTEM ONLY. Call this ONLY when you receive the exact system message: 'System: All words in the lesson have been completed!'. DO NOT call this tool during the Boss Stage or on your own initiative.",
                  },
                  {
                    name: "mark_sentence_flow",
                    description: "PHASE 3 ONLY (Boss Stage). Call this ONLY in Phase 3 after analyzing video frames for the full sentence signing performance.",
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
        // Provide a safe fallback if empty
        const firstWord = targetWords[currentActiveIndex] || targetWords[0] || { word: 'hello', description: 'Wave hand' };
        
        const setupMessage = buildSetupMessage(firstWord, targetWords);
        ws.send(JSON.stringify(setupMessage));
        
        const currentState = useLessonStore.getState();
        const currentPath = currentState.lessonPath;
        const activeWordObj = currentPath[currentActiveIndex] || { word: 'hello', description: 'Wave hand' };
        const activeWord = activeWordObj.word;
        const isBossStage = currentState.isBossStage;
        const previousWordObj = currentActiveIndex > 0 ? currentPath[currentActiveIndex - 1] : null;
        const previousWord = previousWordObj ? previousWordObj.word : null;

        // Set connection timestamp for Phase 1 temporal shield
        connectionTimestampRef.current = Date.now();
        
        let systemText = '';

        if (isBossStage) {
             const fullSentence = currentPath.map(w => w.word).join(', ');
             systemText = `[SYSTEM EVENT: BOSS STAGE UNLOCKED]
Phase: STANDBY (Phase 1)
Previous Word Completed: '${previousWord}'
Target Sentence: '${fullSentence}'

Objective:
1. Congratulate user on mastering all individual signs.
2. Introduce the Boss Stage: they must sign the full sentence '${fullSentence}'.
3. Stop speaking. Wait for audio input.

[CRITICAL EXECUTION RULE]
Phase 1 is Active. You cannot use 'mark_sentence_flow' or 'mark_sign_correct'.
You may only use 'trigger_action_window' after the user explicitly says "Ready" or "Let's Go".
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

[CRITICAL EXECUTION RULE]
Phase 1 is Active. You cannot use 'mark_sign_correct'.
You may only use 'trigger_action_window' after the user explicitly says "Ready" or "Let's Go".
End transmission. Wait for Audio Input.`;
            } else {
                systemText = `[SYSTEM EVENT: LESSON STARTED]
Phase: STANDBY (Phase 1)
Active Target Word: '${activeWord}'

Objective:
1. Introduce '${activeWord}' and explain how to sign it.
2. Stop speaking. Wait for audio input.

[CRITICAL EXECUTION RULE]
Phase 1 is Active. You cannot use 'mark_sign_correct'.
You may only use 'trigger_action_window' after the user explicitly says "Ready" or "Let's Go".
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
               // FIX (Edge Case 2 + 3): Gate gatekeeper on practiceModeActive AND use word-boundary
               // regex. Without this, saying "Done" in Phase 1 (e.g. to close a video) would
               // incorrectly arm the Trojan Horse. Also prevents substring matches like "well done".
               const isDoneSignal = /\bdone\b/.test(lowerTranscript) || /\bfinished\b/.test(lowerTranscript);
               const isPracticeActive = useLessonStore.getState().isPracticeModeActive;
               const isVideoOpen = useLessonStore.getState().referenceSign !== null;
               // FIX (Edge Case Video): Also suppress if a reference video is currently showing.
               // The user saying "Done" to close the video should not arm the grading pipeline.
               if (isDoneSignal && isPracticeActive && !isVideoOpen) {
                   // Event-Driven trigger: Arms the grading shield ONLY during Phase 2 observation.
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
                
                if (!store.hasUserSignaledDone) {
                    logger.warn(`🚫 [Event Lockout] Gemini attempted to mark correct before user said "Done"! Blocking.`);
                    responses.push({
                        id: call.id,
                        name: call.name,
                        response: { 
                            result: `[SYSTEM ERROR] CRITICAL INSTRUCTION: You MUST WAIT SILENTLY until the human explicitly says "Done" or "Finished" in the audio transcript before grading.` 
                        }
                    });
                    continue; 
                }

                logger.info("✅ [Gemini Engine] mark_sign_correct triggered! Dispatching UI State Update.");
                const userStore = useUserStore.getState();
                
                store.setMascotEmotion('success');
                store.setFeedback("Excellent signing!", "success");
                userStore.incrementXP(10);

                // FIX (Bug 1): Reset hasUserSignaledDone BEFORE the Optimistic Disconnect.
                // If not reset here, the new connection's connect() picks up stale 'true',
                // causing the Trojan Horse to fire immediately on the first resting call.
                store.setHasUserSignaledDone(false);
                // FIX (Bug 3): Reset the grading window guard for the next word.
                isGradingWindowActiveRef.current = false;
                
                // CRITICAL FIX: The UI must reset to Phase 1 (Waiting for Ready).
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
              } else if (call.name === 'user_is_resting_or_calibrating') {
                const store = useLessonStore.getState();

                if (store.hasUserSignaledDone) {
                  // === TROJAN HORSE: Phase 2 -> Phase 3 Transition ===
                  // The frontend heard "Done" and set the flag. Now we hijack the next
                  // resting tool response to command Gemini to switch to Phase 3.
                  //
                  // FIX (Trojan Horse Spam): Reset the flag IMMEDIATELY before pushing the response.
                  // Multiple user_is_resting calls queued simultaneously (from Gemini's batch polling)
                  // would all see hasUserSignaledDone=true and inject 7+ override messages.
                  // Resetting synchronously here ensures ONLY the first call injects the override.
                  store.setHasUserSignaledDone(false);
                  logger.info("🎯 [Trojan Horse] Done signal was set. Injecting Phase 3 override into resting tool response.");
                  responses.push({
                    id: call.id,
                    name: call.name,
                    response: { result: `[SYSTEM OVERRIDE: DONE SIGNAL RECEIVED]
The human has explicitly said "Done". Observation Mode is now over.

Your immediate next action: Call the 'trigger_grading_window' tool RIGHT NOW.
Do not speak. Do not evaluate yet. Just call the tool immediately.` }
                  });
                } else {
                  // === STANDARD PHASE 2 LOOP ===
                  logger.info("⏳ [Gemini Engine] user_is_resting_or_calibrating triggered. Watching frames.");
                  responses.push({
                    id: call.id,
                    name: call.name,
                    response: { result: "Acknowledged. Continue watching the video stream. Do not grade yet. Wait for the client override command." }
                  });
                }

              } else if (call.name === 'trigger_grading_window') {
                const store = useLessonStore.getState();

                // FIX (Bug 2): Guard against hallucinated trigger_grading_window calls.
                // Gemini may call this tool spontaneously due to context contamination from a
                // previous Trojan Horse override. Reject it hard if the user hasn't said "Done".
                if (!store.hasUserSignaledDone) {
                  logger.warn(`🚫 [Phase Guard] trigger_grading_window called without Done signal! Rejecting.`);
                  responses.push({
                    id: call.id,
                    name: call.name,
                    response: { result: `[SYSTEM ERROR] UNAUTHORIZED CALL. You called 'trigger_grading_window' without receiving the [SYSTEM OVERRIDE: DONE SIGNAL RECEIVED] command. This call is REJECTED. Return to Phase 2 immediately. Call 'user_is_resting_or_calibrating' and wait for the client override command.` }
                  });
                  continue;
                }

                // FIX (Bug 3): Guard against duplicate trigger_grading_window calls.
                // Gemini's output stream can produce two calls within ~500ms. Only the first
                // should trigger Phase 3. The ref updates synchronously to block the second call.
                if (isGradingWindowActiveRef.current) {
                  logger.warn(`🚫 [Duplicate Guard] Second trigger_grading_window received. Ignoring duplicate.`);
                  responses.push({
                    id: call.id,
                    name: call.name,
                    response: { result: `[SYSTEM INFO] Phase 3 is already active. This is a duplicate call. Ignore it and wait for the evaluation result.` }
                  });
                  continue;
                }

                // === PHASE 3 ACTIVATION ===
                isGradingWindowActiveRef.current = true;
                const activeWordObj = store.lessonPath[store.currentStepIndex];
                const activeWord = activeWordObj ? activeWordObj.word : 'unknown';
                const activeDescription = activeWordObj ? activeWordObj.description : 'Analyze the physical motion strictly.';

                logger.info("🔬 [Gemini Engine] trigger_grading_window triggered. Activating Phase 3 evaluation.");

                let phase3Prompt = '';
                if (store.isBossStage) {
                  const fullSentence = store.lessonPath.map(w => w.word).join(', ');
                  phase3Prompt = `[SYSTEM OVERRIDE: PHASE 3 ACTIVE — EVALUATION MODE]
Target Sentence: '${fullSentence}'
You are now in Phase 3. Observation is over.
Review the video frames from the last 3-5 seconds.
You are now authorized to call 'mark_sentence_flow'.

Grading criteria:
- If they did not sign the sequence or sat still → score 1 (poor).
- If they signed parts of the sentence but missed some → score 2 (good).
- If they undeniably and perfectly signed the entire sentence → score 3 (perfect).
- Your feedback must explain the exact physical reason for the score.`;
                } else {
                  phase3Prompt = `[SYSTEM OVERRIDE: PHASE 3 ACTIVE — EVALUATION MODE]
Target Sign: '${activeWord}'
Mechanics to evaluate: '${activeDescription}'
You are now in Phase 3. Observation is over.
Review the video frames from the last 3-5 seconds.
You are now authorized to call 'mark_sign_correct' or 'mark_sign_incorrect'.

Grading criteria:
- If the user did not move or sat still → call 'mark_sign_incorrect' with reason_category 'NO_MOVEMENT'.
- If they signed a completely different sign → call 'mark_sign_incorrect' with reason_category 'WRONG_SIGN'.
- If their form was partially wrong (wrong hand shape, location, or movement) → call 'mark_sign_incorrect' with reason_category 'POOR_FORM'.
- ONLY if the video undeniably proves they executed the exact mechanics → call 'mark_sign_correct'.`;
                }

                responses.push({
                  id: call.id,
                  name: call.name,
                  response: { result: phase3Prompt }
                });

              } else if (call.name === 'mark_sign_incorrect') {
                const store = useLessonStore.getState();

                // === SAFETY SHIELD 1: Block during Boss Stage ===
                // In the Boss Stage, Gemini must use mark_sentence_flow (1-3 stars), not mark_sign_incorrect.
                if (store.isBossStage) {
                  logger.warn(`🚫 [Boss Stage Guard] Gemini called mark_sign_incorrect during Boss Stage! Redirecting to mark_sentence_flow.`);
                  responses.push({
                    id: call.id,
                    name: call.name,
                    response: { result: `[SYSTEM ERROR] FORBIDDEN TOOL IN BOSS STAGE. 'mark_sign_incorrect' does not exist in the Boss Stage. The Boss Stage uses a star rating system. You MUST call 'mark_sentence_flow' instead. Evaluate the full sentence and call mark_sentence_flow with a score of 1 (poor), 2 (good), or 3 (perfect), plus specific feedback on their transitions between signs.` }
                  });
                  continue;
                }

                // === SAFETY SHIELD 2: Block if user hasn't signaled done ===
                // This is a last-resort guard in case Gemini ignores the phase rules.
                if (!store.hasUserSignaledDone) {
                  logger.warn(`🚫 [Event Lockout] Gemini attempted to mark_sign_incorrect before user said "Done"! Blocking.`);
                  responses.push({
                    id: call.id,
                    name: call.name,
                    response: { result: `[SYSTEM ERROR] CRITICAL PROTOCOL VIOLATION. You called a grading tool in Phase 2. This is FORBIDDEN. Return to Phase 2 immediately. Call 'user_is_resting_or_calibrating' and wait for the client override command.` }
                  });
                  continue;
                }

                logger.warn("❌ [Gemini Engine] mark_sign_incorrect triggered!");
                
                const userStore = useUserStore.getState();
                const args = call.args as { reason_category: string, specific_feedback: string };
                const feedbackText = args.specific_feedback || "Not quite right, let's try again.";
                
                store.setMascotEmotion('error');
                store.resetCombo();
                store.setFeedback(feedbackText, "error");
                
                const currentWordObj = store.lessonPath[store.currentStepIndex];
                const currentWord = currentWordObj ? currentWordObj.word : 'unknown';
                if (currentWordObj) {
                   userStore.recordWeakWord(currentWord);
                }
                
                // FIX (Feedback): Do NOT auto-clear feedback after 2 seconds.
                // The feedback is now cleared only when a new attempt begins (trigger_action_window).
                // This gives the user time to read it at their own pace between attempts.

                // Reset to Phase 1: stop practice mode, reset all gating flags.
                store.setPracticeModeActive(false);
                store.setHasUserSignaledDone(false);
                // FIX (Bug 3): Reset grading window guard so it works on next attempt.
                isGradingWindowActiveRef.current = false;

                // FIX (Bug 2): Aggressive Mind Wipe response.
                // Explicitly cancels the Trojan Horse override command that is still in Gemini's
                // context from the failed attempt. Without this, Gemini replays the
                // 'trigger_grading_window' call on the very next Phase 2 loop.
                responses.push({
                   id: call.id,
                   name: call.name,
                   response: { result: `[SYSTEM OVERRIDE: FULL CONTEXT RESET — PHASE 1 RESTORED]
ALL prior Phase 2 and Phase 3 instructions are now VOID and CANCELLED.
The command to call 'trigger_grading_window' is CANCELLED.
The Phase 3 evaluation prompt is CANCELLED.
You are REBOOTING to Phase 1 — STANDBY.

Target Word: '${currentWord}' (UNCHANGED. Do NOT advance.)
Result: FAILED

Your Immediate Objective:
1. Say EXACTLY: "That was not the sign for '${currentWord}'. ${feedbackText}"
2. Tell them: "Say 'Show me' to see a demo, or 'Ready' to try again."
3. Do NOT paraphrase the feedback. Say it verbatim.

PHASE 1 RULES — STRICTLY ENFORCED:
- You may NOT call 'trigger_grading_window'.
- You may NOT call 'user_is_resting_or_calibrating'.
- You may NOT call any grading tool.
- The ONLY tool you may call is 'trigger_action_window', ONLY when user says "Ready".
Wait silently.` }
                });
                
              } else if (call.name === 'show_sign_reference') {
                logger.info("🎥 [Gemini Engine] show_sign_reference triggered. Popping up video modal and pausing AI.");
                const state = useLessonStore.getState();
                const signNameObj = state.lessonPath[state.currentStepIndex];
                const signName = signNameObj ? signNameObj.word : 'unknown';
                
                if (state.isBossStage) {
                    // Intercept video request during Boss Stage because there is no single video for a full sentence
                    state.setAiPaused(false);
                    const fullSentence = state.lessonPath.map(w => w.word).join(', ');
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
End transmission. Wait for Audio Input.
` 
                       }
                    });
                }
                
              } else if (call.name === 'trigger_action_window') {

                const state = useLessonStore.getState();

                // FIX (Edge Case 1): Idempotent Phase 2 handler.
                // If already in Phase 2 (user clicked "I'm Ready" and camera started, or said "ready"
                // accidentally while signing), don't restart the camera — just re-confirm Phase 2
                // to Gemini so it starts/continues the user_is_resting loop.
                const isAlreadyInPhase2 = state.isPracticeModeActive;

                if (isAlreadyInPhase2) {
                  logger.info(`⏱️ [Gemini Engine] ${call.name} called while Phase 2 already active. Re-confirming Phase 2 without restarting camera.`);
                } else {
                  // FIX (Log): Properly interpolate call.name in log message.
                  logger.info(`⏱️ [Gemini Engine] ${call.name} triggered. Dispatching event to start practice mode.`);
                  window.dispatchEvent(new Event('trigger_action_window'));
                }
                
                // Clear the video modal to ensure it's not blocking the practice view
                state.setReferenceSign(null);
                state.setAiPaused(false);
                // FIX (Feedback): Clear error feedback when a new attempt begins.
                // Feedback now persists after mark_sign_incorrect without a timeout,
                // so we must clear it here to give a fresh slate for the new attempt.
                state.setFeedback("", "idle");
                
                const activeWordObj = state.lessonPath[state.currentStepIndex];
                const activeWord = activeWordObj ? activeWordObj.word : 'unknown';
                const activeDescription = activeWordObj ? activeWordObj.description : 'Analyze the physical motion strictly.';

                let actionMessage = '';
                if (state.isBossStage) {
                    const fullSentence = state.lessonPath.map(w => w.word).join(', ');
                    actionMessage = `[SYSTEM OVERRIDE: PHASE 2 ACTIVE]
Target Sentence: '${fullSentence}'
Video Feedback: ACTIVE at 5 FPS.

You are now in Phase 2 — OBSERVATION MODE.
Your ONLY authorized tool is 'user_is_resting_or_calibrating'. Loop it continuously.
DO NOT listen for any verbal cues. DO NOT attempt to grade anything.
The client system will send you an override command in the tool response when the user signals they are done.
Wait for that override command. Do not guess. Do not act early.`;
                } else {
                    actionMessage = `[SYSTEM OVERRIDE: PHASE 2 ACTIVE]
Target Sign: '${activeWord}'
Mechanics to observe for: '${activeDescription}'
Video Feedback: ACTIVE at 5 FPS.

You are now in Phase 2 — OBSERVATION MODE.
Your ONLY authorized tool is 'user_is_resting_or_calibrating'. Loop it continuously.
DO NOT listen for any verbal cues. DO NOT attempt to grade anything.
The client system will send you an override command in the tool response when the user signals they are done.
Wait for that override command. Do not guess. Do not act early.`;
                }

                responses.push({
                   id: call.id,
                   name: call.name,
                   response: { result: actionMessage }
                });
                
                // Only dispatch start-practice-mode event if Phase 2 is freshly starting.
                // If already in Phase 2 (e.g. button was clicked), skip the event to avoid
                // restarting the camera and resetting the UI state.
                if (!isAlreadyInPhase2) {
                  state.setHasUserSignaledDone(false);
                  window.dispatchEvent(new CustomEvent('start-practice-mode'));
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
                const store = useLessonStore.getState();
                // FIX (Bug 3): Reset grading window guard after Boss Stage grade.
                isGradingWindowActiveRef.current = false;
                store.setHasUserSignaledDone(false);
                logger.info("🌟 [Gemini Engine] mark_sentence_flow triggered! Boss Stage Complete.");

                if (!store.hasUserSignaledDone) {
                    logger.warn(`🚫 [Event Lockout] Gemini attempted to grade Boss Stage before user said "Done"! Blocking.`);
                    const fullSentence = store.lessonPath.map(w => w.word).join(', ');
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

  const sendVideoData = useCallback((base64Video: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
       wsRef.current.send(JSON.stringify({
         realtimeInput: {
           mediaChunks: [{
             mimeType: "image/jpeg",
             data: base64Video
           }]
         }
       }));
       
       // Throttled logging to verify frame transmission
       if (!(window as any).lastFrameLogTime || Date.now() - (window as any).lastFrameLogTime > 1000) {
           // console.log(`[Frontend Diagnostic] 📷 Sent video frame to Gemini. Length: ${base64Video.length}`);
           (window as any).lastFrameLogTime = Date.now();
       }
    }
  }, []);

  const sendClientContent = useCallback((text: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        clientContent: {
          turns: [{ role: "user", parts: [{ text }] }],
          turnComplete: true
        }
      }));
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
    sendVideoData,
    sendClientContent
  };
}
