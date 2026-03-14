import { useNavigate, useLocation } from 'react-router-dom';
import { Map, Layers, User } from 'lucide-react';
import { useUserStore } from '../../stores/useUserStore';
import { ProgressBar } from './ProgressBar';
import { Badge } from './Badge';
import { cn } from '../lib/cn';

interface NavItem {
  icon: React.ReactNode;
  label: string;
  path: string;
  tourId?: string;
}

const NAV_ITEMS: NavItem[] = [
  { icon: <Map className="w-5 h-5" />, label: 'Learn', path: '/', tourId: 'nav-learn' },
  { icon: <Layers className="w-5 h-5" />, label: 'Decks', path: '/decks', tourId: 'nav-decks' },
  { icon: <User className="w-5 h-5" />, label: 'Profile', path: '/profile', tourId: 'nav-profile' },
];

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { xp, streak, gems } = useUserStore();

  const currentLevel = Math.floor(xp / 100) + 1;
  const xpProgress = xp % 100;

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  return (
    <aside
      className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-56 lg:w-64 z-40"
      aria-label="Main navigation"
    >
      {/* Glass background */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-xl border-r border-white/8" />

      <div className="relative z-10 flex flex-col h-full px-3 py-6 gap-3">
        {/* App Branding */}
        <div className="px-3 mb-4 flex items-center gap-3">
          <img
            src="/mascot/idle.png"
            alt="SignSensei mascot"
            className="w-10 h-10 object-contain drop-shadow-[0_4px_12px_rgba(168,85,247,0.5)]"
          />
          <div>
            <h1 className="text-base font-black text-white tracking-tight leading-none">
              SignSensei
            </h1>
            <p className="text-[10px] text-muted-foreground font-medium tracking-wide mt-0.5">
              Learn ASL with AI
            </p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex flex-col gap-1" role="navigation">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                data-tour={item.tourId}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-200 w-full text-left',
                  active
                    ? 'bg-primary/20 text-primary border border-primary/30 shadow-[0_0_12px_rgba(168,85,247,0.2)]'
                    : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                )}
              >
                <span className={cn('transition-transform duration-200', active && 'scale-110')}>
                  {item.icon}
                </span>
                {item.label}
                {active && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_6px] shadow-primary" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Stats panel at bottom */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
          <div className="flex gap-2 flex-wrap">
            <Badge icon="🔥" value={streak} variant="streak" label={`${streak} day streak`} className="text-xs px-2 py-1" />
            <Badge icon="💎" value={gems} variant="gem" label={`${gems} gems`} className="text-xs px-2 py-1" />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] font-bold text-muted-foreground">
              <span>Level {currentLevel}</span>
              <span className="text-primary">{xpProgress}/100 XP</span>
            </div>
            <ProgressBar value={xpProgress} max={100} size="sm" label="Level XP progress" />
          </div>
        </div>
      </div>
    </aside>
  );
}
