import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  Play,
  Pause,
  Square,
  Navigation,
  CheckCircle2,
  AlertTriangle,
  Sun,
  RotateCcw,
  Zap,
  Clock,
  Gauge,
  Info
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Geolocation } from '@capacitor/geolocation';
import { GlassCard } from '../components/ui/GlassCard';
import { NeonButton } from '../components/ui/NeonButton';
import { Modal } from '../components/ui/Modal';
import { useHabitStore } from '../store/useHabitStore';
import { GpsTrackerEngine, GpsRunState } from '../core/services/gpsTracker';
import { NotificationService } from '../core/services/notificationService';
import { SoundService } from '../core/services/soundService';

interface GpsRunPageProps {
  habitId?: string;
  onBack: () => void;
  onShowToast?: (type: 'success' | 'error' | 'info', msg: string) => void;
}

interface DetailedPermissions {
  gpsSwitchEnabled: boolean;
  fineLocationGranted: boolean;
  coarseLocationGranted: boolean;
  backgroundLocationGranted: boolean;
  notificationGranted: boolean;
  isIgnoringBattery: boolean;
  isChecked: boolean;
}

export const GpsRunPage: React.FC<GpsRunPageProps> = ({ habitId, onBack, onShowToast }) => {
  const { habits, loadHabits } = useHabitStore();
  const habit = habits.find((h) => h.id === habitId);
  const targetKm = habit?.target_value || 3.0;

  const [engine, setEngine] = useState<GpsTrackerEngine | null>(null);
  const [runState, setRunState] = useState<GpsRunState | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  // Pre-run detailed permission diagnostics
  const [perms, setPerms] = useState<DetailedPermissions>({
    gpsSwitchEnabled: true,
    fineLocationGranted: true,
    coarseLocationGranted: true,
    backgroundLocationGranted: true,
    notificationGranted: true,
    isIgnoringBattery: true,
    isChecked: false
  });

  // UI state
  const [keepScreenOn, setKeepScreenOn] = useState(true);
  const [showStopModal, setShowStopModal] = useState(false);
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [showCelebrationBanner, setShowCelebrationBanner] = useState(false);
  const [recoveredRun, setRecoveredRun] = useState<Partial<GpsRunState> | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const elapsedTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Check permissions on mount
  const checkAllPermissions = useCallback(async () => {
    try {
      const details = await NotificationService.checkLocationPermissionsDetail();
      setPerms({
        ...details,
        isChecked: true
      });
    } catch {
      setPerms({
        gpsSwitchEnabled: true,
        fineLocationGranted: true,
        coarseLocationGranted: true,
        backgroundLocationGranted: true,
        notificationGranted: true,
        isIgnoringBattery: true,
        isChecked: true
      });
    }
  }, []);

  useEffect(() => {
    checkAllPermissions();
    // Check for unfinished active run in storage
    const recoverable = GpsTrackerEngine.getRecoverableSnapshot();
    if (recoverable && (!habitId || recoverable.habitId === habitId)) {
      setRecoveredRun(recoverable);
    }
  }, [checkAllPermissions, habitId]);

  // 2. Initialize Engine
  const initEngine = useCallback(
    (initialData?: Partial<GpsRunState>) => {
      const newEngine = new GpsTrackerEngine(
        habitId || 'general',
        targetKm,
        (updated) => {
          setRunState(updated);
        },
        initialData
      );
      setEngine(newEngine);
      setRunState(newEngine.getState());
      return newEngine;
    },
    [habitId, targetKm]
  );

  // 3. Start or Resume Run
  const handleStartRun = async () => {
    // Re-verify location switch
    const details = await NotificationService.checkLocationPermissionsDetail();
    if (!details.gpsSwitchEnabled) {
      setPerms({ ...details, isChecked: true });
      return;
    }

    if (!details.fineLocationGranted) {
      const geoPerm = await Geolocation.requestPermissions();
      if (geoPerm.location !== 'granted') {
        await checkAllPermissions();
        return;
      }
    }

    let activeEngine = engine;
    if (!activeEngine) {
      activeEngine = initEngine();
    }

    await activeEngine.startTracking();
    if (keepScreenOn) {
      activeEngine.acquireWakeLock();
    }
  };

  const handleResumeRecoveredRun = async () => {
    if (!recoveredRun) return;
    const activeEngine = initEngine(recoveredRun);
    setRecoveredRun(null);
    await activeEngine.startTracking();
    if (keepScreenOn) {
      activeEngine.acquireWakeLock();
    }
  };

  const handleDiscardRecoveredRun = () => {
    localStorage.removeItem('orbithabit_active_gps_run');
    setRecoveredRun(null);
  };

  // 4. Timer ticker for smooth elapsed seconds
  useEffect(() => {
    if (runState?.isTracking && !runState.isPaused) {
      elapsedTimerRef.current = setInterval(() => {
        if (engine) {
          setElapsedSec(engine.getElapsedSeconds());
        }
      }, 500);
    } else {
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    }
    return () => {
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, [runState?.isTracking, runState?.isPaused, engine]);

  // 5. Celebration detection
  useEffect(() => {
    if (runState?.isCompleted && !showCelebrationBanner) {
      setShowCelebrationBanner(true);
      try {
        Haptics.impact({ style: ImpactStyle.Heavy });
      } catch {}
      SoundService.playSound('ringtone_1.mp3');
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.5 }
      });
    }
  }, [runState?.isCompleted, showCelebrationBanner]);

  // 6. Draw Live Route on HTML5 Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = (canvas.width = canvas.parentElement?.clientWidth || 320);
    const height = (canvas.height = canvas.parentElement?.clientHeight || 200);

    // Clear and draw space grid background
    ctx.fillStyle = '#0a0d18';
    ctx.fillRect(0, 0, width, height);

    // Subtle dark space grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    const gridSize = 24;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const coords = runState?.coordinates || [];

    if (coords.length < 2) {
      // Acquiring / Standby Radar Graphic
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.save();
      // Outer pulse rings
      const hasRawFix = runState?.currentRawPosition !== null;
      ctx.strokeStyle = hasRawFix
        ? 'rgba(16, 185, 129, 0.4)'
        : runState?.isTracking
        ? 'rgba(0, 240, 255, 0.3)'
        : 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 36, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(centerX, centerY, 60, 0, Math.PI * 2);
      ctx.stroke();

      // Center glowing beacon
      const beaconColor = hasRawFix
        ? '#10b981'
        : runState?.isTracking
        ? '#00f0ff'
        : '#64748b';
      ctx.fillStyle = beaconColor;
      ctx.shadowColor = beaconColor;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = '#94a3b8';
      ctx.font = '500 11px system-ui, sans-serif';
      ctx.textAlign = 'center';

      let statusText = 'Ready • Tap Start Run';
      if (runState?.isTracking) {
        if (runState.gpsStatus === 'lost') {
          statusText = 'GPS Signal Lost • Searching...';
        } else if (runState.signalQuality === 'weak') {
          statusText = 'Weak GPS Signal • Move to open sky';
        } else if (runState.currentRawPosition) {
          statusText = `GPS Locked (±${Math.round(runState.currentRawPosition.accuracy)}m) • Walk outside to start`;
        } else {
          statusText = 'Acquiring satellite lock (can take up to 60s outdoors)...';
        }
      }
      ctx.fillText(statusText, centerX, centerY + 36);
      return;
    }

    // Compute bounding box
    let minLat = coords[0].latitude;
    let maxLat = coords[0].latitude;
    let minLng = coords[0].longitude;
    let maxLng = coords[0].longitude;

    for (const pt of coords) {
      if (pt.latitude < minLat) minLat = pt.latitude;
      if (pt.latitude > maxLat) maxLat = pt.latitude;
      if (pt.longitude < minLng) minLng = pt.longitude;
      if (pt.longitude > maxLng) maxLng = pt.longitude;
    }

    const padding = 32;
    const latSpan = Math.max(0.0001, maxLat - minLat);
    const lngSpan = Math.max(0.0001, maxLng - minLng);

    const scaleX = (width - padding * 2) / lngSpan;
    const scaleY = (height - padding * 2) / latSpan;
    const scale = Math.min(scaleX, scaleY);

    const mapLngToX = (lng: number) =>
      padding + (lng - minLng) * scale + ((width - padding * 2) - lngSpan * scale) / 2;
    const mapLatToY = (lat: number) =>
      height - (padding + (lat - minLat) * scale + ((height - padding * 2) - latSpan * scale) / 2);

    // Draw Route Polyline with Glowing Neon Gradient
    ctx.save();
    ctx.strokeStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 8;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(mapLngToX(coords[0].longitude), mapLatToY(coords[0].latitude));
    for (let i = 1; i < coords.length; i++) {
      ctx.lineTo(mapLngToX(coords[i].longitude), mapLatToY(coords[i].latitude));
    }
    ctx.stroke();
    ctx.restore();

    // Draw Start Dot (Emerald Green)
    const startX = mapLngToX(coords[0].longitude);
    const startY = mapLatToY(coords[0].latitude);
    ctx.save();
    ctx.fillStyle = '#10b981';
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(startX, startY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Draw Current Position Dot (Neon Cyan / Purple Orb)
    const lastPt = coords[coords.length - 1];
    const currX = mapLngToX(lastPt.longitude);
    const currY = mapLatToY(lastPt.latitude);

    ctx.save();
    // Pulse halo
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(currX, currY, 10, 0, Math.PI * 2);
    ctx.stroke();

    // Center dot
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(currX, currY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }, [runState?.coordinates, runState?.currentRawPosition, runState?.isTracking, runState?.gpsStatus, runState?.signalQuality]);

  // 7. Actions: Pause / Resume / Stop
  const handleTogglePause = () => {
    if (!engine) return;
    if (runState?.isPaused) {
      engine.resume();
    } else {
      engine.pause();
    }
  };

  const handleOpenStopModal = () => {
    if (engine) engine.pause();
    setShowStopModal(true);
  };

  const handleConfirmSaveRun = async () => {
    if (!engine) return;
    const record = await engine.finishRun(true);
    setShowStopModal(false);
    await loadHabits();

    if (onShowToast) {
      onShowToast(
        'success',
        record
          ? `Run saved: ${(record.distance_m / 1000).toFixed(2)} km logged!`
          : 'Partial distance saved to habit!'
      );
    }
    onBack();
  };

  const handleConfirmDiscardRun = async () => {
    if (engine) {
      await engine.discardRun();
    }
    setShowStopModal(false);
    if (onShowToast) onShowToast('info', 'Workout discarded');
    onBack();
  };

  const handleContinueRunning = () => {
    setShowStopModal(false);
    if (engine) engine.resume();
  };

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const currentDistKm = runState?.distanceKm || 0;
  const progressPercent = Math.min(100, Math.round((currentDistKm / targetKm) * 100));

  // Determine if permission barrier exists
  const hasPermissionBarrier =
    perms.isChecked &&
    (!perms.gpsSwitchEnabled || !perms.fineLocationGranted || !perms.notificationGranted);

  const startLongPress = () => {
    longPressTimerRef.current = setTimeout(() => {
      setShowDebugModal(true);
      try {
        Haptics.impact({ style: ImpactStyle.Medium });
      } catch {}
    }, 800);
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const lastAccuracy = runState?.lastAccuracyMeters;
  const accuracyBadgeText =
    lastAccuracy !== null && lastAccuracy !== undefined
      ? `±${Math.round(lastAccuracy)}m`
      : '';

  return (
    <div className="flex flex-col justify-between min-h-screen pb-10 pt-4 px-4 max-w-md mx-auto text-[var(--text-main)]">
      {/* Header */}
      <header className="w-full flex items-center justify-between pb-2">
        <button
          onClick={() => {
            if (runState?.isTracking && !runState.isPaused) {
              handleOpenStopModal();
            } else {
              if (engine) engine.discardRun();
              onBack();
            }
          }}
          className="p-2 rounded-2xl bg-space-800 border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-white transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Title with long-press for secret debug panel */}
        <div
          className="text-center cursor-pointer select-none"
          onMouseDown={startLongPress}
          onMouseUp={cancelLongPress}
          onTouchStart={startLongPress}
          onTouchEnd={cancelLongPress}
          title="Long press for GPS Diagnostics"
        >
          <span className="text-[10px] font-mono uppercase tracking-widest text-neon-cyan block flex items-center justify-center gap-1">
            GPS Live Tracker <Info className="w-2.5 h-2.5 opacity-60" />
          </span>
          <h1 className="text-lg font-bold text-[var(--text-main)] truncate max-w-[200px]">
            {habit ? habit.name : 'Outdoor Workout'}
          </h1>
        </div>

        {/* Screen Wake Lock Toggle */}
        <button
          onClick={() => {
            if (keepScreenOn) {
              if (engine) engine.releaseWakeLock();
              setKeepScreenOn(false);
            } else {
              if (engine) engine.acquireWakeLock();
              setKeepScreenOn(true);
            }
          }}
          className={`p-2 rounded-2xl border transition ${
            keepScreenOn
              ? 'bg-neon-cyan/20 border-neon-cyan text-neon-cyan'
              : 'bg-space-800 border-[var(--border-subtle)] text-[var(--text-dim)]'
          }`}
          title="Toggle Keep Screen Awake"
        >
          <Sun className="w-4 h-4" />
        </button>
      </header>

      {/* Recovered Run Banner */}
      {recoveredRun && !runState?.isTracking && (
        <GlassCard className="p-3 bg-neon-purple/15 border-neon-purple/30 space-y-2 mb-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--text-main)] flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5 text-neon-purple" /> Recover Interrupted Run
            </span>
            <span className="text-xs font-mono font-bold text-neon-cyan">
              {(recoveredRun.distanceKm || 0).toFixed(2)} km saved
            </span>
          </div>
          <div className="flex gap-2 pt-1">
            <NeonButton
              variant="primary"
              size="sm"
              className="flex-1 font-bold text-xs"
              onClick={handleResumeRecoveredRun}
            >
              Resume Run
            </NeonButton>
            <NeonButton
              variant="secondary"
              size="sm"
              className="flex-1 text-xs"
              onClick={handleDiscardRecoveredRun}
            >
              Discard
            </NeonButton>
          </div>
        </GlassCard>
      )}

      {/* Permission Barrier Diagnostics */}
      {hasPermissionBarrier && !runState?.isTracking && (
        <GlassCard className="p-4 space-y-3 bg-rose-950/20 border-rose-500/30 mb-2">
          <div className="flex items-center gap-2 text-xs font-bold text-rose-400">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
            GPS Setup Required
          </div>

          {!perms.gpsSwitchEnabled && (
            <div className="flex items-center justify-between text-xs p-2 rounded-xl bg-space-900 border border-white/5">
              <span className="text-slate-300">Device Location is turned OFF</span>
              <button
                onClick={async () => {
                  await NotificationService.openLocationSettings();
                  setTimeout(() => {
                    checkAllPermissions();
                  }, 1500);
                }}
                className="px-2.5 py-1 rounded-lg bg-neon-cyan text-space-950 font-bold text-[11px]"
              >
                Turn On GPS
              </button>
            </div>
          )}

          {!perms.fineLocationGranted && (
            <div className="flex items-center justify-between text-xs p-2 rounded-xl bg-space-900 border border-white/5">
              <span className="text-slate-300">Precise Location Permission</span>
              <button
                onClick={async () => {
                  await Geolocation.requestPermissions();
                  await checkAllPermissions();
                }}
                className="px-2.5 py-1 rounded-lg bg-neon-cyan text-space-950 font-bold text-[11px]"
              >
                Grant Permission
              </button>
            </div>
          )}

          {!perms.backgroundLocationGranted && (
            <div className="flex items-center justify-between text-xs p-2 rounded-xl bg-space-900 border border-white/5">
              <div className="flex flex-col">
                <span className="text-slate-300 font-medium">Background Location</span>
                <span className="text-[10px] text-slate-400">Location → Allow all the time</span>
              </div>
              <button
                onClick={async () => {
                  await NotificationService.openAppSettings();
                  setTimeout(() => {
                    checkAllPermissions();
                  }, 2000);
                }}
                className="px-2.5 py-1 rounded-lg bg-neon-purple text-white font-bold text-[11px]"
              >
                Allow All Time
              </button>
            </div>
          )}

          {!perms.notificationGranted && (
            <div className="flex items-center justify-between text-xs p-2 rounded-xl bg-space-900 border border-white/5">
              <span className="text-slate-300">Background Tracking Notification</span>
              <button
                onClick={async () => {
                  await NotificationService.requestPermissions();
                  await checkAllPermissions();
                }}
                className="px-2.5 py-1 rounded-lg bg-neon-cyan text-space-950 font-bold text-[11px]"
              >
                Allow
              </button>
            </div>
          )}
        </GlassCard>
      )}

      {/* Target Progress & Main Distance */}
      <div className="space-y-4 my-auto">
        {/* Live Route Canvas Card with Status Chip */}
        <GlassCard className="h-52 relative overflow-hidden border-[var(--border-subtle)] bg-space-900/90 p-0 flex flex-col justify-between">
          {/* Status Chip Top-Right */}
          <div className="absolute top-2.5 right-2.5 z-10">
            {runState?.gpsStatus === 'live' ? (
              runState.signalQuality === 'good' ? (
                <span className="px-2.5 py-1 rounded-full bg-neon-emerald/20 border border-neon-emerald/40 text-neon-emerald text-[10px] font-bold flex items-center gap-1 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-neon-emerald animate-pulse" /> Live GPS {accuracyBadgeText}
                </span>
              ) : runState.signalQuality === 'fair' ? (
                <span className="px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> GPS Fair {accuracyBadgeText}
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full bg-orange-500/20 border border-orange-500/40 text-orange-300 text-[10px] font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400" /> Weak GPS {accuracyBadgeText}
                </span>
              )
            ) : runState?.gpsStatus === 'lost' ? (
              <span className="px-2.5 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 text-[10px] font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> GPS Lost
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-neon-cyan text-[10px] font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-ping" /> Acquiring GPS...
              </span>
            )}
          </div>

          {/* Mode Chip Top-Left */}
          <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] font-mono bg-space-950/60 px-2 py-0.5 rounded-lg border border-white/5">
            <Navigation className="w-3 h-3 text-neon-cyan" />
            <span>Real GPS Haversine</span>
          </div>

          <canvas ref={canvasRef} className="w-full h-full block" />
        </GlassCard>

        {/* Distance Display & Target Progress */}
        <div className="space-y-2 text-center">
          <div className="flex items-baseline justify-center gap-2">
            <span className="text-5xl font-black font-mono tracking-tight text-[var(--text-main)]">
              {currentDistKm.toFixed(2)}
            </span>
            <span className="text-sm font-bold text-[var(--text-muted)] font-mono">
              / {targetKm.toFixed(2)} km
            </span>
          </div>

          {/* Progress Bar toward Goal */}
          <div className="w-full h-2 rounded-full bg-space-800 overflow-hidden relative">
            <div
              style={{ width: `${progressPercent}%` }}
              className="h-full bg-gradient-to-r from-neon-cyan to-neon-purple transition-all duration-300 rounded-full"
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono text-[var(--text-dim)] px-1">
            <span>Progress: {progressPercent}%</span>
            <span>Target: {targetKm} km</span>
          </div>
        </div>

        {/* Three Stat Cards: Time, Current Speed, Average Speed */}
        <div className="grid grid-cols-3 gap-2">
          <GlassCard className="p-3 text-center space-y-0.5">
            <span className="text-[10px] font-mono uppercase text-[var(--text-muted)] flex items-center justify-center gap-1">
              <Clock className="w-3 h-3 text-neon-cyan" /> Time
            </span>
            <span className="text-base font-extrabold font-mono text-[var(--text-main)] block">
              {formatDuration(elapsedSec)}
            </span>
          </GlassCard>

          <GlassCard className="p-3 text-center space-y-0.5">
            <span className="text-[10px] font-mono uppercase text-[var(--text-muted)] flex items-center justify-center gap-1">
              <Gauge className="w-3 h-3 text-neon-emerald" /> Speed
            </span>
            <span className="text-base font-extrabold font-mono text-neon-emerald block">
              {(runState?.currentSpeedKmh || 0).toFixed(1)}{' '}
              <span className="text-[9px] font-normal text-[var(--text-dim)]">km/h</span>
            </span>
          </GlassCard>

          <GlassCard className="p-3 text-center space-y-0.5">
            <span className="text-[10px] font-mono uppercase text-[var(--text-muted)] flex items-center justify-center gap-1">
              <Zap className="w-3 h-3 text-neon-purple" /> Avg / Pace
            </span>
            <span className="text-xs font-bold font-mono text-neon-purple block truncate">
              {runState?.paceMinPerKm || `--'--"/km`}
            </span>
          </GlassCard>
        </div>
      </div>

      {/* Goal Celebration Banner */}
      {showCelebrationBanner && (
        <GlassCard className="p-3 bg-neon-emerald/15 border-neon-emerald/40 flex items-center justify-between mb-3 animate-slide-up">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-neon-emerald shrink-0" />
            <div>
              <span className="text-xs font-bold text-[var(--text-main)] block">Target Reached!</span>
              <span className="text-[10px] text-slate-300">Habit marked complete for today.</span>
            </div>
          </div>
          <button
            onClick={() => setShowCelebrationBanner(false)}
            className="text-[11px] text-neon-cyan font-bold hover:underline"
          >
            Keep Going
          </button>
        </GlassCard>
      )}

      {/* Control Buttons */}
      <div className="w-full space-y-2 pt-2">
        {!runState?.isTracking ? (
          <NeonButton
            variant="primary"
            size="lg"
            className="w-full font-bold shadow-[0_0_20px_rgba(0,240,255,0.4)]"
            onClick={handleStartRun}
          >
            <Play className="w-5 h-5 mr-2" /> Start Run
          </NeonButton>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <NeonButton
              variant={runState.isPaused ? 'primary' : 'secondary'}
              size="lg"
              className="w-full font-bold"
              onClick={handleTogglePause}
            >
              {runState.isPaused ? (
                <>
                  <Play className="w-5 h-5 mr-2" /> Resume
                </>
              ) : (
                <>
                  <Pause className="w-5 h-5 mr-2" /> Pause
                </>
              )}
            </NeonButton>

            <NeonButton
              variant="danger"
              size="lg"
              className="w-full font-bold shadow-[0_0_15px_rgba(244,63,94,0.4)]"
              onClick={handleOpenStopModal}
            >
              <Square className="w-4 h-4 mr-2" /> Stop
            </NeonButton>
          </div>
        )}
      </div>

      {/* Stop Run Confirmation Modal */}
      <Modal
        isOpen={showStopModal}
        onClose={() => setShowStopModal(false)}
        title="Workout Summary"
      >
        <div className="space-y-4 pt-1">
          <div className="p-3.5 rounded-2xl bg-space-900 border border-[var(--border-subtle)] space-y-2 text-center">
            <span className="text-3xl font-extrabold font-mono text-[var(--text-main)]">
              {currentDistKm.toFixed(2)} km
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs text-[var(--text-muted)] pt-1 border-t border-white/5">
              <div>Time: <strong className="text-[var(--text-main)] font-mono">{formatDuration(elapsedSec)}</strong></div>
              <div>Avg: <strong className="text-neon-cyan font-mono">{(runState?.averageSpeedKmh || 0).toFixed(1)} km/h</strong></div>
            </div>
          </div>

          <div className="space-y-2">
            <NeonButton
              variant="primary"
              size="md"
              className="w-full font-bold"
              onClick={handleConfirmSaveRun}
            >
              Save & Log Run
            </NeonButton>

            <NeonButton
              variant="secondary"
              size="md"
              className="w-full font-medium"
              onClick={handleContinueRunning}
            >
              Continue Running
            </NeonButton>

            <button
              onClick={handleConfirmDiscardRun}
              className="w-full py-2 text-center text-xs font-bold text-rose-500 hover:text-rose-400 transition"
            >
              Discard Run
            </button>
          </div>
        </div>
      </Modal>

      {/* Secret GPS Diagnostics Debug Modal */}
      <Modal
        isOpen={showDebugModal}
        onClose={() => setShowDebugModal(false)}
        title="GPS Engine Diagnostics"
      >
        <div className="space-y-3 pt-1 text-xs">
          <div className="p-3 rounded-xl bg-space-900 border border-white/10 space-y-1.5 font-mono">
            <div className="flex justify-between">
              <span className="text-slate-400">Tracking State:</span>
              <span className="text-neon-cyan font-bold">{runState?.isTracking ? (runState.isPaused ? 'Paused' : 'Active') : 'Idle'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Signal Status:</span>
              <span className="text-neon-emerald font-bold uppercase">{runState?.gpsStatus} ({runState?.signalQuality})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Last Raw Accuracy:</span>
              <span className="text-white font-bold">{lastAccuracy !== null && lastAccuracy !== undefined ? `±${lastAccuracy.toFixed(1)} m` : 'None'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Raw Points Received:</span>
              <span className="text-white font-bold">{runState?.stats.rawPointsCount || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Accepted Points:</span>
              <span className="text-neon-cyan font-bold">{runState?.stats.acceptedPointsCount || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Last Raw Fix Time:</span>
              <span className="text-slate-300">
                {runState?.stats.lastRawFixTimestamp
                  ? `${Math.round((Date.now() - runState.stats.lastRawFixTimestamp) / 1000)}s ago`
                  : 'Never'}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-space-900 border border-white/10 space-y-1">
            <span className="font-bold text-slate-300 block mb-1">Rejected Points Breakdown:</span>
            <div className="flex justify-between text-slate-400">
              <span>Accuracy &gt; 30m:</span>
              <span className="text-amber-400 font-mono">{runState?.stats.rejectedReasons.accuracy_too_high || 0}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Stationary Jitter (&lt; 3m):</span>
              <span className="text-amber-400 font-mono">{runState?.stats.rejectedReasons.stationary_drift || 0}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Speed Spikes (&gt; 12 m/s):</span>
              <span className="text-amber-400 font-mono">{runState?.stats.rejectedReasons.speed_jump || 0}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Timestamp Out-of-order:</span>
              <span className="text-amber-400 font-mono">{runState?.stats.rejectedReasons.timestamp_out_of_order || 0}</span>
            </div>
          </div>

          {runState?.stats.lastError && (
            <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-[11px]">
              <strong>Last Error:</strong> {runState.stats.lastError}
            </div>
          )}

          <NeonButton
            variant="secondary"
            size="sm"
            className="w-full font-bold mt-2"
            onClick={() => setShowDebugModal(false)}
          >
            Close Diagnostics
          </NeonButton>
        </div>
      </Modal>
    </div>
  );
};
