import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

export type ThemeMode = 'dark-space' | 'amoled' | 'cyber-light';

export const applyAppTheme = async (theme: ThemeMode) => {
  if (typeof document === 'undefined') return;

  const normalizedTheme: ThemeMode =
    theme === 'amoled' ? 'amoled' :
    theme === 'cyber-light' || (theme as any) === 'light' ? 'cyber-light' : 'dark-space';

  document.documentElement.setAttribute('data-theme', normalizedTheme);

  if (normalizedTheme === 'cyber-light') {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
  } else {
    document.documentElement.classList.remove('light');
    document.documentElement.classList.add('dark');
  }

  // Update native Android StatusBar
  if (Capacitor.isNativePlatform()) {
    try {
      if (normalizedTheme === 'cyber-light') {
        await StatusBar.setStyle({ style: Style.Light });
        await StatusBar.setBackgroundColor({ color: '#f1f5f9' });
      } else if (normalizedTheme === 'amoled') {
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#000000' });
      } else {
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#050814' });
      }
    } catch (err) {
      console.warn('Native status bar update skipped:', err);
    }
  }
};

interface SettingsState {
  theme: ThemeMode;
  hapticsEnabled: boolean;
  soundEnabled: boolean;
  pinLockEnabled: boolean;
  pinCode: string;
  isUnlocked: boolean;
  currency: string;
  // Profile & Onboarding
  userName: string;
  userAge: string;
  userFocus: string;
  onboardingCompleted: boolean;

  setTheme: (theme: ThemeMode) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setPinLock: (enabled: boolean, pin?: string) => void;
  unlockWithPin: (pin: string) => boolean;
  setCurrency: (currency: string) => void;
  setProfile: (profile: { name?: string; age?: string; focus?: string }) => void;
  setOnboardingCompleted: (completed: boolean) => void;
  resetAllSettings: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      theme: 'dark-space',
      hapticsEnabled: true,
      soundEnabled: true,
      pinLockEnabled: false,
      pinCode: '1234',
      isUnlocked: true,
      currency: 'INR',
      userName: 'Orbit Traveler',
      userAge: '',
      userFocus: 'Productivity & Fitness',
      onboardingCompleted: false,

      setTheme: (theme) => {
        set({ theme });
        applyAppTheme(theme);
      },
      setHapticsEnabled: async (hapticsEnabled) => {
        set({ hapticsEnabled });
        if (hapticsEnabled) {
          try {
            await Haptics.impact({ style: ImpactStyle.Light });
          } catch {}
        }
      },
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setPinLock: (enabled, pin = '1234') =>
        set({ pinLockEnabled: enabled, pinCode: pin, isUnlocked: !enabled }),
      unlockWithPin: (pin) => {
        if (pin === get().pinCode) {
          set({ isUnlocked: true });
          return true;
        }
        return false;
      },
      setCurrency: (currency) => set({ currency }),
      setProfile: (profile) =>
        set((state) => ({
          userName: profile.name !== undefined ? profile.name : state.userName,
          userAge: profile.age !== undefined ? profile.age : state.userAge,
          userFocus: profile.focus !== undefined ? profile.focus : state.userFocus
        })),
      setOnboardingCompleted: (completed) => set({ onboardingCompleted: completed }),
      resetAllSettings: () => {
        set({
          theme: 'dark-space',
          hapticsEnabled: true,
          soundEnabled: true,
          pinLockEnabled: false,
          pinCode: '1234',
          isUnlocked: true,
          currency: 'INR',
          userName: 'Orbit Traveler',
          userAge: '',
          userFocus: 'Productivity & Fitness',
          onboardingCompleted: false
        });
        applyAppTheme('dark-space');
      }
    }),
    {
      name: 'orbithabit_settings',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (state?.theme) {
          applyAppTheme(state.theme);
        }
      },
      migrate: (persistedState: any) => {
        if (persistedState) {
          // Normalize legacy theme names
          if (persistedState.theme === 'dark' || !persistedState.theme) {
            persistedState.theme = 'dark-space';
          } else if (persistedState.theme === 'light') {
            persistedState.theme = 'cyber-light';
          }
          // Remove deleted quality3D property
          if ('quality3D' in persistedState) {
            delete persistedState.quality3D;
          }
        }
        return persistedState;
      }
    }
  )
);
