import { Geolocation, Position, CallbackID } from '@capacitor/geolocation';
import { ForegroundService } from '@capawesome-team/capacitor-android-foreground-service';
import { Capacitor } from '@capacitor/core';
import { GpsCoordinate, RunRecord } from '../types/log';
import {
  validateGpsPoint,
  computeTotalDistanceKm,
  computeSmoothedSpeedKmh,
  GpsRejectionReason
} from '../utils/haversine';
import { runRepository } from '../db/repositories/runRepo';
import { logRepository } from '../db/repositories/logRepo';
import { getTodayString } from '../utils/date';
import { generateId } from '../utils/id';

export type GpsSignalStatus = 'acquiring' | 'live' | 'lost' | 'disabled';
export type GpsSignalQuality = 'good' | 'fair' | 'weak' | 'lost' | 'acquiring';

export interface GpsRunStats {
  rawPointsCount: number;
  acceptedPointsCount: number;
  rejectedReasons: Record<GpsRejectionReason, number>;
  lastRawFixTimestamp: number | null;
  lastError: string | null;
}

export interface GpsRunState {
  runId: string;
  habitId: string;
  targetKm: number;
  coordinates: GpsCoordinate[];
  currentRawPosition: {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
  } | null;
  distanceKm: number;
  currentSpeedKmh: number;
  averageSpeedKmh: number;
  paceMinPerKm: string;
  startTimeMs: number;
  totalPausedMs: number;
  pauseStartMs: number | null;
  isTracking: boolean;
  isPaused: boolean;
  isCompleted: boolean;
  gpsStatus: GpsSignalStatus;
  signalQuality: GpsSignalQuality;
  lastAccuracyMeters: number | null;
  lastPointTimestamp: number | null;
  stats: GpsRunStats;
}

const ACTIVE_RUN_STORAGE_KEY = 'orbithabit_active_gps_run';

export class GpsTrackerEngine {
  private state: GpsRunState;
  private watchId: CallbackID | null = null;
  private onUpdateCallback?: (state: GpsRunState) => void;
  private watchdogInterval: NodeJS.Timeout | null = null;
  private autoSaveInterval: NodeJS.Timeout | null = null;
  private wakeLockSentinel: any = null;
  private isRestartingWatch = false;

  constructor(
    habitId: string,
    targetKm: number,
    onUpdate?: (state: GpsRunState) => void,
    restoredState?: Partial<GpsRunState>
  ) {
    this.state = {
      runId: restoredState?.runId || generateId('run'),
      habitId,
      targetKm,
      coordinates: restoredState?.coordinates || [],
      currentRawPosition: restoredState?.currentRawPosition || null,
      distanceKm: restoredState?.distanceKm || 0,
      currentSpeedKmh: 0,
      averageSpeedKmh: 0,
      paceMinPerKm: `--'--"/km`,
      startTimeMs: restoredState?.startTimeMs || Date.now(),
      totalPausedMs: restoredState?.totalPausedMs || 0,
      pauseStartMs: restoredState?.pauseStartMs || null,
      isTracking: false,
      isPaused: restoredState?.isPaused || false,
      isCompleted: restoredState?.isCompleted || false,
      gpsStatus: 'acquiring',
      signalQuality: 'acquiring',
      lastAccuracyMeters: null,
      lastPointTimestamp: null,
      stats: {
        rawPointsCount: 0,
        acceptedPointsCount: restoredState?.coordinates?.length || 0,
        rejectedReasons: {
          accuracy_too_high: 0,
          timestamp_out_of_order: 0,
          stationary_drift: 0,
          speed_jump: 0,
          reported_speed_excessive: 0
        },
        lastRawFixTimestamp: null,
        lastError: null
      }
    };
    this.onUpdateCallback = onUpdate;
  }

  public getState(): GpsRunState {
    return {
      ...this.state,
      coordinates: [...this.state.coordinates],
      stats: {
        ...this.state.stats,
        rejectedReasons: { ...this.state.stats.rejectedReasons }
      }
    };
  }

  public getElapsedSeconds(): number {
    const now = Date.now();
    let effectivePaused = this.state.totalPausedMs;
    if (this.state.isPaused && this.state.pauseStartMs) {
      effectivePaused += now - this.state.pauseStartMs;
    }
    const elapsed = Math.max(0, Math.floor((now - this.state.startTimeMs - effectivePaused) / 1000));
    return elapsed;
  }

