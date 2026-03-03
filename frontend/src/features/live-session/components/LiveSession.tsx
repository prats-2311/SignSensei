import { useEffect, useRef, useState } from 'react';
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
  const { isConnected, isConnecting, error, connect, disconnect, sendAudioData, sendVideoData } = useGeminiLive();
  const { lessonPath, currentStepIndex } = useLessonStore();

  const handleStart = async () => {
    try {
      // Initialize Audio playback explicitly during user iteration to satisfy browser policy
      audioManager.initializePlaybackContext();
      
      // Setup audio to send to Gemini
      await audioManager.startRecording((base64Audio) => {
        sendAudioData(base64Audio);
      });
      
      // Setup video to send to Gemini at 5 FPS to capture sign motion
      if (videoRef.current) {
         await videoCapture.startCamera(videoRef.current, (base64Video) => {
            if (!useLessonStore.getState().isAiPaused) {
               sendVideoData(base64Video);
            }
         }, 5);
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
     onEnd();
  };

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
          
          <div className="pt-4">
            {!isActive ? (
               <Button onClick={handleStart} disabled={isConnecting} className="w-full shadow-lg" size="lg" variant="primary">
                  ACTIVATE SENSORS
               </Button>
            ) : (
               <Button onClick={handleStop} className="w-full" variant="danger" size="lg">
                  END SESSION
               </Button>
            )}
          </div>
       </div>
    </div>
  );
}
