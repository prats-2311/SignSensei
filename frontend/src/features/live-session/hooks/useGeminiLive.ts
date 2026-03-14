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
  // ONE-SHOT TOKEN: Set by the Trojan Horse when it injects the Phase 3 override.
  // Consumed (and reset) by the Phase Guard when it allows trigger_grading_window through.
  // This decouples spam-prevention (hasUserSignaledDone) from authorization-grant.
  // Without this, the Trojan Horse resetting hasUserSignaledDone would cause the Phase Guard
  // to block the very grading call it just authorized.
  const isGradingWindowGrantedRef = useRef<boolean>(false);
  // POST-INCORRECT STATE TOKEN: Set to true by mark_sign_incorrect after a failed grade.
  // While true, incoming user_is_resting_or_calibrating calls (stale from Phase 2 loop)
  // receive a Phase 1 redirect response instead of the standard "keep looping" response.
  // This prevents stale call responses from undoing the Mind Wipe.
  // Reset to false when trigger_action_window fires (new attempt begins).
  const isPostIncorrectRef = useRef<boolean>(false);
  
  const connect = useCallback(async (onAudioData?: (base64Audio: string) => void) => {
    if (onAudioData) audioCallbackRef.current = onAudioData;
    // FIX (Bug 1): Reset gating flags at the start of every new connection.
    // Without this, hasUserSignaledDone stays 'true' from the previous word's "Done" signal,
    // causing the Trojan Horse to fire immediately on the first user_is_resting_or_calibrating
    // call of the new session — before the user has signed anything.
    useLessonStore.getState().setHasUserSignaledDone(false);
    isGradingWindowActiveRef.current = false;
    isGradingWindowGrantedRef.current = false;
    isPostIncorrectRef.current = false;
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
You are SignSensei, an expert, encouraging ASL (American Sign Language) tutor.
You are a VISUAL-FIRST, audio-secondary AI. Your primary sensor is the VIDEO STREAM.
Grading decisions MUST be based on what you SEE in the video frames — NOT on what you hear.
Audio is only for delivering instructions and encouragement to the student.

# Current State
**Active Target Word:** '${targetWord}'
**Acceptance Criteria (what the video must show):** '${targetLessonWord.description}'
**Current Lesson Path:** ${allWords.map(w => w.word).join(', ')}

# STRICT 3-PHASE STATE MACHINE
You must obey these phases absolutely. Calling a tool outside its designated phase is a critical error.

## PHASE 1 — STANDBY
* Introduce the target word. Explain the physical mechanics of the sign.
* Wait for the user to say "Ready" or "Let's Go" before transitioning.
* ONLY tool you may call: 'trigger_action_window'.
* FORBIDDEN: ALL grading tools, 'user_is_resting_or_calibrating', 'trigger_grading_window'.

## PHASE 2 — OBSERVATION (Silent Watching)
* Activated ONLY after 'trigger_action_window' is called.
* DO NOT generate any audio or speech in this phase.
* You may passively receive audio transcriptions — ignore them. Do NOT act on them.
* ONLY tool you may call: 'user_is_resting_or_calibrating'. Loop it continuously.
* FORBIDDEN: ALL grading tools, 'trigger_action_window'.
* The client system will inject a [SYSTEM OVERRIDE: DONE SIGNAL RECEIVED] command into a tool response when the user signals completion. Wait passively for this — do not guess.

## PHASE 3 — EVALUATION (Grading)
* Activated ONLY when you receive a [SYSTEM OVERRIDE: DONE SIGNAL RECEIVED] from the client in a tool response.
* Your ONLY immediate action: call 'trigger_grading_window'. Do not speak. Do not evaluate yet.
* After calling 'trigger_grading_window', you will receive detailed grading criteria in the response.
* Grade ONLY the target word '${targetWord}'. If the user accidentally performed a different sign, IGNORE IT.
* Grade based on video frames ONLY. If no movement occurred → NO_MOVEMENT. Wrong sign → WRONG_SIGN. Wrong form → POOR_FORM.
* Authorized grading tools: 'mark_sign_correct', 'mark_sign_incorrect', 'mark_sentence_flow'.
* FORBIDDEN: 'user_is_resting_or_calibrating', 'trigger_action_window'.

## PHASE 1 RETURN (After Grading)
* After calling any grading tool, the tool response will contain [SYSTEM OVERRIDE: FULL CONTEXT RESET — PHASE 1 RESTORED].
* You are immediately back in PHASE 1 — STANDBY. All Phase 2 and Phase 3 instructions are void and cancelled.
* Say the given feedback verbatim. Tell the user how to try again or what comes next.
* The ONLY tool you may now call is 'trigger_action_window', ONLY when user says 'Ready' or 'Let's Go'.
* Do NOT call 'user_is_resting_or_calibrating' or any grading tool — you are in Phase 1 Standby.`
              }]
            },
            tools: [
              {
                functionDeclarations: [
                  {
                    name: "trigger_action_window",
                    description: "PHASE 1 ONLY. Call this ONLY when the human explicitly says 'Ready' or 'Let's Go'. This transitions the session to Phase 2 (Observation). After calling this tool, immediately begin looping 'user_is_resting_or_calibrating'. Do NOT call this at any other time. Do NOT call this during Phase 2 or Phase 3.",
                  },
                  {
                    name: "show_sign_reference",
                    description: "PHASE 1 ONLY. Shows a reference video for the current target sign. Call this if the user asks to see how it's done or requests help.",
                  },
                  {
                    name: "user_is_resting_or_calibrating",
                    description: "PHASE 2 ONLY. Call this continuously in a loop while watching the video stream. Do not call any other tool while in Phase 2. Do not speak. IMPORTANT: Watch every tool response carefully — it will contain one of two override commands: (1) [SYSTEM OVERRIDE: DONE SIGNAL RECEIVED] — immediately call 'trigger_grading_window' and stop looping this tool. (2) [SYSTEM OVERRIDE: FULL CONTEXT RESET — PHASE 1 RESTORED] — STOP calling this tool immediately. Phase 2 is cancelled. You are back in Phase 1 Standby. Do NOT call this again until the user says 'Ready' and you call 'trigger_action_window' first.",
                  },
                  {
                    name: "trigger_grading_window",
                    description: "PHASE 2 to PHASE 3 TRANSITION. Call this ONLY in direct response to receiving the [SYSTEM OVERRIDE: DONE SIGNAL RECEIVED] command from the client. Do NOT call this on your own initiative. After calling this, wait for the tool response — it will contain your grading instructions. Do not evaluate or speak until you receive those instructions.",
                  },
                  {
                    name: "mark_sign_correct",
                    description: "PHASE 3 ONLY (Single Word). Call this ONLY in Phase 3, after carefully analyzing video frames, if the video UNDENIABLY shows the human executing the exact physical mechanics of the target sign. CRITICAL: Do NOT call this if the user made no movement, sat still, performed a different sign, or if you are uncertain. Only call this if the evidence in the video is conclusive.",
                  },
                  {
                    name: "mark_sign_incorrect",
                    description: "PHASE 3 ONLY (Single Word). Call this ONLY in Phase 3 after analyzing video frames, if the required sign mechanics were NOT correctly performed. CRITICAL: Grade based ONLY on what you SEE in the video — never on what you heard. Do NOT mention any other sign the user may have accidentally performed. Provide a specific physical reason for failure. After calling this, the tool response will contain [SYSTEM OVERRIDE: FULL CONTEXT RESET — PHASE 1 RESTORED] — read it and follow its instructions exactly. Do not call any tool until you are back in Phase 1.",
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
                    description: "PHASE 3 ONLY (Boss Stage). Call this ONLY in Phase 3 after analyzing video frames for the full sentence signing performance. After calling this, the tool response will contain [SYSTEM OVERRIDE: FULL CONTEXT RESET — PHASE 1 RESTORED] — read it and follow its instructions exactly. Do not call any tool until you are back in Phase 1.",
                    parameters: {
                      type: "OBJECT",
                      properties: {
                        score: {
                           type: "INTEGER",
                          description: "A rating from 1 to 3: 1 = No movement, wrong sequence, or could not determine signing. 2 = Signed most but not all words correctly. 3 = All words signed correctly with fluid transitions. Default to 1 if you did not clearly see the full sentence being signed."
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
Phase 1 is Active. FORBIDDEN: 'user_is_resting_or_calibrating', 'trigger_grading_window', 'mark_sign_correct', 'mark_sign_incorrect', 'mark_sentence_flow'.
The ONLY tool you may call is 'trigger_action_window', ONLY after the user says "Ready" or "Let's Go".
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
Phase 1 is Active. FORBIDDEN: 'user_is_resting_or_calibrating', 'trigger_grading_window', 'mark_sign_correct', 'mark_sign_incorrect'.
The ONLY tool you may call is 'trigger_action_window', ONLY after the user says "Ready" or "Let's Go".
End transmission. Wait for Audio Input.`;
            } else {
                systemText = `[SYSTEM EVENT: LESSON STARTED]
Phase: STANDBY (Phase 1)
Active Target Word: '${activeWord}'

Objective:
1. Introduce '${activeWord}' and explain how to sign it.
2. Stop speaking. Wait for audio input.

[CRITICAL EXECUTION RULE]
Phase 1 is Active. FORBIDDEN: 'user_is_resting_or_calibrating', 'trigger_grading_window', 'mark_sign_correct', 'mark_sign_incorrect'.
The ONLY tool you may call is 'trigger_action_window', ONLY after the user says "Ready" or "Let's Go".
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
                
                // PHASE GUARD: Block if Phase 3 was not properly activated via trigger_grading_window.
                // isGradingWindowActiveRef is set true when trigger_grading_window fires and is
                // more reliable than hasUserSignaledDone, which is already reset earlier in the flow.
                if (!isGradingWindowActiveRef.current) {
                    logger.warn(`🚫 [Phase Guard] mark_sign_correct called before Phase 3 was activated. Blocking.`);
                    responses.push({
                        id: call.id,
                        name: call.name,
                        response: { 
                            result: `[SYSTEM: mark_sign_correct rejected] You called a grading tool before Phase 3 was activated. You are still in Phase 2 — Observation. Do not speak. Return to calling 'user_is_resting_or_calibrating' and wait for the [SYSTEM OVERRIDE: DONE SIGNAL RECEIVED] command.` 
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
                  // The frontend heard "Done" and set the flag. We hijack the next
                  // resting tool response to command Gemini to switch to Phase 3.
                  //
                  // FIX (Spam): Reset hasUserSignaledDone IMMEDIATELY (synchronously) so
                  // queued batch calls don't all see the flag as true and spam 7+ overrides.
                  store.setHasUserSignaledDone(false);
                  // FIX (Phase Guard Conflict): Set the one-shot authorization token BEFORE
                  // injecting the override. The Phase Guard checks this token (not hasUserSignaledDone)
                  // so it will allow the trigger_grading_window call that results from this override.
                  isGradingWindowGrantedRef.current = true;
                  logger.info("🎯 [Trojan Horse] Done signal received. Granting one-shot token. Injecting Phase 3 override.");
                  responses.push({
                    id: call.id,
                    name: call.name,
                    response: { result: `[SYSTEM OVERRIDE: DONE SIGNAL RECEIVED]
The user has completed their sign and signaled "Done". You are now transitioning from Phase 2 (Observation) to Phase 3 (Grading).

Your next action: Call 'trigger_grading_window' to initiate Phase 3.
After calling it, you will receive your grading instructions in the tool response.
Do not speak. Do not evaluate yet. Wait for the grading instructions before assessing the sign.` }
                  });
                } else if (isPostIncorrectRef.current) {
                  // === POST-INCORRECT PHASE 1 REDIRECT ===
                  // isPostIncorrectRef is set true by mark_sign_incorrect after a failed grade.
                  // Stale Phase 2 loop calls arrive here and get the Phase 1 redirect instead
                  // of the standard "keep looping" response, making it consistent with the Mind Wipe.
                  logger.info("🔄 [Gemini Engine] Post-incorrect stale resting call intercepted. Redirecting to Phase 1.");
                  responses.push({
                    id: call.id,
                    name: call.name,
                    response: { result: `[SYSTEM OVERRIDE: FULL CONTEXT RESET — PHASE 1 RESTORED]\nAll Phase 2 and Phase 3 instructions are now void. You are in Phase 1 — STANDBY.\nDo NOT call 'user_is_resting_or_calibrating' again. Do NOT call any grading tool.\nWait for the user to say "Ready" or "Let's Go", then call 'trigger_action_window'.` }
                  });
                } else {
                  // === STANDARD PHASE 2 LOOP ===
                  logger.info("⏳ [Gemini Engine] user_is_resting_or_calibrating triggered. Watching frames.");
                  responses.push({
                    id: call.id,
                    name: call.name,
                    response: { result: "Phase 2 — Observation Mode is active. Do not speak or evaluate. Continue looping 'user_is_resting_or_calibrating'. The client will inject a [SYSTEM OVERRIDE: DONE SIGNAL RECEIVED] into a future tool response when the user signals completion. Wait for that message." }
                  });
                }

              } else if (call.name === 'trigger_grading_window') {
                const store = useLessonStore.getState();

                // PHASE GUARD: Rejects unauthorized trigger_grading_window calls.
                // Checks the one-shot isGradingWindowGrantedRef token set by the Trojan Horse.
                // This decouples the authorization check from hasUserSignaledDone, which was
                // already reset by the Trojan Horse before this call arrives.
                if (!isGradingWindowGrantedRef.current) {
                  logger.warn(`🚫 [Phase Guard] trigger_grading_window called without an authorization token. Rejecting.`);
                  responses.push({
                    id: call.id,
                    name: call.name,
                    response: { result: `[SYSTEM: trigger_grading_window rejected] You are still in Phase 2 — Observation. The client has not sent the [SYSTEM OVERRIDE: DONE SIGNAL RECEIVED] signal yet. Return to Phase 2 by calling 'user_is_resting_or_calibrating'. Do not speak. Wait passively for the override in a future tool response.` }
                  });
                  continue;
                }
                // Consume the one-shot token so a second call can't slip through.
                isGradingWindowGrantedRef.current = false;

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

Grading rules (evaluate in this order):
1. If the user did not move or sat still → 'mark_sign_incorrect', reason: 'NO_MOVEMENT'.
2. If they performed a recognizably different sign → 'mark_sign_incorrect', reason: 'WRONG_SIGN'.
3. If the motion was present but form was wrong (bad handshape, wrong location, wrong movement) → 'mark_sign_incorrect', reason: 'POOR_FORM'.
4. ONLY if the video undeniably proves the exact '${activeWord}' mechanics described above → 'mark_sign_correct'.

CRITICAL: Grade ONLY the target sign '${activeWord}'. If they accidentally performed any other sign (e.g. a previous lesson word), IGNORE IT completely — score based on what they DID during this attempt, not past attempts.
CRITICAL: Grade based ONLY on what you see in the video frames — NOT on what you heard.`;
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
                    response: { result: `[SYSTEM: mark_sign_incorrect rejected — Boss Stage active] This tool is not available during the Boss Stage. The Boss Stage uses a 1-3 star rating system. You must call 'mark_sentence_flow' instead. Evaluate the full sentence performance and call mark_sentence_flow with a score of 1 (poor), 2 (good), or 3 (perfect), plus specific feedback on their transitions between signs.` }
                  });
                  continue;
                }

                // === SAFETY SHIELD 2: Block if grading was not authorized via proper Phase 3 flow ===
                // Checks isGradingWindowActiveRef (set true when trigger_grading_window fired).
                // This is more reliable than hasUserSignaledDone, which is reset earlier in the flow.
                if (!isGradingWindowActiveRef.current) {
                  logger.warn(`🚫 [Phase Guard] mark_sign_incorrect called before Phase 3 was activated. Blocking.`);
                  responses.push({
                    id: call.id,
                    name: call.name,
                    response: { result: `[SYSTEM: mark_sign_incorrect rejected] You called a grading tool before Phase 3 was activated. You are still in Phase 2 — Observation. Do not speak. Return to calling 'user_is_resting_or_calibrating' and wait for the [SYSTEM OVERRIDE: DONE SIGNAL RECEIVED] command.` }
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
                // STALE CALL FIX: Signal to user_is_resting_or_calibrating handler that
                // we are in post-incorrect Phase 1 state. Stale Phase 2 loop calls will
                // now receive the Phase 1 redirect instead of the standard "keep looping"
                // response, preventing them from undoing the Mind Wipe.
                isPostIncorrectRef.current = true;

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
                    responses.push({
                        id: call.id,
                        name: call.name,
                        response: {
                           result: `[SYSTEM: show_sign_reference rejected — Boss Stage active] There is no reference video for the full sentence. Apologize to the user and verbally explain that individual sign videos are not available during the Boss Stage. Encourage them to recall the signs they learned and string them together.`
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

[SYSTEM EVENT: PHASE 1 RULES ACTIVE]
You are in Phase 1 — STANDBY. FORBIDDEN: 'user_is_resting_or_calibrating', 'trigger_grading_window', 'mark_sign_correct', 'mark_sign_incorrect'.
The ONLY tool you may call is 'trigger_action_window', ONLY when the user says "Ready".
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
                // STALE CALL FIX: A new attempt is starting. Clear the post-incorrect flag so
                // user_is_resting_or_calibrating handler returns to normal Phase 2 loop behavior.
                isPostIncorrectRef.current = false;
                
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
                             result: `[SYSTEM: finish_lesson rejected — Boss Stage still active] The lesson cannot be finished yet because the Boss Stage evaluation has not been completed. Do not speak. Wait for the user to sign the full sentence, then grade it using 'mark_sentence_flow'.` 
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
                 
                 // FIX (Dead-Code Bug): Capture authorization state BEFORE resetting the refs.
                 // Previously, isGradingWindowActiveRef and hasUserSignaledDone were reset to false
                 // BEFORE the guard checked them, making the guard always block even legitimate calls.
                 // We now snapshot the authorization state first.
                 const isGradingAuthorized = isGradingWindowActiveRef.current;
                 
                 // Reset grading window guard after Boss Stage grade.
                 isGradingWindowActiveRef.current = false;
                 store.setHasUserSignaledDone(false);
                 logger.info("🌟 [Gemini Engine] mark_sentence_flow triggered! Boss Stage Complete.");

                 if (!isGradingAuthorized) {
                     logger.warn(`🚫 [Event Lockout] mark_sentence_flow called before trigger_grading_window authorized it. Blocking.`);
                     const fullSentence = store.lessonPath.map(w => w.word).join(', ');
                     responses.push({
                         id: call.id,
                         name: call.name,
                         response: { 
                             result: `[SYSTEM: mark_sentence_flow rejected] You are in Phase 2 — Observation. The user has not signaled completion yet. Do not speak. Continue looping 'user_is_resting_or_calibrating' and wait for the [SYSTEM OVERRIDE: DONE SIGNAL RECEIVED] command. Target sequence: '${fullSentence}'.` 
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
                // STALE CALL FIX: Boss Stage grading is complete for all scores.
                // Set post-grade flag so stale user_is_resting_or_calibrating calls
                // receive a Phase 1 redirect instead of the Phase 2 "keep looping" response.
                isPostIncorrectRef.current = true;

                responses.push({
                   id: call.id,
                   name: call.name,
                   response: {
                       result: passedBossStage
                           ? `[SYSTEM OVERRIDE: FULL CONTEXT RESET — PHASE 1 RESTORED]
Boss Stage: PASSED (score: ${score}/3). The lesson curriculum is now complete.
Do not call any tools. Enthusiastically congratulate the user. Say verbatim: "${feedback}". Then fall silent.`
                           : `[SYSTEM OVERRIDE: FULL CONTEXT RESET — PHASE 1 RESTORED]
Boss Stage: Completed with score ${score}/3. Results have been recorded — the lesson is now over.
Do not call any tools. Warmly encourage the user and explain the score. Say verbatim: "${feedback}". Then fall silent.`
                   }
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
