import { useRef, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface AvatarCanvasProps {
  signName?: string | null;
  isModalContext?: boolean;
}

export function AvatarCanvas({ signName, isModalContext = false }: AvatarCanvasProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function fetchVideo() {
       if (!signName) {
           // Idle state (e.g. background decoration)
           setVideoUrl(null);
           return;
       }

       setIsLoading(true);
       setIsError(false);
       
       try {
           const res = await fetch(`http://localhost:8000/api/sign/${signName}`);
           if (!res.ok) throw new Error("Video not found");
           
           const data = await res.json();
           setVideoUrl(data.video_url);
       } catch (err) {
           console.error("Failed to fetch sign ASL video:", err);
           setIsError(true);
           setVideoUrl(null);
       } finally {
           setIsLoading(false);
       }
    }

    fetchVideo();
  }, [signName]);

  const containerClass = isModalContext 
    ? "w-full h-full bg-black flex items-center justify-center relative" 
    : "w-full h-full rounded-t-[100px] overflow-hidden bg-muted/30 border-t border-x border-border/50 relative";

  return (
    <div className={containerClass}>
       {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 backdrop-blur-sm z-10 text-muted-foreground">
             <Loader2 className="w-8 h-8 animate-spin mb-2 text-primary" />
             <span className="text-sm font-bold tracking-widest uppercase">Fetching Video...</span>
          </div>
       )}

       {isError && (
          <div className="absolute inset-0 flex items-center justify-center text-destructive bg-destructive/10 z-10 p-4 text-center text-sm font-medium">
             Could not find a video representation for "{signName}".
          </div>
       )}

       {videoUrl ? (
          <video 
            ref={videoRef}
            src={videoUrl}
            autoPlay 
            loop 
            muted 
            playsInline
            className={`object-cover shadow-inner ${isModalContext ? 'w-full h-full' : 'h-[350px] rounded-t-[100px]'}`}
          />
       ) : !isLoading && !isError && (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/50">
            <span className="text-6xl mb-4 opacity-50">📹</span>
            <span className="font-medium tracking-wide">Waiting for AI...</span>
          </div>
       )}
    </div>
  );
}
