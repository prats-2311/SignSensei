import { useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { Coins, Flame, Trophy, Lock, Star } from 'lucide-react';
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
import { LESSONS } from './data/curriculum';
import type { LessonData } from './data/curriculum';

// --- Screen Components ---

function MapScreen() {
  const navigate = useNavigate();
  const { initializeLesson } = useLessonStore();
  const { xp, unlockedLessonIds, lessonScores } = useUserStore();
  const [selectedLesson, setSelectedLesson] = useState<LessonData | null>(null);
  const currentLevelProgress = xp % 100;

  const handleStartLesson = (lesson: LessonData) => {
      initializeLesson(lesson.id, lesson.path);
      navigate(`/lesson/${lesson.id}`);
  };

  return (
    <>
      {/* Animated Gradient Background */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0f0c29] via-[#302b63] to-[#24243e]" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-blue-500/10 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '12s' }} />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-indigo-500/8 rounded-full blur-[80px] animate-pulse" style={{ animationDuration: '10s' }} />
      </div>

      <Card className="border-none shadow-none bg-transparent relative z-10">
        <div className="p-4 space-y-3">
          <div className="flex justify-between items-center text-sm font-semibold text-muted-foreground">
            <span>Daily Goal</span>
            <span>{xp} / 100 XP</span>
          </div>
          <ProgressBar value={currentLevelProgress} max={100} />
        </div>
      </Card>

      <div className="py-12 relative z-20 flex flex-col items-center">
        {LESSONS.map((lesson, index) => {
          const isSelected = selectedLesson?.id === lesson.id;
          const isUnlocked = unlockedLessonIds.includes(lesson.id);
          const isLocked = !isUnlocked;
          const lessonStars = lessonScores[lesson.id] || 0;
          
          return (
            <div key={lesson.id} className="relative flex flex-col items-center mb-8">
              {/* Vertical Dashed Connection Line */}
              {index !== LESSONS.length - 1 && (
                 <div className={`absolute top-20 w-px h-16 border-l-2 border-dashed -z-10 ${isUnlocked ? 'border-white/30' : 'border-white/10'}`} />
              )}
              
              {/* Active / Inactive Node */}
              <div 
                  className={`w-28 h-28 rounded-full flex items-center justify-center border-4 shadow-2xl transition-all duration-300 relative z-10 
                    ${isLocked 
                        ? 'bg-white/5 border-white/10 opacity-60 cursor-not-allowed backdrop-blur-sm' 
                        : `${lesson.color} border-white/50 cursor-pointer hover:scale-105 hover:brightness-110 shadow-[0_0_30px_rgba(255,255,255,0.15)]`
                    }
                    ${isSelected ? 'ring-4 ring-white ring-offset-4 ring-offset-background scale-110' : ''}
                  `}
                  onClick={() => {
                      if (!isLocked) {
                          setSelectedLesson(isSelected ? null : lesson);
                      }
                  }}
              >
                  {isLocked ? (
                      <Lock className="w-8 h-8 text-white/30" />
                  ) : (
                      <span className="text-5xl transform translate-y-[-2px]">{lesson.icon}</span>
                  )}
                  
                  {/* Star Indicators (replace old dots) */}
                  {!isLocked && (
                     <div className="absolute -bottom-3 flex space-x-1">
                        {[1, 2, 3].map((star) => (
                           <Star
                              key={star}
                              className={`w-4 h-4 ${
                                star <= lessonStars 
                                  ? 'text-yellow-400 fill-yellow-400 drop-shadow-[0_0_4px_rgba(250,204,21,0.6)]' 
                                  : 'text-white/20'
                              }`}
                              strokeWidth={2}
                           />
                        ))}
                     </div>
                  )}
              </div>

              {/* Popup Detail Card (Shows when selected) */}
              {isSelected && (
                  <div className="absolute top-1/2 left-[120px] -translate-y-1/2 ml-4 w-64 bg-card/95 backdrop-blur-xl border border-white/15 rounded-2xl p-5 shadow-[0_10px_40px_rgba(0,0,0,0.5)] z-50 animate-in zoom-in-95 duration-200">
                     <h3 className="text-lg font-bold text-white mb-1">{lesson.title}</h3>
                     <p className="text-sm text-gray-400 mb-4">{lesson.description}</p>
                     
                     <div className="flex flex-wrap gap-2 mb-5">
                       {lesson.path.map(word => (
                          <span key={word} className="text-[10px] font-bold uppercase tracking-wider bg-white/10 text-white/80 px-2 py-1 rounded">
                             {word}
                          </span>
                       ))}
                     </div>
                     
                     <button 
                        className="w-full py-3 rounded-xl font-bold text-white text-sm uppercase tracking-wider bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 shadow-lg hover:shadow-pink-500/25 transition-all duration-300 active:scale-95" 
                        onClick={() => handleStartLesson(lesson)}
                     >
                        START
                     </button>
                  </div>
              )}
            </div>
          );
        })}
      </div>
        
      {/* 3D Avatar Background (Decorative on Map) */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-30 mix-blend-screen scale-110">
         <AvatarCanvas />
      </div>

       {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-xl border-t border-border/50 px-6 py-4 flex justify-between items-center z-50">
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
    </>
  );
}


function LessonScreen() {
  const navigate = useNavigate();
  // We can use lessonId for fetching specific curricula later
  // const { lessonId } = useParams();

  return (
    <div className="relative z-20 pt-6 animate-in slide-in-from-bottom-8 duration-500">
       <Button variant="ghost" size="sm" className="mb-4 text-muted-foreground" onClick={() => navigate('/')}>
          ← Back to Map
       </Button>
       <LiveSession onEnd={() => navigate('/')} />
       
       <div className="fixed bottom-6 right-4 z-50 pointer-events-none">
         <RiveMascot />
       </div>
    </div>
  );
}

// --- Main App Shell ---

function AppContent() {
  const { streak, xp, gems } = useUserStore();
  const { referenceSign, setReferenceSign, isLessonComplete, resetLesson, setAiPaused } = useLessonStore();
  // Using global xp directly so no need to recalculate currentLevelProgress here or pass it if you don't want to.
  const navigate = useNavigate();

  const currentLevel = Math.floor(xp / 100) + 1;

  // Handle post-lesson routing seamlessly
  if (isLessonComplete) {
     return (
        <VictoryModal 
          onContinue={() => {
            resetLesson();
            navigate('/');
          }} 
        />
     )
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-foreground font-sans selection:bg-primary selection:text-primary-foreground overflow-hidden">
      <AudioHapticController />
      
      {/* Top Bar (Shared globally) */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 bg-background/50 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center space-x-4">
           <div className="flex items-center space-x-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 shadow-inner">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <span className="font-bold text-yellow-500 drop-shadow-sm">Lvl {currentLevel}</span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.4)]">
            <Flame className="w-5 h-5 fill-current" />
            <span className="font-bold">{streak}</span>
          </div>
          <div className="flex items-center space-x-1.5 text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.4)]">
            <Coins className="w-5 h-5 fill-current" />
            <span className="font-bold">{gems}</span>
          </div>
        </div>
      </header>

      {/* Route Container */}
      <main className="pt-24 pb-32 px-4 max-w-md mx-auto relative min-h-screen flex flex-col">
          <Routes>
            <Route path="/" element={<MapScreen />} />
            <Route path="/lesson/:lessonId" element={<LessonScreen />} />
          </Routes>
      </main>

      {/* Global Modals */}
      {referenceSign && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
           <div className="bg-card w-full max-w-sm rounded-[2rem] border border-white/10 overflow-hidden relative shadow-2xl">
             <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
               <h3 className="font-bold text-foreground capitalize tracking-wide">
                  {referenceSign.replace(/_/g, ' ')}
               </h3>
               <Button variant="ghost" size="sm" onClick={() => { setReferenceSign(null); setAiPaused(false); }} className="hover:bg-white/10 rounded-full">
                  ✕ Close
               </Button>
             </div>
             <div className="relative h-[300px] w-full bg-black/50 flex items-center justify-center">
               <AvatarCanvas signName={referenceSign} isModalContext={true} />
             </div>
           </div>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