  /**
   * Start watching native GPS coordinates.
   */
  public async startTracking(): Promise<void> {
    if (this.state.isTracking) return;

    this.state.isTracking = true;
    this.state.isPaused = false;
    this.state.pauseStartMs = null;
    this.state.gpsStatus = 'acquiring';
    this.state.signalQuality = 'acquiring';

    // Start Android Foreground Service for persistent background tracking
    if (Capacitor.isNativePlatform()) {
      try {
        await ForegroundService.startForegroundService({
          id: 9911,
          title: 'OrbitHabit Workout Active',
          body: `Acquiring GPS signal (${this.state.distanceKm.toFixed(2)} km)...`,
          smallIcon: 'ic_stat_orbit'
        });
      } catch (err) {
        console.warn('Foreground service start error:', err);
      }
    }

    // Launch watcher
    await this.setupGeolocationWatcher();

    // Start GPS watchdog (detect lost signal only if NO raw fix in 20 seconds)
    if (this.watchdogInterval) clearInterval(this.watchdogInterval);
    this.watchdogInterval = setInterval(() => {
      if (this.state.isTracking && !this.state.isPaused) {
        const now = Date.now();
        const lastFix = this.state.stats.lastRawFixTimestamp;

        if (lastFix && now - lastFix > 20000) {
          if (this.state.gpsStatus !== 'lost') {
            this.state.gpsStatus = 'lost';
            this.state.signalQuality = 'lost';
            this.state.currentSpeedKmh = 0;
            this.notify();
          }
        } else if (!lastFix && now - this.state.startTimeMs > 25000) {
          // Still waiting for initial satellite lock
          if (this.state.gpsStatus !== 'acquiring') {
            this.state.gpsStatus = 'acquiring';
            this.state.signalQuality = 'acquiring';
            this.notify();
          }
        }
        this.updatePaceAndSpeed();
      }
    }, 1000);

    // Auto-save snapshot every 10 seconds for crash recovery
    if (this.autoSaveInterval) clearInterval(this.autoSaveInterval);
    this.autoSaveInterval = setInterval(() => {
      this.saveActiveSnapshot();
    }, 10000);

    this.notify();
  }

  private async setupGeolocationWatcher(): Promise<void> {
    try {
      if (this.watchId !== null) {
        try {
          await Geolocation.clearWatch({ id: this.watchId });
        } catch {}
        this.watchId = null;
      }

      console.log('[GPS] Starting watchPosition with highAccuracy: true, timeout: 30000');
      this.watchId = await Geolocation.watchPosition(
        {
          enableHighAccuracy: true,
          timeout: 30000,
          maximumAge: 0
        },
        (position: Position | null, err?: any) => {
          if (err || !position) {
            const errorMsg = err?.message || 'Position unavailable';
            console.warn('[GPS] Watcher error/timeout:', errorMsg);
            this.state.stats.lastError = errorMsg;

            // Do not immediately drop to 'lost' on a single timeout; try auto-recovery
            if (!this.isRestartingWatch && this.state.isTracking && !this.state.isPaused) {
              this.scheduleWatchRestart();
            }
            this.notify();
            return;
          }

          this.handleIncomingPosition(position);
        }
      );
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.error('[GPS] Failed to start Geolocation watchPosition:', msg);
      this.state.stats.lastError = msg;
      this.state.gpsStatus = 'disabled';
      this.notify();
    }
  }

  private scheduleWatchRestart(): void {
    this.isRestartingWatch = true;
    setTimeout(async () => {
      if (this.state.isTracking && !this.state.isPaused) {
        console.log('[GPS] Auto-recovering geolocation watcher...');
        await this.setupGeolocationWatcher();
      }
      this.isRestartingWatch = false;
    }, 2000);
  }

