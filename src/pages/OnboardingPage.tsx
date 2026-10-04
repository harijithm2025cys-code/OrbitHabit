import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Bell,
  ArrowRight,
  Check,
  User,
  Target,
  Navigation,
  ShieldCheck,
  BatteryCharging
} from 'lucide-react';
import { Geolocation } from '@capacitor/geolocation';
import logoImg from '../assets/logo.png';
import { GlassCard } from '../components/ui/GlassCard';
import { NeonButton } from '../components/ui/NeonButton';
import { useSettingsStore } from '../store/useSettingsStore';
import { NotificationService } from '../core/services/notificationService';

interface OnboardingPageProps {
  onComplete: (action?: 'create-habit' | 'home') => void;
}

export const OnboardingPage: React.FC<OnboardingPageProps> = ({ onComplete }) => {
  const [step, setStep] = useState<number>(1);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [focus, setFocus] = useState('Productivity & Fitness');
  const [nameError, setNameError] = useState('');

  // Location setup state for Step 4
  const [locGranted, setLocGranted] = useState(false);
  const [bgLocGranted, setBgLocGranted] = useState(false);

  const { setProfile, setOnboardingCompleted } = useSettingsStore();

  const handleStep2Next = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError('Please enter your name');
      return;
    }
    setNameError('');
    setProfile({ name: name.trim(), age: age.trim(), focus });
    setStep(3);
  };

  const handleAllowNotifications = async () => {
    await NotificationService.requestPermissions();
    setStep(4);
  };

  const handleSetupLocation = async () => {
    try {
      const geoPerm = await Geolocation.requestPermissions();
      if (geoPerm.location === 'granted') {
        setLocGranted(true);
      }
      const details = await NotificationService.checkLocationPermissionsDetail();
      if (details.backgroundLocationGranted) {
        setBgLocGranted(true);
      }
    } catch {}
  };

  const handleOpenBackgroundLocationSettings = async () => {
    await NotificationService.openAppSettings();
  };

  const handleIgnoreBattery = async () => {
    await NotificationService.requestIgnoreBatteryOptimization();
  };

  // Check permissions when user returns to app in Step 4
  useEffect(() => {
    if (step === 4) {
      const check = async () => {
        const details = await NotificationService.checkLocationPermissionsDetail();
        setLocGranted(details.fineLocationGranted);
        setBgLocGranted(details.backgroundLocationGranted);
      };
      check();
    }
  }, [step]);

  const handleFinish = (action: 'create-habit' | 'home') => {
    setOnboardingCompleted(true);
    onComplete(action);
  };

  const FOCUS_OPTIONS = [
    'Productivity & Fitness',
    'Mental Wellness & Mind',
    'Financial Growth',
    'Study & Reading',
    'Health & Nutrition'
  ];

  return (
    <div className="min-h-screen bg-space-950 text-slate-100 flex flex-col justify-between p-6 max-w-md mx-auto relative overflow-hidden">
      {/* Background Neon Orbs */}
      <div className="absolute -top-24 -left-24 w-72 h-72 bg-neon-cyan/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-neon-purple/20 rounded-full blur-3xl pointer-events-none" />

      {/* Progress Bars (5 steps) */}
      <div className="flex gap-2 w-full pt-4 relative z-10">
        {[1, 2, 3, 4, 5].map((s) => (
          <div
            key={s}
            className="flex-1 h-1.5 rounded-full bg-space-800 overflow-hidden"
          >
            <motion.div
              initial={false}
              animate={{ width: step >= s ? '100%' : '0%' }}
              transition={{ duration: 0.3 }}
              className="h-full bg-gradient-to-r from-neon-cyan to-neon-purple"
            />
          </div>
        ))}
      </div>

      {/* Content Area with Step Transitions */}
      <div className="flex-1 flex flex-col justify-center my-6 relative z-10">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6 text-center"
            >
              <div className="w-24 h-24 mx-auto rounded-3xl overflow-hidden shadow-[0_0_35px_rgba(0,240,255,0.4)] border border-neon-cyan/40 p-1 bg-black/40">
                <img src={logoImg} alt="OrbitHabit Logo" className="w-full h-full object-cover rounded-2xl" />
              </div>

              <div className="space-y-2">
                <span className="text-xs font-mono uppercase tracking-widest text-neon-cyan">
                  Welcome to OrbitHabit
                </span>
                <h1 className="text-3xl font-extrabold text-white tracking-tight">
                  Master Your Habits in 3D Space
                </h1>
                <p className="text-sm text-slate-400 leading-relaxed max-w-xs mx-auto">
                  A 100% offline, privacy-first habit & finance tracker designed to transform daily consistency.
                </p>
              </div>

              <div className="pt-6">
                <NeonButton
                  variant="primary"
                  size="lg"
                  className="w-full font-bold shadow-[0_0_20px_rgba(0,240,255,0.4)]"
                  onClick={() => setStep(2)}
                >
                  Get Started <ArrowRight className="w-5 h-5 ml-2" />
                </NeonButton>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.form
              key="step-2"
              onSubmit={handleStep2Next}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              <div className="text-center space-y-1">
                <span className="text-xs font-mono uppercase tracking-widest text-neon-purple">
                  Step 2 of 5
                </span>
                <h2 className="text-2xl font-bold text-white">Tell us about yourself</h2>
                <p className="text-xs text-slate-400">
                  Personalize your dashboard greeting and primary goal.
                </p>
              </div>

              <GlassCard className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-neon-cyan" />
                    Your Name <span className="text-neon-cyan">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (nameError) setNameError('');
                    }}
                    placeholder="e.g. Alex Hunter"
                    className="w-full bg-space-900/90 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-neon-cyan"
                  />
                  {nameError && (
                    <p className="text-xs text-rose-400 font-medium">{nameError}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">
                    Age (Optional)
                  </label>
                  <input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="e.g. 25"
                    className="w-full bg-space-900/90 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-neon-cyan"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-neon-purple" />
                    Primary Focus
                  </label>
                  <select
                    value={focus}
                    onChange={(e) => setFocus(e.target.value)}
                    className="w-full bg-space-900/90 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-neon-purple"
                  >
                    {FOCUS_OPTIONS.map((f) => (
                      <option key={f} value={f} className="bg-space-900 text-white">
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
              </GlassCard>

              <NeonButton
                type="submit"
                variant="primary"
                size="lg"
                className="w-full font-bold"
              >
                Continue <ArrowRight className="w-5 h-5 ml-2" />
              </NeonButton>
            </motion.form>
          )}

          {step === 3 && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6 text-center"
            >
              <div className="w-20 h-20 mx-auto rounded-3xl bg-neon-cyan/10 border border-neon-cyan/30 flex items-center justify-center shadow-[0_0_24px_rgba(0,240,255,0.2)]">
                <Bell className="w-10 h-10 text-neon-cyan animate-bounce" />
              </div>

              <div className="space-y-2">
                <span className="text-xs font-mono uppercase tracking-widest text-neon-cyan">
                  Step 3 of 5
                </span>
                <h2 className="text-2xl font-bold text-white">Stay on Track</h2>
                <p className="text-sm text-slate-400 leading-relaxed max-w-xs mx-auto">
                  Enable high-priority exact alarms so your habit reminders ring reliably even when your phone is locked or offline.
                </p>
              </div>

              <GlassCard className="p-4 text-left space-y-2 border-neon-cyan/20">
                <div className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-neon-emerald shrink-0 mt-0.5" />
                  <span className="text-xs text-slate-300">
                    Exact alarms ring at the precise scheduled minute.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-neon-emerald shrink-0 mt-0.5" />
                  <span className="text-xs text-slate-300">
                    100% offline — no cloud sync, no tracking, zero battery drain.
                  </span>
                </div>
              </GlassCard>

              <div className="space-y-3 pt-2">
                <NeonButton
                  variant="primary"
                  size="lg"
                  className="w-full font-bold"
                  onClick={handleAllowNotifications}
                >
                  Allow Notifications
                </NeonButton>
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="w-full text-xs text-slate-400 hover:text-white py-2 transition"
                >
                  Not Now
                </button>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step-4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5 text-center"
            >
              <div className="w-20 h-20 mx-auto rounded-3xl bg-neon-purple/10 border border-neon-purple/30 flex items-center justify-center shadow-[0_0_24px_rgba(139,92,246,0.3)]">
                <Navigation className="w-10 h-10 text-neon-purple animate-pulse" />
              </div>

              <div className="space-y-1">
                <span className="text-xs font-mono uppercase tracking-widest text-neon-purple">
                  Step 4 of 5
                </span>
                <h2 className="text-2xl font-bold text-white">Outdoor GPS & Runs</h2>
                <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
                  To count your kilometers accurately while your phone screen is off, OrbitHabit needs location access.
                </p>
              </div>

              <GlassCard className="p-4 text-left space-y-3 border-neon-purple/20">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-neon-emerald shrink-0 mt-0.5" />
                  <span className="text-xs text-slate-300">
                    <strong>100% On-Device:</strong> Your GPS coordinates never leave your phone.
                  </span>
                </div>

                <div className="space-y-2 pt-1 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-300">Precise Location:</span>
                    {locGranted ? (
                      <span className="text-xs text-neon-emerald font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Granted
                      </span>
                    ) : (
                      <button
                        onClick={handleSetupLocation}
                        className="px-2.5 py-1 rounded-lg bg-neon-cyan text-space-950 font-bold text-xs"
                      >
                        Grant Precise
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-300">Background Tracking:</span>
                      <span className="text-[10px] text-slate-400">Location → Allow all the time</span>
                    </div>
                    {bgLocGranted ? (
                      <span className="text-xs text-neon-emerald font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> All the time
                      </span>
                    ) : (
                      <button
                        onClick={handleOpenBackgroundLocationSettings}
                        className="px-2.5 py-1 rounded-lg bg-neon-purple text-white font-bold text-xs"
                      >
                        Allow All Time
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-slate-300 flex items-center gap-1">
                      <BatteryCharging className="w-3.5 h-3.5 text-amber-400" /> Battery Optimization
                    </span>
                    <button
                      onClick={handleIgnoreBattery}
                      className="px-2.5 py-1 rounded-lg bg-space-800 border border-white/10 text-slate-300 font-bold text-xs hover:text-white"
                    >
                      Bypass
                    </button>
                  </div>
                </div>
              </GlassCard>

              <div className="space-y-3 pt-1">
                <NeonButton
                  variant="primary"
                  size="lg"
                  className="w-full font-bold shadow-[0_0_20px_rgba(139,92,246,0.4)]"
                  onClick={() => setStep(5)}
                >
                  Continue <ArrowRight className="w-5 h-5 ml-2" />
                </NeonButton>
                <button
                  type="button"
                  onClick={() => setStep(5)}
                  className="w-full text-xs text-slate-400 hover:text-white py-1 transition"
                >
                  Skip for Now
                </button>
              </div>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div
              key="step-5"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6 text-center"
            >
              <div className="w-20 h-20 mx-auto rounded-3xl bg-neon-emerald/10 border border-neon-emerald/30 flex items-center justify-center shadow-[0_0_24px_rgba(16,185,129,0.3)]">
                <Check className="w-10 h-10 text-neon-emerald" />
              </div>

              <div className="space-y-2">
                <span className="text-xs font-mono uppercase tracking-widest text-neon-emerald">
                  All Set!
                </span>
                <h2 className="text-2xl font-bold text-white">You're Ready to Orbit</h2>
                <p className="text-sm text-slate-400 leading-relaxed max-w-xs mx-auto">
                  Your journey to unstoppable habits begins today. Create your first habit now or explore your space dashboard.
                </p>
              </div>

              <div className="space-y-3 pt-4">
                <NeonButton
                  variant="primary"
                  size="lg"
                  className="w-full font-bold"
                  onClick={() => handleFinish('create-habit')}
                >
                  <Sparkles className="w-4 h-4 mr-2" /> Create First Habit
                </NeonButton>
                <NeonButton
                  variant="secondary"
                  size="lg"
                  className="w-full font-medium"
                  onClick={() => handleFinish('home')}
                >
                  Go to Home Dashboard
                </NeonButton>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <footer className="text-center text-[10px] text-slate-500 font-mono relative z-10">
        100% Offline • Private & Secure • Indian Rupee (₹) Default
      </footer>
    </div>
  );
};
