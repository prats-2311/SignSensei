import { useRef } from 'react';

interface AvatarCanvasProps {
  signName?: string;
  isModalContext?: boolean;
}

export function AvatarCanvas({ signName, isModalContext = false }: AvatarCanvasProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Dynamically resolve the URL based on the requested sign, fallback to placeholder
  const videoUrl = signName 
    ? `/videos/signs/${signName}.mp4` 
    : "/videos/signs/hello.mp4"; // Default placeholder when idle

  const containerClass = isModalContext 
    ? "w-full h-full min-h-[300px] flex items-center justify-center bg-background/50 rounded-b-xl overflow-hidden" 
    : "w-full h-full absolute bottom-0 left-0 z-0 pointer-events-none flex items-end justify-center opacity-80 mix-blend-multiply dark:mix-blend-screen";

  return (
    <div className={containerClass}>
       <video 
         ref={videoRef}
         src={videoUrl}
         autoPlay 
         loop 
         muted 
         playsInline
         className={`object-cover shadow-inner ${isModalContext ? 'w-full h-full' : 'h-[350px] rounded-t-[100px]'}`}
       />
    </div>
  );
}