  /**
   * Directly add a coordinate (used for test simulation & coordinate feeds).
   */
  public addCoordinate(coord: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    speed?: number | null;
    altitude?: number | null;
    heading?: number | null;
    timestamp?: number;
  }): boolean {
    const ts = coord.timestamp !== undefined ? coord.timestamp : Date.now();
    if (!this.state.isTracking) {
      this.state.isTracking = true;
      if (this.state.startTimeMs === null) {
        this.state.startTimeMs = ts;
      }
    }
    const pos: Position = {
      timestamp: ts,
      coords: {
        latitude: coord.latitude,
        longitude: coord.longitude,
        accuracy: coord.accuracy ?? 5,
        altitude: coord.altitude ?? null,
        altitudeAccuracy: null,
        heading: coord.heading ?? null,
        speed: coord.speed ?? null
      }
    };
    return this.handleIncomingPosition(pos);
  }

  /**
   * Process raw GPS position with noise & jitter filtering.
   */
  public handleIncomingPosition(pos: Position): boolean {
    if (!this.state.isTracking || this.state.isPaused) {
      return false;
    }

    const accuracy = pos.coords.accuracy ?? 999;
    const now = Date.now();
    const posTimestamp = pos.timestamp !== undefined ? pos.timestamp : now;

    // 1. Always record raw position stats
    this.state.stats.rawPointsCount++;
    this.state.stats.lastRawFixTimestamp = now;
    this.state.lastAccuracyMeters = accuracy;
    this.state.currentRawPosition = {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy,
      timestamp: posTimestamp
    };

    // 2. Classify GPS Signal Status & Quality from raw accuracy
    if (accuracy <= 20) {
      this.state.gpsStatus = 'live';
      this.state.signalQuality = 'good';
    } else if (accuracy <= 45) {
      this.state.gpsStatus = 'live';
      this.state.signalQuality = 'fair';
    } else if (accuracy <= 100) {
      this.state.gpsStatus = 'live';
      this.state.signalQuality = 'weak';
    } else {
      this.state.signalQuality = 'weak';
      if (this.state.coordinates.length === 0) {
        this.state.gpsStatus = 'acquiring';
      }
    }

    const newCoord: GpsCoordinate = {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: accuracy,
      speed: pos.coords.speed !== null && !isNaN(pos.coords.speed as number) ? (pos.coords.speed as number) : null,
      timestamp: posTimestamp
    };

    const lastCoord =
      this.state.coordinates.length > 0
        ? this.state.coordinates[this.state.coordinates.length - 1]
        : null;

    // 3. Strict Adaptive Noise & Stationary Drift Filter
    const validation = validateGpsPoint(newCoord, lastCoord);
    if (!validation.valid) {
      if (validation.reason) {
        this.state.stats.rejectedReasons[validation.reason]++;
      }
      this.notify();
      return false;
    }

    // 4. Point accepted for distance counting & route line
    this.state.coordinates.push(newCoord);
    this.state.stats.acceptedPointsCount++;
    this.state.lastPointTimestamp = now;
    this.state.distanceKm = computeTotalDistanceKm(this.state.coordinates);

    this.updatePaceAndSpeed();

    // 5. Auto-complete check
    if (this.state.distanceKm >= this.state.targetKm && !this.state.isCompleted) {
      this.state.isCompleted = true;
      this.handleAutoCompletion();
    }

    // 6. Update Foreground Notification
    if (Capacitor.isNativePlatform()) {
      try {
        ForegroundService.updateForegroundService({
          id: 9911,
          smallIcon: 'ic_stat_orbit',
          title: 'OrbitHabit Workout Active',
          body: `${this.state.distanceKm.toFixed(2)} km • ${this.formatDuration(this.getElapsedSeconds())} • ±${Math.round(accuracy)}m`
        });
      } catch {}
    }

    this.notify();
    return true;
  }

  public pause(): void {
    if (!this.state.isTracking || this.state.isPaused) return;
    this.state.isPaused = true;
    this.state.pauseStartMs = Date.now();
    this.state.currentSpeedKmh = 0;
    this.saveActiveSnapshot();
    this.notify();
  }

  public resume(): void {
    if (!this.state.isTracking || !this.state.isPaused) return;
    if (this.state.pauseStartMs) {
      this.state.totalPausedMs += Date.now() - this.state.pauseStartMs;
      this.state.pauseStartMs = null;
    }
    this.state.isPaused = false;
    this.notify();
  }

  public async finishRun(saveRecord = true): Promise<RunRecord | null> {
    this.cleanupListeners();
    this.clearActiveSnapshot();

    const now = Date.now();
    const durationSeconds = this.getElapsedSeconds();

    if (!saveRecord || this.state.coordinates.length < 2) {
      // If discarded or no real coordinates recorded
      if (saveRecord && this.state.distanceKm > 0) {
        // Save partial progress
        await this.recordHabitLogProgress(this.state.distanceKm, false);
      }
      return null;
    }

    const runRecord: RunRecord = {
      id: this.state.runId,
      habit_id: this.state.habitId,
      start_ts: this.state.startTimeMs,
      end_ts: now,
      distance_m: Math.round(this.state.distanceKm * 1000),
      duration_s: durationSeconds,
      route_json: JSON.stringify(this.state.coordinates)
    };

    await runRepository.saveRun(runRecord);

    const isGoalMet = this.state.distanceKm >= this.state.targetKm;
    await this.recordHabitLogProgress(this.state.distanceKm, isGoalMet);

    return runRecord;
  }

  public async discardRun(): Promise<void> {
    this.cleanupListeners();
    this.clearActiveSnapshot();
  }

  private updatePaceAndSpeed(): void {
    const elapsedSec = this.getElapsedSeconds();
    this.state.currentSpeedKmh = computeSmoothedSpeedKmh(this.state.coordinates, 4);

    if (elapsedSec > 5 && this.state.distanceKm > 0.01) {
      const hours = elapsedSec / 3600;
      this.state.averageSpeedKmh = Math.min(35, this.state.distanceKm / hours);

      const secPerKm = Math.round(elapsedSec / this.state.distanceKm);
      const m = Math.floor(secPerKm / 60);
      const s = secPerKm % 60;
      this.state.paceMinPerKm = `${m}'${String(s).padStart(2, '0')}"/km`;
    } else {
      this.state.averageSpeedKmh = 0;
      this.state.paceMinPerKm = `--'--"/km`;
    }
  }

  private async recordHabitLogProgress(distKm: number, isCompleted: boolean): Promise<void> {
    try {
      const todayStr = getTodayString();
      const existing = await logRepository.getLog(this.state.habitId, todayStr);
      const totalProgress = (existing?.progress || 0) + distKm;
      const completed = isCompleted || totalProgress >= this.state.targetKm ? 1 : (existing?.completed || 0);

      await logRepository.upsertLog({
        id: existing?.id || generateId('log'),
        habit_id: this.state.habitId,
        date: todayStr,
        progress: parseFloat(totalProgress.toFixed(2)),
        completed,
        completed_at: completed ? Date.now() : null,
        source: 'gps'
      });
    } catch (err) {
      console.error('Error recording habit log progress:', err);
    }
  }

  private handleAutoCompletion(): void {
    this.recordHabitLogProgress(this.state.distanceKm, true);
  }

  private notify(): void {
    if (this.onUpdateCallback) {
      this.onUpdateCallback(this.getState());
    }
  }

  private formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  public async acquireWakeLock(): Promise<void> {
    try {
      if ('wakeLock' in navigator) {
        this.wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
      }
    } catch (err) {
      console.warn('Screen WakeLock error:', err);
    }
  }

  public async releaseWakeLock(): Promise<void> {
    try {
      if (this.wakeLockSentinel) {
        await this.wakeLockSentinel.release();
        this.wakeLockSentinel = null;
      }
    } catch {}
  }

  private saveActiveSnapshot(): void {
    if (!this.state.isTracking || this.state.distanceKm <= 0) return;
    try {
      localStorage.setItem(ACTIVE_RUN_STORAGE_KEY, JSON.stringify(this.state));
    } catch {}
  }

  private clearActiveSnapshot(): void {
    try {
      localStorage.removeItem(ACTIVE_RUN_STORAGE_KEY);
    } catch {}
  }

  public static getRecoverableSnapshot(): GpsRunState | null {
    try {
      const raw = localStorage.getItem(ACTIVE_RUN_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.runId && parsed.habitId) {
        return parsed as GpsRunState;
      }
    } catch {}
    return null;
  }

  public cleanupListeners(): void {
    if (this.watchId !== null) {
      try {
        Geolocation.clearWatch({ id: this.watchId });
      } catch {}
      this.watchId = null;
    }

    if (this.watchdogInterval) {
      clearInterval(this.watchdogInterval);
      this.watchdogInterval = null;
    }

    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }

    this.releaseWakeLock();

    if (Capacitor.isNativePlatform()) {
      try {
        ForegroundService.stopForegroundService();
      } catch {}
    }

    this.state.isTracking = false;
  }
}
