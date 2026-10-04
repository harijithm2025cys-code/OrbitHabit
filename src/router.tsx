import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NavTab, BottomNav } from './components/ui/BottomNav';
import { ToastContainer, ToastMessage } from './components/ui/Toast';
import { useHabitStore } from './store/useHabitStore';
import { useSettingsStore } from './store/useSettingsStore';
import { HomePage } from './pages/HomePage';
import { HabitDetailPage } from './pages/HabitDetailPage';
import { AddEditHabitPage } from './pages/AddEditHabitPage';
import { TimerRunPage } from './pages/TimerRunPage';
import { GpsRunPage } from './pages/GpsRunPage';
import { RemindersPage } from './pages/RemindersPage';
import { CalendarHubPage } from './pages/CalendarHubPage';
import { MoneyPage } from './pages/MoneyPage';
import { AddTransactionPage } from './pages/AddTransactionPage';
import { SettingsPage } from './pages/SettingsPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { NotificationService } from './core/services/notificationService';
import { generateId } from './core/utils/id';

export interface RouteState {
  currentRoute: string;
  params?: Record<string, string>;
}

export const Router: React.FC = () => {
  const [route, setRoute] = useState<RouteState>({ currentRoute: 'home' });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const { habits, createHabit, updateHabit } = useHabitStore();
  const { onboardingCompleted } = useSettingsStore();

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    const newToast: ToastMessage = {
      id: generateId('toast'),
      type,
      message
    };
    setToasts((prev) => [...prev.slice(-3), newToast]);
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const navigate = (newRoute: string, params?: Record<string, string>) => {
    setRoute({ currentRoute: newRoute, params });
  };

  const handleTabChange = (tab: NavTab) => {
    navigate(tab);
  };

  const getActiveTab = (): NavTab => {
    if (['home', 'habits', 'calendar', 'money', 'settings'].includes(route.currentRoute)) {
      return route.currentRoute as NavTab;
    }
    if (['stats', 'activity'].includes(route.currentRoute)) {
      return 'calendar';
    }
    return 'home';
  };

  useEffect(() => {
    let resumeSub: any = null;

    async function checkDeepLink() {
      try {
        const habitId = await NotificationService.getNotificationLaunchHabitId();
        if (habitId) {
          console.log('[Router] Deep link launch to habit:', habitId);
          navigate('habit-detail', { id: habitId });
        }
      } catch (err) {
        console.warn('[Router] Failed to check launch habit id:', err);
      }
    }

    checkDeepLink();

    import('@capacitor/app')
      .then(({ App: CapApp }) => {
        CapApp.addListener('resume', () => {
          checkDeepLink();
        }).then((sub) => {
          resumeSub = sub;
        });
      })
      .catch(() => {});

    return () => {
      resumeSub?.remove?.();
    };
  }, []);

  // If onboarding is not completed yet, show Onboarding Flow (F1)
  if (!onboardingCompleted && route.currentRoute !== 'onboarding') {
    return (
      <div className="min-h-screen bg-space-950 text-[var(--text-main)] flex flex-col font-sans transition-colors duration-200">
        <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
        <OnboardingPage
          onComplete={(action) => {
            if (action === 'create-habit') {
              navigate('add-habit');
            } else {
              navigate('home');
            }
          }}
        />
      </div>
    );
  }

  const renderContent = () => {
    switch (route.currentRoute) {
      case 'onboarding':
        return (
          <OnboardingPage
            onComplete={(action) => {
              if (action === 'create-habit') {
                navigate('add-habit');
              } else {
                navigate('home');
              }
            }}
          />
        );
      case 'home':
        return <HomePage onNavigate={navigate} />;
      case 'habits':
        return <HomePage onNavigate={navigate} />;
      case 'habit-detail':
        return (
          <HabitDetailPage
            habitId={route.params?.id}
            onBack={() => navigate('home')}
            onNavigate={navigate}
            onShowToast={showToast}
          />
        );
      case 'add-habit':
        return (
          <AddEditHabitPage
            onBack={() => navigate('home')}
            onSave={async (habitData) => {
              // habitData now includes a pre-generated id from AddEditHabitPage
              await createHabit(habitData);
            }}
            onShowToast={showToast}
          />
        );
      case 'edit-habit': {
        const habitToEdit = habits.find((h) => h.id === route.params?.id) || null;
        return (
          <AddEditHabitPage
            initialData={habitToEdit}
            onBack={() => navigate('habit-detail', { id: route.params?.id || '' })}
            onSave={async (habitData) => {
              if (route.params?.id) {
                const merged = {
                  ...(habitToEdit || {}),
                  ...habitData,
                  id: route.params.id,
                  created_at: habitToEdit?.created_at || Date.now(),
                  archived: habitToEdit?.archived || 0
                };
                const { today_progress, today_completed, streak_current, streak_best, ...cleanHabit } = merged;
                await updateHabit(cleanHabit);
              }
            }}
            onShowToast={showToast}
          />
        );
      }
      case 'timer-run':
        return (
          <TimerRunPage
            habitId={route.params?.id}
            onBack={() => navigate('home')}
            onShowToast={showToast}
          />
        );
      case 'gps-run':
        return (
          <GpsRunPage
            habitId={route.params?.id}
            onBack={() => navigate('home')}
            onShowToast={showToast}
          />
        );
      case 'reminders':
        return (
          <RemindersPage
            onBack={() => navigate('settings')}
            onShowToast={showToast}
          />
        );
      case 'calendar':
        return (
          <CalendarHubPage
            initialTab="calendar"
            onNavigate={navigate}
            onShowToast={showToast}
          />
        );
      case 'stats':
        return (
          <CalendarHubPage
            initialTab="stats"
            onNavigate={navigate}
            onShowToast={showToast}
          />
        );
      case 'activity':
        return (
          <CalendarHubPage
            initialTab="activity"
            onNavigate={navigate}
            onShowToast={showToast}
          />
        );
      case 'money':
        return (
          <MoneyPage
            onNavigate={navigate}
            onShowToast={showToast}
          />
        );
      case 'add-transaction':
        return (
          <AddTransactionPage
            onBack={() => navigate('money')}
            onShowToast={showToast}
          />
        );
      case 'settings':
        return (
          <SettingsPage
            onNavigate={navigate}
            onShowToast={showToast}
          />
        );
      default:
        return <HomePage onNavigate={navigate} />;
    }
  };

  // Hide bottom nav in create/edit forms, focus sessions (Timer & GPS), Reminders, and Onboarding
  const isFullScreenMode = [
    'timer-run',
    'gps-run',
    'onboarding',
    'add-habit',
    'edit-habit',
    'add-transaction',
    'reminders'
  ].includes(route.currentRoute);

  return (
    <div className="relative min-h-screen bg-space-950 text-[var(--text-main)] flex flex-col justify-between font-sans transition-colors duration-200">
      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
      <main className="flex-1 w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={route.currentRoute}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="w-full min-h-full"
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      {!isFullScreenMode && (
        <BottomNav activeTab={getActiveTab()} onTabChange={handleTabChange} />
      )}
    </div>
  );
};
