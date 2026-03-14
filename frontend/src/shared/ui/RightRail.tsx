import { useUserStore } from '../../stores/useUserStore';
import { ProgressBar } from './ProgressBar';
import { Mascot } from './Mascot';
import { LESSONS } from '../../data/curriculum';

export function RightRail() {
  const { xp, streak, gems, unlockedLessonIds } = useUserStore();

  const currentLevel = Math.floor(xp / 100) + 1;
  const xpProgress = xp % 100;
  const lessonsCompleted = unlockedLessonIds.length;
  const totalLessons = LESSONS.length;

  const tips = [
    'ASL uses handshape, movement, and location to form each sign.',
    'Non-manual markers (facial expressions) are grammatically required in ASL.',
    'ASL has its own grammar — it is not English in hand form.',
    'Fingerspelling is used for proper nouns and words without a sign.',
    'Signing space is the area in front of your body. Use it consistently.',
  ];
  const dailyTip = tips[new Date().getDate() % tips.length];

  return (
    <aside
      className="hidden xl:flex flex-col fixed right-0 top-0 bottom-0 w-72 z-40"
      aria-label="Stats and tips"
    >
      {/* Glass background */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-xl border-l border-white/8" />

      <div className="relative z-10 flex flex-col h-full px-4 py-6 gap-4 overflow-y-auto">

        {/* Mascot idle float */}
        <div className="flex justify-center py-2">
          <Mascot emotion="wave" size={120} showMessage={true} message="Ready to sign? 🤟" />
        </div>

        {/* Level & XP */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-foreground">Level {currentLevel}</span>
            <span className="text-xs font-semibold text-primary">{xpProgress}/100 XP</span>
          </div>
          <ProgressBar value={xpProgress} max={100} size="md" label="Level XP" />
          <p className="text-[10px] text-muted-foreground">{100 - xpProgress} XP until Level {currentLevel + 1}</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2">
          <StatTile emoji="🔥" label="Streak" value={`${streak}d`} color="orange" />
          <StatTile emoji="💎" label="Gems" value={String(gems)} color="blue" />
          <StatTile emoji="📚" label="Lessons" value={`${lessonsCompleted}/${totalLessons}`} color="purple" />
        </div>

        {/* Daily Tip */}
        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">💡 ASL Tip of the Day</p>
          <p className="text-xs text-foreground/80 leading-relaxed">{dailyTip}</p>
        </div>

        {/* Progress overview */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Curriculum Progress</p>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-medium text-foreground">
              <span>{lessonsCompleted} of {totalLessons} lessons</span>
              <span className="text-primary">{Math.round((lessonsCompleted / Math.max(totalLessons, 1)) * 100)}%</span>
            </div>
            <ProgressBar
              value={lessonsCompleted}
              max={totalLessons}
              size="md"
              label="Curriculum completion"
              color="var(--success)"
            />
          </div>
        </div>
      </div>
    </aside>
  );
}

function StatTile({
  emoji,
  label,
  value,
  color,
}: {
  emoji: string;
  label: string;
  value: string;
  color: 'orange' | 'blue' | 'purple';
}) {
  const colorMap = {
    orange: 'bg-orange-500/10 border-orange-500/20 text-orange-300',
    blue: 'bg-blue-500/10 border-blue-500/20 text-blue-300',
    purple: 'bg-purple-500/10 border-purple-500/20 text-purple-300',
  };
  return (
    <div className={`flex flex-col items-center gap-1 rounded-2xl border p-3 ${colorMap[color]}`}>
      <span className="text-xl">{emoji}</span>
      <span className="text-sm font-black">{value}</span>
      <span className="text-[9px] font-bold uppercase tracking-wider opacity-70">{label}</span>
    </div>
  );
}
