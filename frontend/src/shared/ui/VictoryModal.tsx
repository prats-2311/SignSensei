import { Trophy, Star } from 'lucide-react';
import { Button } from './Button';
import { useLessonStore } from '../../stores/useLessonStore';
import { useUserStore } from '../../stores/useUserStore';
import { useEffect, useState } from 'react';

interface VictoryModalProps {
  onContinue: () => void;
}

export function VictoryModal({ onContinue }: VictoryModalProps) {
  const { finalScore, feedback } = useLessonStore();
  const { streak, xp } = useUserStore();
  const [revealedStars, setRevealedStars] = useState(0);

  // Duolingo-style sequential star fill animation
  useEffect(() => {
    if (finalScore === null) return;
    
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= finalScore; i++) {
      timers.push(
        setTimeout(() => setRevealedStars(i), i * 600)
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [finalScore]);

  const starCount = finalScore || 0;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-background/90 backdrop-blur-md p-4 animate-in slide-in-from-bottom-8 duration-500">
       <div className="bg-card w-full max-w-sm rounded-[2rem] border-4 border-primary overflow-hidden relative shadow-2xl p-6 text-center space-y-5">
         
         {/* Trophy Icon */}
         <div className="w-20 h-20 bg-primary/20 rounded-full mx-auto flex items-center justify-center">
            <Trophy className="w-10 h-10 text-primary" />
         </div>
         
         <div className="space-y-1">
            <h2 className="text-2xl font-black text-foreground uppercase tracking-tight">Lesson Complete!</h2>
            <p className="text-muted-foreground font-medium text-sm">You're doing amazing.</p>
         </div>
         
         {/* 3-Star Animated Rating */}
         <div className="flex justify-center items-end space-x-3 py-2">
           {[1, 2, 3].map((star) => {
             const isEarned = star <= starCount;
             const isRevealed = star <= revealedStars;
             const isMiddle = star === 2;
             
             return (
               <div 
                 key={star} 
                 className={`transition-all duration-500 ${isMiddle ? 'scale-125 -translate-y-1' : ''} ${isRevealed && isEarned ? 'animate-bounce' : ''}`}
                 style={{ 
                   animationDelay: `${star * 0.15}s`,
                   animationDuration: '0.6s',
                   animationIterationCount: '1' 
                 }}
               >
                 <Star 
                   className={`w-12 h-12 transition-all duration-500 ${
                     isRevealed && isEarned 
                       ? 'text-yellow-400 fill-yellow-400 drop-shadow-[0_0_12px_rgba(250,204,21,0.7)]' 
                       : 'text-muted-foreground/30'
                   }`}
                   strokeWidth={1.5}
                 />
               </div>
             );
           })}
         </div>

         {/* Feedback Quote */}
         {feedback && (
             <p className="text-sm text-foreground italic bg-muted/40 p-3 rounded-xl border border-border/50 text-left">
                 "{feedback}"
             </p>
         )}
         
         {/* Stats Cards */}
         <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/50 rounded-2xl p-3 border border-border/50">
               <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Total XP</div>
               <div className="text-xl font-black text-chart-2">+{xp}</div>
            </div>
            
            <div className="bg-muted/50 rounded-2xl p-3 border border-border/50">
               <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Day Streak</div>
               <div className="text-xl font-black text-chart-4">{streak}</div>
            </div>
         </div>
         
         <Button className="w-full shadow-lg h-14 text-lg" variant="primary" onClick={onContinue}>
            CONTINUE
         </Button>
         
       </div>
    </div>
  );
}
