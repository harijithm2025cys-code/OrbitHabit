import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Play, Pause, RotateCcw, Plus, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { NeonButton } from '../components/ui/NeonButton';
import { useHabitStore } from '../store/useHabitStore';
import { logRepository } from '../core/db/repositories/logRepo';
import { getTodayString } from '../core/utils/date';
import { generateId } from '../core/utils/id';

interface TimerRunPageProps {
  habitId?: string;
  onBack: () => void;
  onShowToast?: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export const TimerRunPage: React.FC<TimerRunPageProps> = ({ habitId, onBack, onShowToast }) => {
  const { habits, loadHabits } = useHabitStore();
  const habit = habits.find((h) => h.id === habitId);

  const initialDuration = habit ? (habit.target_value || 20) * 60 : 20 * 60;
  const [totalSeconds, setTotalSeconds] = useState<number>(initialDuration);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(initialDuration);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isRunning && secondsRemaining > 0) {
      timerRef.current = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setIsRunning(false);
            handleSessionComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, secondsRemaining]);

  const handleSessionComplete = async () => {
    setIsCompleted(true);
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {}
    confetti({
      particleCount: 80,
      spread: 80,
      origin: { y: 0.6 }
    });

    if (habitId) {
      const todayStr = getTodayString();
      const existing = await logRepository.getLog(habitId, todayStr);
      await logRepository.upsertLog({
        id: existing?.id || generateId('log'),
        habit_id: habitId,
        date: todayStr,
        progress: Math.round(totalSeconds / 60),
        completed: 1,
        completed_at: Date.now(),
        source: 'timer'
      });
      await loadHabits();
    }

    if (onShowToast) {
      onShowToast('success', `Focus session completed! Logged for today.`);
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleAddFiveMinutes = () => {
    setSecondsRemaining((prev) => prev + 300);
    setTotalSeconds((prev) => prev + 300);
  };

  const handleReset = () => {
    setIsRunning(false);
    setIsCompleted(false);
    setSecondsRemaining(initialDuration);
  };

  return (
    <div className="flex flex-col items-center justify-between min-h-screen pb-12 pt-6 px-4 max-w-md mx-auto">
      {/* Header */}
      <header className="w-full flex items-center justify-between">
        <button
          onClick={onBack}
          className="p-2 rounded-2xl bg-space-800/80 border border-white/10 text-slate-300 hover:text-white transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <span className="text-[10px] font-mono uppercase tracking-widest text-neon-purple">
            Active Session
          </span>
          <h1 className="text-lg font-bold text-white">
            {habit ? habit.name : 'Focus Timer'}
          </h1>
        </div>
        <div className="w-9" />
      </header>

      {/* Timer Circle */}
      <div className="relative flex items-center justify-center my-auto">
        <div className="w-72 h-72 rounded-full border-4 border-space-800 flex items-center justify-center relative shadow-glass bg-space-900/60 backdrop-blur-2xl">
          {/* Progress glow border */}
          <div
            className={`absolute inset-0 rounded-full border-4 transition-all duration-500 ${
              isCompleted
                ? 'border-neon-emerald shadow-emerald-500/50'
                : isRunning
                ? 'border-neon-purple shadow-neon-purple animate-pulse-slow'
                : 'border-white/10'
            }`}
          />

          <div className="text-center space-y-2">
            {isCompleted ? (
              <div className="flex flex-col items-center gap-2">
                <CheckCircle2 className="w-12 h-12 text-neon-emerald animate-bounce" />
                <span className="text-xl font-bold text-white">Session Complete!</span>
                <span className="text-xs text-slate-400 font-mono">
                  {Math.round(totalSeconds / 60)} min logged
                </span>
              </div>
            ) : (
              <>
                <div className="text-5xl font-mono font-extrabold text-white tracking-wider">
                  {formatTime(secondsRemaining)}
                </div>
                <span className="text-xs text-slate-400 font-medium">
                  Target: {Math.round(totalSeconds / 60)} min
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="w-full space-y-4">
        {isCompleted ? (
          <NeonButton variant="primary" size="lg" className="w-full font-bold" onClick={onBack}>
            Done & Return
          </NeonButton>
        ) : (
          <>
            <div className="flex items-center justify-center gap-4">
              <NeonButton
                variant="secondary"
                size="icon"
                onClick={handleAddFiveMinutes}
                aria-label="Add 5 minutes"
              >
                <Plus className="w-5 h-5 text-neon-cyan" />
              </NeonButton>

              <NeonButton
                variant="primary"
                size="lg"
                className="w-36 font-bold"
                onClick={() => setIsRunning(!isRunning)}
              >
                {isRunning ? (
                  <>
                    <Pause className="w-5 h-5 mr-2" /> Pause
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 mr-2" /> Start
                  </>
                )}
              </NeonButton>

              <NeonButton
                variant="secondary"
                size="icon"
                onClick={handleReset}
                aria-label="Reset timer"
              >
                <RotateCcw className="w-5 h-5 text-slate-400" />
              </NeonButton>
            </div>

            <button
              onClick={onBack}
              className="w-full text-center text-xs text-slate-400 hover:text-rose-400 transition font-medium"
            >
              Cancel Session
            </button>
          </>
        )}
      </div>
    </div>
  );
};
