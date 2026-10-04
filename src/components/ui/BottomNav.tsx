import React from 'react';
import { Home, CheckSquare, Calendar, Wallet, User } from 'lucide-react';
import { motion } from 'framer-motion';

export type NavTab = 'home' | 'habits' | 'calendar' | 'money' | 'settings';

interface BottomNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'home', label: 'Today', icon: Home },
    { id: 'habits', label: 'Habits', icon: CheckSquare },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'money', label: 'Money', icon: Wallet },
    { id: 'settings', label: 'Profile', icon: User }
  ] as const;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-2 pointer-events-none">
      <div className="max-w-md mx-auto pointer-events-auto">
        <div
          style={{
            backgroundColor: 'var(--nav-bg)',
            borderColor: 'var(--border-subtle)'
          }}
          className="flex items-center justify-around rounded-3xl backdrop-blur-2xl border p-1.5 shadow-[0_-8px_32px_rgba(0,0,0,0.25)] transition-colors duration-200"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id as NavTab)}
                className="relative flex flex-col items-center justify-center flex-1 py-2 px-1 rounded-2xl min-h-[50px] transition-colors duration-200 cursor-pointer"
              >
                {isActive && (
                  <motion.div
                    layoutId="active-nav-glow"
                    className="absolute inset-0 bg-gradient-to-t from-neon-cyan/20 to-neon-purple/10 rounded-2xl border border-neon-cyan/40"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                <Icon
                  className={`w-5 h-5 transition-transform duration-200 z-10 ${
                    isActive
                      ? 'text-neon-cyan scale-110 drop-shadow-[0_0_8px_var(--accent-cyan)]'
                      : 'text-[var(--text-dim)] hover:text-[var(--text-muted)]'
                  }`}
                />
                <span
                  className={`text-[10px] font-medium mt-1 z-10 transition-colors ${
                    isActive ? 'text-[var(--text-main)] font-semibold' : 'text-[var(--text-dim)]'
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
