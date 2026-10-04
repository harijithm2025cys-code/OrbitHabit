import { describe, it, expect, beforeEach } from 'vitest';
import { dexieDb } from '../core/db/dexieClient';
import { GpsTrackerEngine } from '../core/services/gpsTracker';
import {
  calculateDistanceMeters,
  isValidGpsPoint,
  validateGpsPoint,
  computeSmoothedSpeedKmh
} from '../core/utils/haversine';
import { logRepository } from '../core/db/repositories/logRepo';
import { getTodayString } from '../core/utils/date';

describe('Real GPS Haversine & Noise Filtering Engine', () => {
  beforeEach(async () => {
    await dexieDb.runs.clear();
    await dexieDb.habit_logs.clear();
  });

  it('calculates accurate Haversine great-circle distances', () => {
    // Distance between London (51.5074, -0.1278) and Paris (48.8566, 2.3522) is ~343.5 km
    const distMeters = calculateDistanceMeters(51.5074, -0.1278, 48.8566, 2.3522);
    expect(distMeters / 1000).toBeCloseTo(343.5, 0);

    // 0 distance between identical points
    expect(calculateDistanceMeters(12.9716, 77.5946, 12.9716, 77.5946)).toBe(0);
  });

  it('accepts initial GPS lock with accuracy up to 50m to drop start marker', () => {
    const origin = { latitude: 12.9716, longitude: 77.5946, timestamp: 1000, accuracy: 42, speed: 0 };
    const validation = validateGpsPoint(origin, null);
    expect(validation.valid).toBe(true);
  });

  it('rejects subsequent points with poor accuracy (> 30 m) for distance calculation', () => {
    const origin = { latitude: 12.9716, longitude: 77.5946, timestamp: 1000, accuracy: 12, speed: 2 };
    const badAcc = { latitude: 12.9720, longitude: 77.5946, timestamp: 2000, accuracy: 38, speed: 2 };

    const validation = validateGpsPoint(badAcc, origin);
    expect(validation.valid).toBe(false);
    expect(validation.reason).toBe('accuracy_too_high');
  });

  it('weak accuracy points update raw signal status without polluting distance', () => {
    const tracker = new GpsTrackerEngine('h_walk', 3.0);
    tracker.startTracking();

    const origin = { latitude: 12.971600, longitude: 77.594600, timestamp: 1000, accuracy: 15, speed: 0 };
    expect(tracker.handleIncomingPosition({ coords: origin, timestamp: 1000 } as any)).toBe(true);
    expect(tracker.getState().gpsStatus).toBe('live');
    expect(tracker.getState().signalQuality).toBe('good');

    // A weak accuracy point (e.g. 40m) arrives
    const weakFix = { latitude: 12.972000, longitude: 77.594600, timestamp: 3000, accuracy: 40, speed: 0 };
    expect(tracker.handleIncomingPosition({ coords: weakFix, timestamp: 3000 } as any)).toBe(false);

    // Verified: Signal is still Live/Fair, raw position updated, but distance remains 0.00 km!
    expect(tracker.getState().gpsStatus).toBe('live');
    expect(tracker.getState().signalQuality).toBe('fair');
    expect(tracker.getState().distanceKm).toBe(0);
    expect(tracker.getState().stats.rawPointsCount).toBe(2);
    expect(tracker.getState().stats.acceptedPointsCount).toBe(1);
    expect(tracker.getState().stats.rejectedReasons.accuracy_too_high).toBe(1);
  });

  it('rejects stationary drift when standing still (distance stays 0.00 km)', () => {
    const tracker = new GpsTrackerEngine('h_walk', 3.0);
    tracker.startTracking();

    const origin = { latitude: 12.971600, longitude: 77.594600, timestamp: 1000, accuracy: 8, speed: 0 };
    expect(tracker.handleIncomingPosition({ coords: origin, timestamp: 1000 } as any)).toBe(true);

    // Standing still: tiny indoor GPS jitter points (< max(3, 8 * 0.5 = 4m))
    const jitter1 = { latitude: 12.971608, longitude: 77.594605, timestamp: 2000, accuracy: 8, speed: 0 }; // ~1.0m away
    const jitter2 = { latitude: 12.971595, longitude: 77.594598, timestamp: 3000, accuracy: 9, speed: 0 }; // ~1.2m away
    const jitter3 = { latitude: 12.971602, longitude: 77.594602, timestamp: 4000, accuracy: 7, speed: 0 }; // ~0.3m away

    expect(tracker.handleIncomingPosition({ coords: jitter1, timestamp: 2000 } as any)).toBe(false);
    expect(tracker.handleIncomingPosition({ coords: jitter2, timestamp: 3000 } as any)).toBe(false);
    expect(tracker.handleIncomingPosition({ coords: jitter3, timestamp: 4000 } as any)).toBe(false);

    // Verified: Only origin accepted, distance is strictly 0.00 km
    expect(tracker.getState().coordinates.length).toBe(1);
    expect(tracker.getState().distanceKm).toBe(0);
    expect(tracker.getState().currentSpeedKmh).toBe(0);
    expect(tracker.getState().stats.rejectedReasons.stationary_drift).toBe(3);
  });

  it('real movement of 100m adds ~0.10 km accurately', () => {
    const tracker = new GpsTrackerEngine('h_walk', 3.0);
    tracker.startTracking();

    const origin = { latitude: 12.971600, longitude: 77.594600, timestamp: 1000, accuracy: 6, speed: 1.5 };
    expect(tracker.handleIncomingPosition({ coords: origin, timestamp: 1000 } as any)).toBe(true);

    // Move ~100m North (0.0009 degrees latitude)
    const p100m = { latitude: 12.972500, longitude: 77.594600, timestamp: 30000, accuracy: 6, speed: 3.3 };
    expect(tracker.handleIncomingPosition({ coords: p100m, timestamp: 30000 } as any)).toBe(true);

    expect(tracker.getState().coordinates.length).toBe(2);
    expect(tracker.getState().distanceKm).toBeCloseTo(0.1, 2);
  });

  it('rejects impossible jumps / teleportation (> 12 m/s)', () => {
    const p1 = { latitude: 12.9716, longitude: 77.5946, timestamp: 1000, accuracy: 5, speed: 3 };
    // 500m jump in 2 seconds = 250 m/s -> impossible jump
    const p2 = { latitude: 12.9760, longitude: 77.5946, timestamp: 3000, accuracy: 5, speed: 3 };

    expect(isValidGpsPoint(p2, p1)).toBe(false);
  });

  it('rejects out-of-order or duplicate timestamps', () => {
    const p1 = { latitude: 12.9716, longitude: 77.5946, timestamp: 5000, accuracy: 5, speed: 3 };
    const p2 = { latitude: 12.9720, longitude: 77.5946, timestamp: 4000, accuracy: 5, speed: 3 };

    expect(isValidGpsPoint(p2, p1)).toBe(false);
  });

  it('computes smoothed moving speed correctly', () => {
    const points = [
      { latitude: 12.971600, longitude: 77.594600, timestamp: 0, accuracy: 5 },
      { latitude: 12.971690, longitude: 77.594600, timestamp: 2000, accuracy: 5 }, // ~10m in 2s = 5 m/s = 18 km/h
      { latitude: 12.971780, longitude: 77.594600, timestamp: 4000, accuracy: 5 }, // ~10m in 2s = 5 m/s = 18 km/h
      { latitude: 12.971870, longitude: 77.594600, timestamp: 6000, accuracy: 5 }  // ~10m in 2s = 5 m/s = 18 km/h
    ];

    const speedKmh = computeSmoothedSpeedKmh(points as any, 4);
    expect(speedKmh).toBeGreaterThan(16);
    expect(speedKmh).toBeLessThan(20);
  });

  it('replays a recorded real-world walking track and auto-completes target', async () => {
    const targetKm = 1.0;
    const tracker = new GpsTrackerEngine('h_real_run', targetKm);
    tracker.startTracking();

    // Replay 10 real progressive GPS coordinates moving along a path (~120m per step every 30s = 4 m/s = 14.4 km/h)
    const baseLat = 12.971600;
    const baseLng = 77.594600;
    let time = 1000;

    for (let i = 0; i < 10; i++) {
      const lat = baseLat + i * 0.0011; // ~122m per step
      const pos = {
        coords: {
          latitude: lat,
          longitude: baseLng,
          accuracy: 6,
          speed: 4,
          altitude: 900,
          heading: 0
        },
        timestamp: time
      };
      tracker.handleIncomingPosition(pos as any);
      time += 30000;
    }

    const state = tracker.getState();
    expect(state.coordinates.length).toBe(10);
    expect(state.distanceKm).toBeGreaterThanOrEqual(1.0);
    expect(state.isCompleted).toBe(true);

    const runRecord = await tracker.finishRun(true);
    expect(runRecord).not.toBeNull();
    expect(runRecord!.distance_m).toBeGreaterThanOrEqual(1000);

    const todayStr = getTodayString();
    const log = await logRepository.getLog('h_real_run', todayStr);
    expect(log?.completed).toBe(1);
    expect(log?.progress).toBeGreaterThanOrEqual(1.0);
  });
});
