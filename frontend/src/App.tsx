import { useState } from 'react';
import { Coins, Flame, Trophy } from 'lucide-react';
import { useUserStore } from './stores/useUserStore';
import { useLessonStore } from './stores/useLessonStore';
import { ProgressBar } from './shared/ui/ProgressBar';
import { Card } from './shared/ui/Card';
import { Button } from './shared/ui/Button';
import { AvatarCanvas } from './features/live-session/components/AvatarCanvas';
import { RiveMascot } from './features/live-session/components/RiveMascot';
import { LiveSession } from './features/live-session/components/LiveSession';
import { AudioHapticController } from './shared/ui/AudioHapticController';
import { VictoryModal } from './shared/ui/VictoryModal';

function App() {
  const { streak, gems } = useUserStore();
  const { xp, referenceSign, setReferenceSign, isLessonComplete, resetLesson } = useLessonStore();
  const [sessionStarted, setSessionStarted] = useState(false);
  
  // Calculate progress based on XP (mock logic: 100 XP per level)
  const currentLevelProgress = xp % 100;
  const currentLevel = Math.floor(xp / 100) + 1;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary selection:text-primary-foreground">
      {/* Headless Audio & Haptics Observer */}
      <AudioHapticController />
      
      {/* Top Bar: Stats */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 bg-background/90 backdrop-blur-md border-b border-border">
        <div className="flex items-center space-x-4">
           {/* Level Indicator */}
           <div className="flex items-center space-x-2 bg-muted px-3 py-1.5 rounded-xl border border-border/50">
            <Trophy className="w-5 h-5 text-accent" />
            <span className="font-bold text-accent">Lvl {currentLevel}</span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Streak */}
          <div className="flex items-center space-x-1.5 text-chart-4">
            <Flame className="w-5 h-5 fill-current" />
            <span className="font-bold">{streak}</span>
          </div>
          
          {/* Gems */}
          <div className="flex items-center space-x-1.5 text-chart-1">
            <Coins className="w-5 h-5 fill-current" />
            <span className="font-bold">{gems}</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="pt-20 pb-40 px-4 max-w-md mx-auto space-y-6">
        
        {/* Lesson Progress Card */}
        <Card className="border-none shadow-none bg-transparent">
          <div className="p-4 space-y-3">
            <div className="flex justify-between items-center text-sm font-semibold text-muted-foreground">
              <span>Daily Goal</span>
              <span>{xp} / 100 XP</span>
            </div>
            <ProgressBar value={currentLevelProgress} max={100} />
          </div>
        </Card>

        {/* Hero Section */}
        <div className="text-center space-y-4 py-8">
          <div className="w-32 h-32 bg-card rounded-full mx-auto flex items-center justify-center border border-border shadow-[0_4px_0_0_var(--color-border)]">
             <span className="text-4xl">🦉</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Ready to learn, Prateek?</h1>
          <p className="text-muted-foreground max-w-[280px] mx-auto">
            Your daily lesson "Greetings 101" is ready.
          </p>
        </div>

        {/* Action Buttons or Live Session Component */}
        <div className="space-y-3 pt-4 relative z-20">
          {!sessionStarted ? (
            <>
              <Button className="w-full shadow-lg" size="lg" variant="primary" onClick={() => setSessionStarted(true)}>
                START SESSION
              </Button>
              <Button className="w-full shadow-md" size="lg" variant="secondary">
                PRACTICE WEAK WORDS
              </Button>
            </>
          ) : (
             <LiveSession onEnd={() => setSessionStarted(false)} />
          )}
        </div>
        
        {/* 3D Avatar Background (Decorative) */}
        {!sessionStarted && !referenceSign && (
          <div className="relative w-full h-[350px] z-0 pointer-events-none mt-8">
             <AvatarCanvas />
          </div>
        )}

        {/* Space explicitly reserved so user can scroll past the bottom UI */}
        <div className="h-32 w-full shrink-0" aria-hidden="true" />

        {/* Rive Mascot Overlay (Always Visible during session) */}
        <div className="fixed bottom-20 right-4 z-10 pointer-events-none">
           <RiveMascot />
        </div>
      </main>

      {/* Post-Lesson Gamification Screen */}
      {isLessonComplete && (
        <VictoryModal 
          onContinue={() => {
            resetLesson();
            setSessionStarted(false);
          }} 
        />
      )}

      {/* Sign Reference Modal (Rendered above everything at root level) */}
      {referenceSign && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-card w-full max-w-sm rounded-3xl border border-border overflow-hidden relative shadow-2xl">
             <div className="p-4 border-b border-border flex justify-between items-center bg-muted/50">
               <h3 className="font-bold text-foreground capitalize">
                  {referenceSign.replace(/_/g, ' ')}
               </h3>
               <Button variant="ghost" size="sm" onClick={() => setReferenceSign(null)}>
                  Close
               </Button>
             </div>
             <div className="relative h-[300px] w-full bg-background/50">
               <AvatarCanvas signName={referenceSign} isModalContext={true} />
             </div>
           </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border px-6 py-4 flex justify-between items-center z-50">
         <Button variant="ghost" size="icon" className="text-primary hover:bg-muted">
            <Trophy className="w-7 h-7" />
         </Button>
         <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground hover:bg-muted">
            <Flame className="w-7 h-7" />
         </Button>
         <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground hover:bg-muted">
            <Coins className="w-7 h-7" />
         </Button>
      </nav>
    </div>
  )
}

export default App
