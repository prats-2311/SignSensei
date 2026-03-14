import { useEffect, useRef, useState, useCallback } from 'react';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { AudioManager } from '../../../shared/lib/audioManager';
import { VideoCapture } from '../../../shared/lib/videoCapture';
import { Mascot } from '../../../shared/ui/Mascot';
import { useLessonStore } from '../../../stores/useLessonStore';

const audioManager = new AudioManager();
const videoCapture = new VideoCapture();

export function LiveSession({ onEnd }: { onEnd: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isActive, setIsActive] = useState(false);
  const { isConnected, isConnecting, error, connect, disconnect, sendAudioData, sendVideoData, sendClientContent } = useGeminiLive();
  const { lessonPath, currentStepIndex, isPracticeModeActive, setPracticeModeActive, isBossStage, feedback, status: feedbackStatus, isLessonComplete, mascotEmotion } = useLessonStore();
  const [isRecordingBuffer, setIsRecordingBuffer] = useState(false);

  const handleStart = async () => {
    try {
      audioManager.initializePlaybackContext();
      await audioManager.startRecording((base64Audio) => {
        sendAudioData(base64Audio);
      });
      if (videoRef.current) {
         await videoCapture.startCamera(videoRef.current, (base64Video) => {
            sendVideoData(base64Video);
         }, 0);
      }
      await connect((base64Playback) => {
         audioManager.playChunk(base64Playback);
      });
      setIsActive(true);
    } catch (e) {
      console.error(e);
    }
  };

  const handleStop = () => {
     audioManager.stopRecording();
     videoCapture.stopCamera();
     disconnect();
     setIsActive(false);
     setPracticeModeActive(false);
     onEnd();
  };

  // Handle Practice Mode Framerate Switching
  useEffect(() => {
     if (!isActive) return;
     
     if (isPracticeModeActive) {
         // Activate 5 FPS immediately in Phase 2
         videoCapture.changeFramerate(5, (base64Video) => {
             sendVideoData(base64Video);
         });
     } else {
         // Phase 1 (Standby): Send 0 frames to save bandwidth and prevent hallucinations.
         videoCapture.changeFramerate(0, (base64Video) => {
             sendVideoData(base64Video);
         });
     }
  }, [isPracticeModeActive, isActive, sendVideoData]);

  const practiceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Trigger native model-driven recording phase immediately with a HARD timeout
  const startPracticeMode = useCallback(() => {
      setPracticeModeActive(true);
      // Show 'thinking' mascot immediately when recording starts
      useLessonStore.getState().setMascotEmotion('thinking');

      // FIX (I'm Ready Button): Inject a clientContent message to Gemini to force trigger_action_window.
      // The button sets the camera running immediately (good UX), and this injection ensures Gemini
      // enters Phase 2 even if it didn't hear the user say "ready" verbally.
      sendClientContent(`[USER BUTTON: Ready] The user has explicitly clicked the 'I'm Ready' button. This is equivalent to saying 'I am ready'. If you are in Phase 1, call trigger_action_window now to start observation mode.`);
      
      // Clear any existing timeouts just in case
      if (practiceTimeoutRef.current) {
         clearTimeout(practiceTimeoutRef.current);
      }
      
      // Visual Recording Buffer
      setIsRecordingBuffer(true);
      setTimeout(() => {
          setIsRecordingBuffer(false);
      }, 1500);
      
      // EDGE CASE 1 (The "Frozen/Walkaway" User):
      // If the user triggers the camera but then walks away or stares blankly for 15 seconds,
      // we forcefully kill the connection to save Vertex AI tokens.
      practiceTimeoutRef.current = setTimeout(() => {
         // Only cull if they are still stuck in practice mode
         if (useLessonStore.getState().isPracticeModeActive) {
             console.warn("⏳ [FRONTEND CULL] Active recording window exceeded 15s. Force disconnecting to save tokens.");
             disconnect();
             useLessonStore.getState().setPracticeModeActive(false);
             useLessonStore.getState().setFeedback("Recording timed out. Please say 'Ready' to try again.", "error");
             useLessonStore.getState().setMascotEmotion('error');
             
             // Reset UI after 3 seconds
             setTimeout(() => {
                 useLessonStore.getState().resetStatusToIdle();
                 useLessonStore.getState().setFeedback("", "idle");
             }, 3000);
         }
      }, 15000); // 15 seconds max recording time
      
  }, [setPracticeModeActive, disconnect, sendClientContent]);
  
  // Listen for the AI triggering the action window
  useEffect(() => {
     const handleStartPracticeEvent = () => {
         startPracticeMode();
     };
     
     window.addEventListener('start-practice-mode', handleStartPracticeEvent);
     return () => {
         window.removeEventListener('start-practice-mode', handleStartPracticeEvent);
     };
  }, [startPracticeMode]);

  const endPracticeMode = () => {
     // User manually signals they are done. Gemini's VAD handles the audio "Done" version.
     // By dropping the framerate immediately, we stop Gemini from seeing the messy transition.
     setPracticeModeActive(false);
     useLessonStore.getState().setHasUserSignaledDone(true);
     
     // Clear the hard timeout
     if (practiceTimeoutRef.current) {
        clearTimeout(practiceTimeoutRef.current);
        practiceTimeoutRef.current = null;
     }
     
     // Send ONE explicit empty voice ping to ensure the WebSocket flushes the frame buffer to Gemini immediately
     sendAudioData(""); 
  }

  useEffect(() => {
     return () => {
        audioManager.stopRecording();
        videoCapture.stopCamera();
        disconnect();
        if (practiceTimeoutRef.current) clearTimeout(practiceTimeoutRef.current);
     }
  }, [disconnect]);

  return (
    <div className="flex flex-col w-full gap-4 relative">
      {/* Hidden video element required for browser capture API */}
      <video ref={videoRef} className="hidden" muted playsInline />

      {/* Mobile-only floating mascot — hidden on md+ */}
      {isActive && (
        <div className="fixed bottom-28 right-4 z-40 pointer-events-none md:hidden">
          <Mascot
            emotion={mascotEmotion}
            size={96}
            showMessage={mascotEmotion !== 'idle' && mascotEmotion !== 'thinking'}
            autoRevertToIdle={false}
          />
        </div>
      )}

      {/* Outer flex row: desktop shows [mascot sidebar] + [card] side by side */}
      <div className="flex items-center gap-6 justify-center">

        {/* Desktop sidebar mascot — visible only on md+ */}
        {isActive && (
          <div className="hidden md:flex flex-col items-center gap-3 shrink-0 self-center">
            <Mascot
              emotion={mascotEmotion}
              size={172}
              showMessage={mascotEmotion !== 'idle'}
              autoRevertToIdle={false}
            />
          </div>
        )}

      {/* ── Main Session Card ── */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/30 backdrop-blur-xl shadow-2xl shadow-black/40 w-full md:max-w-lg">
        {/* Status accent line */}
        <div
          className={`h-1 w-full transition-all duration-700 ${
            isPracticeModeActive
              ? 'bg-gradient-to-r from-red-500 via-orange-500 to-red-500 animate-pulse'
              : isConnected
              ? 'bg-gradient-to-r from-primary via-secondary to-primary'
              : 'bg-white/10'
          }`}
        />

        <div className="p-5 md:p-6 space-y-5">
          {/* Header row: title + status pill */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-lg font-black text-white tracking-tight uppercase">
              🤟 Live AI Tutor
            </h2>
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition-all duration-300 ${
                isPracticeModeActive
                  ? 'bg-red-500/15 border-red-500/30 text-red-400'
                  : isConnected
                  ? 'bg-primary/15 border-primary/30 text-primary'
                  : 'bg-white/5 border-white/10 text-muted-foreground'
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  isPracticeModeActive
                    ? 'bg-red-500 animate-ping'
                    : isConnected
                    ? 'bg-primary animate-pulse'
                    : 'bg-muted-foreground'
                }`}
              />
              {isPracticeModeActive
                ? 'RECORDING'
                : isConnecting
                ? 'Connecting…'
                : isConnected
                ? 'AI Listening'
                : 'Ready'}
            </div>
          </div>

          {/* Error banner */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3 text-sm text-red-400">
              ⚠️ {error}
            </div>
          )}

          {/* ── Word Progress Stepper ── */}
          {isActive && (
            <div className="flex flex-wrap items-center justify-center gap-y-2 gap-x-1">
              {lessonPath.map((lessonWord, index) => {
                const word = lessonWord.word;
                const isCompleted = index < currentStepIndex;
                const isCurrent = index === currentStepIndex && !isBossStage;
                return (
                  <div key={word} className="flex items-center">
                    <div
                      className={`
                        flex items-center justify-center px-3 py-1.5 rounded-full font-bold text-xs transition-all duration-400
                        ${isCompleted
                          ? 'bg-primary text-primary-foreground shadow-[0_0_12px_rgba(168,85,247,0.5)]'
                          : isCurrent
                          ? 'bg-primary/20 text-primary border-2 border-primary shadow-[0_0_16px_rgba(168,85,247,0.35)] scale-105'
                          : 'bg-white/5 text-muted-foreground/50 border border-white/8'
                        }
                      `}
                    >
                      {isCompleted && <span className="mr-1 text-[10px]">✓</span>}
                      {!isCompleted && !isCurrent && <span className="mr-1 text-[9px]">🔒</span>}
                      <span className="capitalize">{word}</span>
                    </div>
                    {index < lessonPath.length - 1 && (
                      <div
                        className={`w-4 h-0.5 mx-1 rounded-full transition-colors duration-300 ${
                          isCompleted ? 'bg-primary' : 'bg-white/10'
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Boss Stage Card ── */}
          {isActive && isBossStage && !isPracticeModeActive && (
            <div className="bg-yellow-500/8 border border-yellow-500/25 rounded-2xl p-4 space-y-2 animate-in slide-in-from-bottom-2 duration-400">
              <div className="flex items-center gap-2">
                <span className="text-xl">👑</span>
                <div>
                  <p className="text-sm font-black text-yellow-400 uppercase tracking-wider">Final Challenge!</p>
                  <p className="text-xs text-muted-foreground">Sign the full sentence fluently:</p>
                </div>
              </div>
              <div className="bg-black/30 rounded-xl px-4 py-3 border border-yellow-500/15">
                <p className="text-base font-black text-foreground capitalize tracking-wide text-center">
                  {lessonPath.map(w => w.word).join(' ')}
                </p>
              </div>
            </div>
          )}

          {/* ── Feedback Banner ── */}
          {isActive && isConnected && !isLessonComplete && feedback && (
            <div
              className={`flex items-start gap-3 rounded-2xl px-4 py-3 border text-sm animate-in fade-in slide-in-from-bottom-2 duration-300 ${
                feedbackStatus === 'error'
                  ? 'bg-red-500/10 border-red-500/20 text-red-300'
                  : 'bg-primary/8 border-primary/20 text-foreground/80'
              }`}
            >
              <span className="text-base shrink-0 mt-0.5">
                {feedbackStatus === 'error' ? '❌' : 'ℹ️'}
              </span>
              <p className="leading-snug">{feedback}</p>
            </div>
          )}

          {/* ── Practice Mode Controls ── */}
          {isActive && isConnected && !isLessonComplete && (
            <div className="flex flex-col items-center gap-3">
              {!isPracticeModeActive ? (
                <button
                  onClick={startPracticeMode}
                  className="w-full max-w-xs bg-primary hover:bg-primary/90 active:scale-95 text-white font-black text-base uppercase tracking-widest rounded-2xl py-4 shadow-lg shadow-primary/30 transition-all duration-200"
                >
                  I'm Ready 👍
                </button>
              ) : (
                <div className="w-full flex flex-col items-center gap-3 animate-in fade-in zoom-in duration-300">
                  <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 rounded-full text-xs font-bold">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                    LIVE — Sign now!
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Say <strong className="text-foreground">"Done"</strong> or tap button when finished
                  </p>
                  <button
                    onClick={endPracticeMode}
                    disabled={isRecordingBuffer}
                    className={`w-full max-w-xs border border-white/15 bg-white/5 hover:bg-white/10 text-foreground font-bold text-sm rounded-2xl py-3 transition-all duration-200 ${
                      isRecordingBuffer ? 'opacity-40 cursor-not-allowed' : ''
                    }`}
                  >
                    {isRecordingBuffer ? '⏳ Recording…' : '✅ Done / Finish'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Action Footer ── */}
        <div className="px-5 pb-5 md:px-6 md:pb-6 border-t border-white/5 pt-4">
          {!isActive ? (
            <button
              onClick={handleStart}
              disabled={isConnecting}
              className="w-full bg-gradient-to-r from-primary to-indigo-600 hover:opacity-95 active:scale-[0.98] text-white font-black text-base uppercase tracking-widest rounded-2xl py-4 shadow-xl shadow-primary/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConnecting ? '✨ Starting…' : '🎙️ Start Session'}
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="w-full border border-red-500/25 bg-red-500/8 hover:bg-red-500/15 text-red-400 font-bold text-sm rounded-2xl py-3 transition-all duration-200"
            >
              End Session
            </button>
          )}
        </div>
      </div>
      </div>{/* end outer flex row */}
    </div>
  );
}


