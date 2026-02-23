import { Trophy } from 'lucide-react';
import { Button } from './Button';
import { useLessonStore } from '../../stores/useLessonStore';
import { useUserStore } from '../../stores/useUserStore';

interface VictoryModalProps {
  onContinue: () => void;
}

export function VictoryModal({ onContinue }: VictoryModalProps) {
  const { xp } = useLessonStore();
  const { streak } = useUserStore();
  
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-background/90 backdrop-blur-md p-4 animate-in slide-in-from-bottom-8 duration-500">
       <div className="bg-card w-full max-w-sm rounded-[2rem] border-4 border-primary overflow-hidden relative shadow-2xl p-6 text-center space-y-6">
         
         <div className="w-24 h-24 bg-primary/20 rounded-full mx-auto flex items-center justify-center">
            <Trophy className="w-12 h-12 text-primary" />
         </div>
         
         <div className="space-y-2">
            <h2 className="text-3xl font-black text-foreground uppercase tracking-tight">Lesson Complete!</h2>
            <p className="text-muted-foreground font-medium">You're doing amazing.</p>
         </div>
         
         <div className="grid grid-cols-2 gap-4 py-4">
            <div className="bg-muted/50 rounded-2xl p-4 border border-border/50">
               <div className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">Total XP</div>
               <div className="text-2xl font-black text-chart-2">+{xp}</div>
            </div>
            
            <div className="bg-muted/50 rounded-2xl p-4 border border-border/50">
               <div className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">Day Streak</div>
               <div className="text-2xl font-black text-chart-4">{streak}</div>
            </div>
         </div>
         
         <Button className="w-full shadow-lg h-14 text-lg" variant="primary" onClick={onContinue}>
            CONTINUE
         </Button>
         
       </div>
    </div>
  );
}
