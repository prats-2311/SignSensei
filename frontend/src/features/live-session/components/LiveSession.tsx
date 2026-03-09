import { useEffect, useRef, useState, useCallback } from 'react';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { AudioManager } from '../../../shared/lib/audioManager';
import { VideoCapture } from '../../../shared/lib/videoCapture';
import { Button } from '../../../shared/ui/Button';
import { useLessonStore } from '../../../stores/useLessonStore';

const audioManager = new AudioManager();
const videoCapture = new VideoCapture();

export function LiveSession({ onEnd }: { onEnd: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const { isConnected, isConnecting, error, connect, disconnect, sendAudioData, sendVideoData } = useGeminiLive();
  const { lessonPath, currentStepIndex, isPracticeModeActive, setPracticeModeActive, isBossStage, finalScore, feedback, isLessonComplete } = useLessonStore();

  const handleStart = async () => {
    try {
      // Initialize Audio playback explicitly during user iteration to satisfy browser policy
      audioManager.initializePlaybackContext();
      
      // Setup audio to send to Gemini
      await audioManager.startRecording((base64Audio) => {
        sendAudioData(base64Audio);
      });
      
      // Start camera at 1 FPS (Low Bandwidth Wait Mode)
      if (videoRef.current) {
         await videoCapture.startCamera(videoRef.current, (base64Video) => {
            sendVideoData(base64Video);
         }, 1);
      }

      // Connect and provide playback callback for incoming audio
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
         // Switch to 15 FPS for high-fidelity evaluation
         videoCapture.changeFramerate(15, (base64Video) => {
             sendVideoData(base64Video);
         });
     } else {
         // Drop back down to 1 FPS to save tokens
         videoCapture.changeFramerate(1, (base64Video) => {
             sendVideoData(base64Video);
         });
     }
  }, [isActive, isPracticeModeActive, sendVideoData]);

  const startPracticeMode = useCallback(() => {
      setCountdown(null);
      setPracticeModeActive(true);
  }, [setPracticeModeActive]);
  
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
     
     // Send ONE explicit empty voice ping to ensure the WebSocket flushes the frame buffer to Gemini immediately
     sendAudioData(""); 
  }

  useEffect(() => {
     return () => {
        audioManager.stopRecording();
        videoCapture.stopCamera();
        disconnect();
     }
  }, [disconnect]);

  return (
    <div className="flex flex-col w-full space-y-4">
       {/* Hidden video element required for browser capture API */}
       <video ref={videoRef} className="hidden" muted playsInline />
       
       <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-4 relative z-20 shadow-[0_4px_0_0_var(--color-border)]">
          <h2 className="text-xl font-bold text-card-foreground">Live AI Tutor</h2>
          
          {/* Duolingo Style Tracker Stepper */}
          {isActive && (
            <div className="flex flex-wrap items-center justify-center py-2 gap-y-3 w-full max-w-sm mx-auto">
              {lessonPath.map((word, index) => {
                const isCompleted = index < currentStepIndex;
                const isCurrent = index === currentStepIndex;
                return (
                  <div key={word} className="flex items-center">
                    <div className={`
                      flex items-center justify-center h-9 sm:h-10 px-3 sm:px-4 rounded-full font-bold text-xs sm:text-sm transition-all duration-300
                      ${isCompleted ? 'bg-primary text-primary-foreground' : ''}
                      ${isCurrent ? 'bg-primary/20 text-primary border-2 border-primary shadow-[0_0_15px_rgba(255,255,255,0.2)]' : ''}
                      ${!isCompleted && !isCurrent ? 'bg-muted text-muted-foreground border-2 border-transparent opacity-60' : ''}
                    `}>
                      {isCompleted && <span className="mr-1 sm:mr-1.5">✓</span>}
                      {!isCompleted && !isCurrent && <span className="mr-1 sm:mr-1.5 text-[0.65rem] sm:text-xs">🔒</span>}
                      <span className="capitalize">{word}</span>
                    </div>
                    {index < lessonPath.length - 1 && (
                      <div className={`w-3 sm:w-6 h-1 sm:h-1.5 rounded-full mx-1 sm:mx-1.5 transition-colors duration-300 shrink-0 ${isCompleted ? 'bg-primary' : 'bg-muted'}`} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
          
          {error && <div className="text-destructive bg-destructive/10 p-3 rounded-xl text-sm">{error}</div>}
          
          <div className="flex justify-center items-center space-x-2 bg-muted/50 py-2 px-4 rounded-full w-fit mx-auto border border-border/50">
             <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-primary shadow-[0_0_10px_var(--color-primary)] animate-pulse' : 'bg-muted-foreground'}`} />
             <span className="text-muted-foreground font-medium text-sm tracking-wide">
                {isConnecting ? "Connecting to Gemini..." : isConnected ? "AI is Listening" : "System Ready"}
             </span>
          </div>
          
          {/* Practice Mode Controls */}
          {isActive && isConnected && !isLessonComplete && (
             <div className="py-4 h-[120px] flex items-center justify-center">
                
                {countdown !== null ? (
                   <div className="text-6xl font-black text-primary animate-bounce">
                      {countdown}
                   </div>
                ) : !isPracticeModeActive ? (
                   <div className="flex flex-col items-center w-full">
                      {isBossStage && (
                         <div className="mb-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 w-full animate-in slide-in-from-bottom-2">
                             <h3 className="text-yellow-500 font-bold mb-1">👑 Final Challenge!</h3>
                             <p className="text-sm text-muted-foreground font-medium">Sign the full sentence fluidly:</p>
                             <p className="text-lg font-black text-foreground capitalize italic mt-1 bg-background/50 py-1 rounded-md">{lessonPath.join(" ")}</p>
                         </div>
                      )}
                      <Button onClick={startPracticeMode} size="lg" className="w-full max-w-[200px] shadow-lg text-lg py-6" variant="primary">
                         I'm Ready 👍
                      </Button>
                   </div>
                ) : (
                   <div className="flex flex-col items-center space-y-3 w-full animate-in fade-in zoom-in duration-300">
                      <div className="bg-red-500/10 text-red-500 border border-red-500/20 px-4 py-1.5 rounded-full text-sm font-bold animate-pulse flex items-center">
                         <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                         LIVE RECORDING
                      </div>
                      <p className="text-sm text-muted-foreground font-medium">Say "Done" or give a Thumbs Up when finished.</p>
                      <Button onClick={endPracticeMode} variant="secondary" className="w-full max-w-[200px] border-border bg-card shadow-sm hover:bg-muted" size="lg">
                         Done / Finish
                      </Button>
                   </div>
                )}
                
             </div>
          )}

          {/* Enhanced Victory State */}
          {isLessonComplete && (
             <div className="py-6 flex flex-col items-center space-y-4 animate-in zoom-in slide-in-from-bottom-4 duration-500">
                <div className="bg-green-500/20 text-green-500 rounded-full p-4 mb-2">
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                     <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                   </svg>
                </div>
                <h3 className="text-2xl font-black text-foreground">Sentence Complete!</h3>
                
                {finalScore !== null && (
                    <div className="flex flex-col items-center bg-card border border-border rounded-xl p-4 w-full max-w-sm shadow-sm">
                       <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Fluency Rating</span>
                       <div className="flex space-x-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                             <svg key={star} xmlns="http://www.w3.org/2000/svg" className={`h-8 w-8 ${star <= finalScore ? 'text-yellow-400 fill-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]' : 'text-muted-foreground/30'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                               <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                             </svg>
                          ))}
                       </div>
                       {feedback && (
                           <p className="mt-4 text-sm text-foreground italic bg-muted/40 p-3 rounded-lg border border-border/50 text-left">
                               "{feedback}"
                           </p>
                       )}
                    </div>
                )}
             </div>
          )}
          
          <div className="pt-2">
            {!isActive ? (
               <Button onClick={handleStart} disabled={isConnecting} className="w-full shadow-lg" size="lg" variant="primary">
                  ACTIVATE SENSORS
               </Button>
            ) : (
               <Button onClick={handleStop} className="w-full mt-4" variant="danger" size="lg">
                  END SESSION
               </Button>
            )}
          </div>
       </div>
    </div>
  );
}
