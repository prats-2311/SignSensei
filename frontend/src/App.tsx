import { useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Map, Layers, User, Lock, Star, Sparkles, Loader2, X } from 'lucide-react';
import { useUserStore } from './stores/useUserStore';
import { useLessonStore } from './stores/useLessonStore';
import { ProgressBar } from './shared/ui/ProgressBar';
import { Button } from './shared/ui/Button';
import { Badge } from './shared/ui/Badge';
import { GlassCard } from './shared/ui/GlassCard';
import { Input } from './shared/ui/Input';
import { ToastController } from './shared/ui/Toast';
import { Sidebar } from './shared/ui/Sidebar';
import { RightRail } from './shared/ui/RightRail';
import { SplashScreen } from './shared/ui/SplashScreen';
import { TourOverlay } from './shared/ui/TourOverlay';
import { AvatarCanvas } from './features/live-session/components/AvatarCanvas';
import { LiveSession } from './features/live-session/components/LiveSession';
import { AudioHapticController } from './shared/ui/AudioHapticController';
import { VictoryModal } from './shared/ui/VictoryModal';
import { DecksScreen } from './features/dashboard/DecksScreen';
import { ProfileScreen } from './features/profile/ProfileScreen';
import { LESSONS } from './data/curriculum';
import type { LessonData } from './data/curriculum';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './shared/lib/firebase';

// --- Screen Components ---

