import { Coins, Flame, Trophy } from 'lucide-react';
import { useUserStore } from './stores/useUserStore';
import { useLessonStore } from './stores/useLessonStore';
import { ProgressBar } from './shared/ui/ProgressBar';
import { Card } from './shared/ui/Card';
import { Button } from './shared/ui/Button';
import { AvatarCanvas } from './features/live-session/components/AvatarCanvas';
import { RiveMascot } from './features/live-session/components/RiveMascot';

function App() {
  const { streak, gems } = useUserStore();
  const { xp } = useLessonStore();
  
  // Calculate progress based on XP (mock logic: 100 XP per level)
  const currentLevelProgress = xp % 100;
  const currentLevel = Math.floor(xp / 100) + 1;

  return (
    <div className="min-h-screen bg-[#131f24] text-white font-sans selection:bg-[#58cc02] selection:text-white">
      {/* Top Bar: Stats */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 bg-[#131f24]/90 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center space-x-4">
           {/* Level Indicator */}
           <div className="flex items-center space-x-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
            <Trophy className="w-5 h-5 text-[#ffd900]" />
            <span className="font-bold text-[#ffd900]">Lvl {currentLevel}</span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Streak */}
          <div className="flex items-center space-x-1.5 text-[#ff9600]">
            <Flame className="w-5 h-5 fill-current" />
            <span className="font-bold">{streak}</span>
          </div>
          
          {/* Gems */}
          <div className="flex items-center space-x-1.5 text-[#1cb0f6]">
            <Coins className="w-5 h-5 fill-current" />
            <span className="font-bold">{gems}</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="pt-20 pb-24 px-4 max-w-md mx-auto space-y-6">
        
        {/* Lesson Progress Card */}
        <Card className="bg-[#202f36] border-none shadow-none">
          <div className="p-4 space-y-3">
            <div className="flex justify-between items-center text-sm font-semibold text-slate-400">
              <span>Daily Goal</span>
              <span>{xp} / 100 XP</span>
            </div>
            <ProgressBar value={currentLevelProgress} max={100} color="#58cc02" />
          </div>
        </Card>

        {/* Hero Section */}
        <div className="text-center space-y-4 py-8">
          <div className="w-32 h-32 bg-[#2b3b44] rounded-full mx-auto flex items-center justify-center border-4 border-[#3c4d56]">
             <span className="text-4xl">🦉</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Ready to learn, Prateek?</h1>
          <p className="text-slate-400 max-w-[280px] mx-auto">
            Your daily lesson "Greetings 101" is ready.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-4">
          <Button className="w-full" size="lg" variant="primary">
            START SESSION
          </Button>
          <Button className="w-full" size="lg" variant="secondary">
            PRACTICE WEAK WORDS
          </Button>
        </div>
        
        {/* 3D Avatar Overlay */}
        <div className="fixed bottom-0 left-0 right-0 h-[400px] z-0 pointer-events-none">
           <AvatarCanvas />
        </div>

        {/* Rive Mascot Overlay */}
        <div className="fixed bottom-20 right-4 z-10 pointer-events-none">
           <RiveMascot />
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#131f24] border-t border-white/10 px-6 py-4 flex justify-between items-center z-50">
         <Button variant="ghost" size="icon" className="text-[#58cc02]">
            <Trophy className="w-7 h-7" />
         </Button>
         <Button variant="ghost" size="icon" className="text-slate-500 hover:text-white">
            <Flame className="w-7 h-7" />
         </Button>
         <Button variant="ghost" size="icon" className="text-slate-500 hover:text-white">
            <Coins className="w-7 h-7" />
         </Button>
      </nav>
    </div>
  )
}

export default App
