import React, { useState, useEffect } from 'react';
import { Router } from './router';
import { initializeDatabase } from './core/db/migrations';
import { seedInitialDataIfEmpty } from './core/db/seedData';
import { useSettingsStore, applyAppTheme } from './store/useSettingsStore';
import { useHabitStore } from './store/useHabitStore';
import { NotificationService } from './core/services/notificationService';

export const App: React.FC = () => {
  const [isDbReady, setIsDbReady] = useState<boolean>(false);

  useEffect(() => {
    let resumeListener: any = null;

    async function init() {
      try {
        const currentTheme = useSettingsStore.getState().theme;
        applyAppTheme(currentTheme);
        await initializeDatabase();
        await seedInitialDataIfEmpty();
        await useHabitStore.getState().loadHabits();
        await NotificationService.processPendingActions();
        await NotificationService.initializeChannels();
        const chatStyle = useSettingsStore.getState().chatStyleNotificationEnabled;
        await NotificationService.setChatStyleNotification(chatStyle !== false);
        await NotificationService.rescheduleAllReminders();
      } catch (err) {
        console.error('Failed to initialize database:', err);
      } finally {
        setIsDbReady(true);
      }
    }

    async function setupResumeListener() {
      try {
        const { App: CapApp } = await import('@capacitor/app');
        resumeListener = await CapApp.addListener('resume', async () => {
          console.log('[App] Resumed from background — processing actions and checking reminders');
          try {
            await NotificationService.processPendingActions();
            await NotificationService.rescheduleAllReminders();
          } catch (err) {
            console.warn('[App] Error during resume sync:', err);
          }
        });
      } catch {
        // Not on native — no-op
      }
    }

    init();
    setupResumeListener();

    return () => {
      resumeListener?.remove?.();
    };
  }, []);

  if (!isDbReady) {
    return (
      <div className="min-h-screen bg-space-950 flex flex-col items-center justify-center text-[var(--text-muted)] gap-3">
        <div className="w-10 h-10 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono tracking-wider uppercase text-[var(--text-dim)]">
          Initializing OrbitHabit...
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-space-950 text-[var(--text-main)] flex flex-col font-sans transition-colors duration-200">
      <Router />
    </div>
  );
};

export default App;
