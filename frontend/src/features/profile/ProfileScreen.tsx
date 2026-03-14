import { useUserStore } from '../../stores/useUserStore';
import { GlassCard } from '../../shared/ui/GlassCard';
import { ProgressBar } from '../../shared/ui/ProgressBar';
import { Mascot } from '../../shared/ui/Mascot';
import { Button } from '../../shared/ui/Button';
import { LESSONS } from '../../data/curriculum';
import { useNavigate } from 'react-router-dom';
import { Star, Flame, Gem, BookOpen, Target, TrendingUp, RotateCcw } from 'lucide-react';


export function ProfileScreen() {
  const { xp, streak, gems, lessonScores, weakWords, lessonHistory } = useUserStore();
  const navigate = useNavigate();

  const currentLevel = Math.floor(xp / 100) + 1;
  const xpProgress = xp % 100;
  const totalLessons = LESSONS.length;
  const completedLessons = Object.keys(lessonScores).length;
  const threeStarLessons = Object.values(lessonScores).filter(s => s === 3).length;

  // Top 3 weak words
  const weakWordsList = Object.entries(weakWords)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([word, count]) => ({ word, count }));

  // Recent lesson history (5 items)
  const recentHistory = lessonHistory.slice(0, 5);

  return (
    <div className="relative z-20 pb-20 md:pb-8 animate-in fade-in duration-500">
      <div className="px-4 pt-6 md:pt-2 pb-2 space-y-5">

        {/* Profile Header */}
        <div className="flex items-center gap-4">
          <Mascot emotion="wave" size={80} showMessage={false} />
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black text-white">Your Profile</h1>
            <p className="text-sm text-muted-foreground">Keep signing, keep growing! 🌟</p>
          </div>
        </div>

        {/* Level Card */}
        <GlassCard variant="elevated" className="overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-primary via-secondary to-accent" />
          <div className="p-5 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                Level {currentLevel}
              </span>
              <span className="text-xs font-bold text-primary">{xpProgress}/100 XP</span>
            </div>
            <ProgressBar value={xpProgress} max={100} size="lg" label="Level XP progress" />
            <p className="text-xs text-muted-foreground text-center">
              {100 - xpProgress} XP until Level {currentLevel + 1}
            </p>
          </div>
        </GlassCard>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={<Flame className="w-5 h-5 text-orange-400" />}
            label="Day Streak"
            value={`${streak}`}
            subtext="days in a row"
            color="orange"
          />
          <StatCard
            icon={<Gem className="w-5 h-5 text-blue-400" />}
            label="Gems"
            value={`${gems}`}
            subtext="earned"
            color="blue"
          />
          <StatCard
            icon={<BookOpen className="w-5 h-5 text-purple-400" />}
            label="Lessons Done"
            value={`${completedLessons}/${totalLessons}`}
            subtext={`${Math.round((completedLessons / Math.max(totalLessons, 1)) * 100)}% complete`}
            color="purple"
          />
          <StatCard
            icon={<Star className="w-5 h-5 text-yellow-400" />}
            label="Perfect Scores"
            value={`${threeStarLessons}`}
            subtext="3-star lessons"
            color="yellow"
          />
        </div>

        {/* Weak Words */}
        {weakWordsList.length > 0 && (
          <GlassCard>
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-red-400" />
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Words to Practice</h2>
              </div>
              <div className="space-y-2">
                {weakWordsList.map(({ word, count }) => (
                  <div key={word} className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground capitalize">{word}</span>
                    <div className="flex items-center gap-2">
                      <ProgressBar
                        value={Math.min(count * 10, 100)}
                        max={100}
                        size="sm"
                        label={`${word} difficulty`}
                        color="var(--destructive)"
                        className="w-20"
                      />
                      <span className="text-xs text-muted-foreground w-12 text-right">{count}x missed</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
        )}

        {/* Recent Activity */}
        {recentHistory.length > 0 && (
          <GlassCard>
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Recent Activity</h2>
              </div>
              <div className="space-y-2">
                {recentHistory.map((entry, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground capitalize">
                        {entry.lessonId.replace(/-/g, ' ')}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(entry.completedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex">
                      {[1, 2, 3].map((star) => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${star <= entry.score ? 'text-yellow-400 fill-yellow-400' : 'text-white/10'}`}
                          strokeWidth={1.5}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
        )}

        {/* Replay Tour */}
        <GlassCard>
          <div className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-foreground">App Tour</p>
              <p className="text-xs text-muted-foreground">New to SignSensei? Take the tour again!</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => {
                useUserStore.setState({ hasCompletedTour: false });
                navigate('/');
              }}
            >
              <RotateCcw className="w-4 h-4 mr-1.5" />
              Replay
            </Button>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  subtext,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext: string;
  color: 'orange' | 'blue' | 'purple' | 'yellow';
}) {
  const colorMap = {
    orange: 'bg-orange-500/10 border-orange-500/20',
    blue: 'bg-blue-500/10 border-blue-500/20',
    purple: 'bg-purple-500/10 border-purple-500/20',
    yellow: 'bg-yellow-500/10 border-yellow-500/20',
  };
  return (
    <div className={`rounded-2xl border p-4 flex flex-col gap-2 ${colorMap[color]}`}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-black text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{subtext}</p>
    </div>
  );
}