function MapScreen() {
  const navigate = useNavigate();
  const { initializeLesson } = useLessonStore();
  const { xp, unlockedLessonIds, lessonScores } = useUserStore();
  const [selectedLesson, setSelectedLesson] = useState<LessonData | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const currentLevelProgress = xp % 100;

  const handleStartLesson = (lesson: LessonData) => {
    initializeLesson(lesson.id, lesson.path);
    navigate(`/lesson/${lesson.id}`);
  };

  const handleGenerateLesson = async () => {
    if (!customPrompt.trim()) return;
    setIsGenerating(true);
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      const res = await fetch(`${baseUrl}/api/generate-lesson`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: customPrompt })
      });
      if (!res.ok) throw new Error("Failed to generate lesson");
      const lessonData = await res.json();
      const user = auth.currentUser;
      if (user) {
        await setDoc(doc(db, 'decks', lessonData.lessonId), {
          creatorId: user.uid,
          title: lessonData.title,
          prompt: customPrompt,
          path: lessonData.path,
          createdAt: serverTimestamp(),
          isPublic: false
        });
      }
      useLessonStore.getState().resetLesson();
      initializeLesson(lessonData.lessonId, lessonData.path);
      navigate(`/lesson/${lessonData.lessonId}`);
    } catch (err) {
      console.error("Error generating lesson:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <div className="px-4 pt-2 pb-3 space-y-2" data-tour="daily-goal">
        <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground">
          <span>Daily Goal</span>
          <span className="text-primary">{currentLevelProgress} / 100 XP</span>
        </div>
        <ProgressBar
          value={currentLevelProgress}
          max={100}
          size="sm"
          label="Daily XP Goal"
        />
      </div>

      {/* AI Lesson Generator */}
      <div className="px-4 pb-4" data-tour="ai-input">
        <GlassCard variant="elevated" className="p-1.5">
          <div className="flex items-center gap-2">
            <Input
              placeholder="I want to learn..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerateLesson()}
              disabled={isGenerating}
              className="border-none bg-transparent focus:ring-0 py-2.5"
              containerClassName="flex-1"
            />
            <Button
              onClick={handleGenerateLesson}
              disabled={!customPrompt.trim() || isGenerating}
              className="rounded-2xl w-11 h-11 p-0 shrink-0 shadow-lg shadow-primary/30"
              aria-label="Generate AI lesson"
            >
              {isGenerating
                ? <Loader2 className="w-5 h-5 animate-spin" />
                : <Sparkles className="w-5 h-5" />
              }
            </Button>
          </div>
        </GlassCard>
      </div>

      {/* Lesson Nodes */}
      <div className="py-4 flex flex-col items-center" data-tour="lesson-node">
        {LESSONS.map((lesson, index) => {
          const isSelected = selectedLesson?.id === lesson.id;
          const isUnlocked = unlockedLessonIds.includes(lesson.id);
          const isLocked = !isUnlocked;
          const lessonStars = lessonScores[lesson.id] || 0;

          return (
            <div key={lesson.id} className="relative flex flex-col items-center mb-6">
              {/* Dashed connector line */}
              {index !== LESSONS.length - 1 && (
                <div
                  className={`absolute top-[calc(7rem+8px)] w-px h-12 border-l-2 border-dashed -z-10 ${
                    isUnlocked ? 'border-primary/40' : 'border-white/10'
                  }`}
                />
              )}

              {/* Node */}
              <div
                className={`w-28 h-28 rounded-full flex items-center justify-center border-4 shadow-2xl transition-all duration-300 relative z-10
                  ${isLocked
                    ? 'bg-white/5 border-white/10 opacity-50 cursor-not-allowed backdrop-blur-sm'
                    : `${lesson.color} border-white/40 cursor-pointer hover:scale-105 hover:brightness-110`
                  }
                  ${isUnlocked && !isLocked ? 'shadow-[0_0_30px_rgba(168,85,247,0.25)]' : ''}
                  ${isSelected ? 'ring-4 ring-primary ring-offset-4 ring-offset-transparent scale-110 shadow-[0_0_40px_rgba(168,85,247,0.5)]' : ''}
                `}
                onClick={() => {
                  if (!isLocked) setSelectedLesson(isSelected ? null : lesson);
                }}
                role={isLocked ? undefined : 'button'}
                tabIndex={isLocked ? -1 : 0}
                aria-label={isLocked ? `${lesson.title} — locked` : `Start ${lesson.title}`}
                onKeyDown={(e) => {
                  if (!isLocked && (e.key === 'Enter' || e.key === ' ')) {
                    setSelectedLesson(isSelected ? null : lesson);
                  }
                }}
              >
                {isLocked ? (
                  <Lock className="w-8 h-8 text-white/30" />
                ) : (
                  <span className="text-5xl">{lesson.icon}</span>
                )}

                {/* Stars below node */}
                {!isLocked && (
                  <div className="absolute -bottom-5 flex space-x-1">
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

              {/* Lesson label */}
              <p className={`mt-8 text-xs font-bold text-center tracking-wide ${isLocked ? 'text-white/20' : 'text-white/70'}`}>
                {lesson.title}
              </p>

              {/* Detail Bottom-Anchored Popup */}
              {isSelected && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
                    onClick={() => setSelectedLesson(null)}
                  />
                  {/* Bottom Sheet */}
                  <div className="fixed bottom-24 left-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
                    <GlassCard variant="elevated" className="p-5">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="text-lg font-bold text-white">{lesson.title}</h3>
                          <p className="text-sm text-muted-foreground mt-0.5">{lesson.description}</p>
                        </div>
                        <button
                          aria-label="Close"
                          onClick={() => setSelectedLesson(null)}
                          className="p-1.5 rounded-xl text-muted-foreground hover:bg-white/10 hover:text-white transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-1.5 mb-5">
                        {lesson.path.map((word, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] font-bold uppercase tracking-wider bg-primary/15 text-primary/90 border border-primary/20 px-2.5 py-1 rounded-full"
                          >
                            {word.word}
                          </span>
                        ))}
                      </div>

                      <Button
                        className="w-full rounded-2xl font-bold uppercase tracking-wider"
                        onClick={() => handleStartLesson(lesson)}
                      >
                        Start Lesson ✦
                      </Button>
                    </GlassCard>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* 3D Avatar Background (Decorative) */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-20 mix-blend-screen scale-110">
        <AvatarCanvas />
      </div>
    </>
  );
}


function LessonScreen() {
  const navigate = useNavigate();

  return (
    <div className="relative z-20 pt-4 animate-in slide-in-from-bottom-8 duration-500">
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 text-muted-foreground hover:text-foreground"
        onClick={() => navigate('/')}
      >
        ← Back to Map
      </Button>
      <LiveSession onEnd={() => navigate('/')} />
    </div>
  );
}


// --- Main App Shell ---

function AppContent() {
  const { streak, xp, gems, hasCompletedTour } = useUserStore();
  const { referenceSign, setReferenceSign, isLessonComplete, resetLesson, setAiPaused } = useLessonStore();
  const navigate = useNavigate();
  const location = useLocation();

  // Splash: show on fresh session (not on every tab reload after tour done)
  const [showSplash, setShowSplash] = useState(() => {
    if (typeof sessionStorage === 'undefined') return false;
    return !sessionStorage.getItem('ss_splash_shown');
  });
  const [showTour, setShowTour] = useState(false);

  const currentLevel = Math.floor(xp / 100) + 1;
  const isLessonRoute = location.pathname.startsWith('/lesson');
  const showBottomNav = !isLessonRoute;
  const isActive = (path: string) => location.pathname === path;

  // After splash completes, optionally show tour
  const handleSplashComplete = () => {
    sessionStorage.setItem('ss_splash_shown', '1');
    setShowSplash(false);
    if (!hasCompletedTour) {
      setShowTour(true);
    }
  };

  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  if (isLessonComplete) {
    return (
      <>
        {/* Keep cosmic background during VictoryModal */}
        <CosmicBackground />
        <VictoryModal
          onContinue={() => {
            resetLesson();
            navigate('/');
          }}
        />
      </>
    );
  }

  return (
    <div className="min-h-dvh text-foreground font-sans selection:bg-primary/40 selection:text-primary-foreground relative">
      <AudioHapticController />
      <ToastController />

      {/* Global Cosmic Background — rendered once for all screens */}
      <CosmicBackground />

      {/* Top Header — Mobile only (md: hidden because sidebar takes over) */}
      <header
        className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 bg-black/30 backdrop-blur-xl border-b border-white/5"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))', paddingBottom: '0.75rem' }}
        data-tour="header-stats"
      >
        {/* Left: level */}
        <div className="flex items-center gap-2">
          <Badge icon="⭐" value={`Lvl ${currentLevel}`} variant="xp" label={`Level ${currentLevel}`} />
        </div>

        {/* Right: Streak + Gems */}
        <div className="flex items-center gap-2">
          <Badge icon="🔥" value={streak} variant="streak" label={`${streak} day streak`} />
          <Badge icon="💎" value={gems} variant="gem" label={`${gems} gems`} />
        </div>
      </header>

      {/* Sidebar — tablet & desktop */}
      {!isLessonRoute && <Sidebar />}

      {/* Right Rail — desktop only */}
      {!isLessonRoute && <RightRail />}

      {/* Main Content — shifts right for sidebar on md+, shifts left for right rail on xl+ */}
      <main
        className={`
          pt-20 pb-28 md:pb-8
          md:pt-8
          ${isLessonRoute
            ? 'px-4 max-w-2xl mx-auto'
            : 'md:ml-56 lg:ml-64 xl:mr-72 px-0 md:px-6'
          }
          relative min-h-dvh flex flex-col
        `}
      >
        <Routes>
          <Route path="/" element={<MapScreen />} />
          <Route path="/decks" element={<DecksScreen />} />
          <Route path="/profile" element={<ProfileScreen />} />
          <Route path="/lesson/:lessonId" element={<LessonScreen />} />
        </Routes>
      </main>

      {/* Tour Overlay — shows once on first use */}
      {showTour && (
        <TourOverlay onComplete={() => setShowTour(false)} />
      )}

      {/* Bottom Navigation — mobile only */}
      {showBottomNav && (
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 bg-black/50 backdrop-blur-xl border-t border-white/8 flex justify-around items-center z-50 px-2"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))', paddingTop: '0.75rem' }}
          aria-label="Main navigation"
        >
          <NavTab
            icon={<Map className="w-6 h-6" />}
            label="Learn"
            active={isActive('/')}
            onClick={() => navigate('/')}
            tourId="nav-learn"
          />
          <NavTab
            icon={<Layers className="w-6 h-6" />}
            label="Decks"
            active={isActive('/decks')}
            onClick={() => navigate('/decks')}
            tourId="nav-decks"
          />
          <NavTab
            icon={<User className="w-6 h-6" />}
            label="Profile"
            active={isActive('/profile')}
            onClick={() => navigate('/profile')}
            tourId="nav-profile"
          />
        </nav>
      )}

      {/* Reference Sign Modal */}
      {referenceSign && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-label={`Reference sign: ${referenceSign.replace(/_/g, ' ')}`}
        >
          <div className="bg-[#1a1830] w-full max-w-sm rounded-3xl border border-white/10 overflow-hidden relative shadow-2xl">
            <div className="p-4 border-b border-white/8 flex justify-between items-center">
              <h3 className="font-bold text-foreground capitalize tracking-wide">
                {referenceSign.replace(/_/g, ' ')}
              </h3>
              <button
                aria-label="Close reference sign"
                onClick={() => { setReferenceSign(null); setAiPaused(false); }}
                className="p-2 rounded-xl text-muted-foreground hover:bg-white/10 hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
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

/** Bottom nav tab — icon + label with active state */
function NavTab({
  icon,
  label,
  active,
  onClick,
  tourId,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  tourId?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      data-tour={tourId}
      className={`flex flex-col items-center gap-1 px-5 py-1 rounded-2xl transition-all duration-200
        ${active
          ? 'text-primary bg-primary/15 border border-primary/25'
          : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
        }
      `}
    >
      {icon}
      <span className="text-[10px] font-bold tracking-wide uppercase">{label}</span>
    </button>
  );
}

/** Global cosmic gradient background — rendered once, shared by all screens */
function CosmicBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-[#0A0A0F]" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0f0c29] via-[#302b63] to-[#24243e] opacity-90" />
      <div
        className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] animate-pulse"
        style={{ animationDuration: '8s' }}
      />
      <div
        className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-indigo-500/10 rounded-full blur-[100px] animate-pulse"
        style={{ animationDuration: '12s' }}
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-violet-500/8 rounded-full blur-[80px] animate-pulse"
        style={{ animationDuration: '10s' }}
      />
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
