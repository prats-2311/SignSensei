import { useEffect, useRef, useState } from 'react';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { AudioManager } from '../../../shared/lib/audioManager';
import { VideoCapture } from '../../../shared/lib/videoCapture';
import { Button } from '../../../shared/ui/Button';

const audioManager = new AudioManager();
const videoCapture = new VideoCapture();

export function LiveSession({ onEnd }: { onEnd: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isActive, setIsActive] = useState(false);
  const { isConnected, isConnecting, error, connect, disconnect, sendAudioData, sendVideoData } = useGeminiLive();

  const handleStart = async () => {
    try {
      // Setup audio to send to Gemini
      await audioManager.startRecording((base64Audio) => {
        sendAudioData(base64Audio);
      });
      
      // Setup video to send to Gemini at 1 FPS
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
