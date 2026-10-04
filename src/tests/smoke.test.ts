import { describe, it, expect } from 'vitest';
import { calculateDistanceMeters, isValidGpsPoint, computeTotalDistanceKm } from '../core/utils/haversine';
import { formatDateString, parseDateString, addDays, getTodayString } from '../core/utils/date';
import { formatCurrency } from '../core/utils/currency';
import { generateId, generateNotificationId } from '../core/utils/id';

describe('Core Utility Functions', () => {
  describe('Haversine GPS calculations', () => {
    it('calculates distance between two points accurately', () => {
      // Coordinates approx 1 km apart
      const dist = calculateDistanceMeters(37.7749, -122.4194, 37.7839, -122.4194);
      expect(dist).toBeGreaterThan(950);
      expect(dist).toBeLessThan(1050);
    });

    it('filters noisy GPS points with bad accuracy or excessive speed', () => {
      const goodPoint1 = { latitude: 37.7749, longitude: -122.4194, timestamp: 1000000, accuracy: 10, speed: 2 };
      const badAccuracy = { latitude: 37.7755, longitude: -122.4194, timestamp: 1005000, accuracy: 50, speed: 2 };
      const badSpeed = { latitude: 37.7755, longitude: -122.4194, timestamp: 1005000, accuracy: 10, speed: 25 }; // > 12 m/s

      expect(isValidGpsPoint(badAccuracy, goodPoint1)).toBe(false);
      expect(isValidGpsPoint(badSpeed, goodPoint1)).toBe(false);
    });

    it('computes total path distance in km', () => {
      const points = [
        { latitude: 37.7749, longitude: -122.4194, timestamp: 1000, accuracy: 5 },
        { latitude: 37.7839, longitude: -122.4194, timestamp: 2000, accuracy: 5 }
      ];
      const km = computeTotalDistanceKm(points);
      expect(km).toBeCloseTo(1.0, 1);
    });
  });

  describe('Date utilities', () => {
    it('formats and parses date strings correctly', () => {
      const date = new Date(2026, 9, 3); // 2026-10-03
      const str = formatDateString(date);
      expect(str).toBe('2026-10-03');

      const parsed = parseDateString('2026-10-03');
      expect(parsed.getFullYear()).toBe(2026);
      expect(parsed.getMonth()).toBe(9);
      expect(parsed.getDate()).toBe(3);
    });

    it('adds and subtracts days accurately', () => {
      expect(addDays('2026-10-03', 1)).toBe('2026-10-04');
      expect(addDays('2026-10-03', -1)).toBe('2026-10-02');
      expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    });

    it('returns valid today string', () => {
      expect(getTodayString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('Currency formatter', () => {
    it('formats USD and other currencies', () => {
      const formatted = formatCurrency(1250.5, 'USD');
      expect(formatted).toContain('1,250.50');
    });
  });

  describe('ID generator', () => {
    it('generates unique string and notification IDs', () => {
      const id1 = generateId('habit');
      const id2 = generateId('habit');
      expect(id1).not.toBe(id2);
      expect(id1.startsWith('habit_')).toBe(true);

      const notifId = generateNotificationId();
      expect(typeof notifId).toBe('number');
      expect(notifId).toBeGreaterThan(0);
    });
  });
});
