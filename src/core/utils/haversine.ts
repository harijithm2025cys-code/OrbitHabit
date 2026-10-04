import { GpsCoordinate } from '../types/log';

const EARTH_RADIUS_METERS = 6371000; // Earth's mean radius in meters

/**
 * Calculates the great-circle distance between two geographic coordinates using the Haversine formula.
 * Returns distance in meters.
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export type GpsRejectionReason =
  | 'accuracy_too_high'
  | 'timestamp_out_of_order'
  | 'stationary_drift'
  | 'speed_jump'
  | 'reported_speed_excessive';

export interface GpsValidationResult {
  valid: boolean;
  reason?: GpsRejectionReason;
  distanceMeters?: number;
}

/**
 * Precision GPS noise & stationary drift filter:
 * 1. Adaptive accuracy threshold: <= 50 m for first fix, <= 30 m for ongoing points.
 * 2. Ignore out-of-order or duplicate timestamps (timestamp <= lastPoint.timestamp).
 * 3. Ignore stationary drift: point must move at least max(3 m, accuracy * 0.5) from last accepted point.
 * 4. Ignore impossible speed jumps: instantaneous speed > 12 m/s (~43.2 km/h running) or > 35 m/s.
 */
export function validateGpsPoint(
  newPoint: GpsCoordinate,
  lastPoint: GpsCoordinate | null,
  maxAllowedSpeedMps = 12
): GpsValidationResult {
  // 1. Adaptive Accuracy Check
  const maxAccuracy = lastPoint === null ? 50 : 30;
  if (newPoint.accuracy > maxAccuracy) {
    return { valid: false, reason: 'accuracy_too_high' };
  }

  // First valid locked point accepted as route origin
  if (!lastPoint) {
    return { valid: true, distanceMeters: 0 };
  }

  // 2. Monotonic Timestamp Check
  const timeDiffSec = (newPoint.timestamp - lastPoint.timestamp) / 1000;
  if (timeDiffSec <= 0) {
    return { valid: false, reason: 'timestamp_out_of_order' };
  }

  const distMeters = calculateDistanceMeters(
    lastPoint.latitude,
    lastPoint.longitude,
    newPoint.latitude,
    newPoint.longitude
  );

  // 3. Adaptive Stationary Drift Filter (micro-jitter when standing still)
  const minRequiredDistance = Math.max(3, newPoint.accuracy * 0.5);
  if (distMeters < minRequiredDistance) {
    return { valid: false, reason: 'stationary_drift', distanceMeters: distMeters };
  }

  // 4. Instantaneous Speed Jump Check (teleportation rejection)
  const calculatedSpeedMps = distMeters / timeDiffSec;
  if (calculatedSpeedMps > maxAllowedSpeedMps) {
    return { valid: false, reason: 'speed_jump', distanceMeters: distMeters };
  }

  // 5. Native GPS Chip Speed Metadata Check
  if (
    newPoint.speed !== null &&
    newPoint.speed !== undefined &&
    newPoint.speed > maxAllowedSpeedMps
  ) {
    return { valid: false, reason: 'reported_speed_excessive', distanceMeters: distMeters };
  }

  return { valid: true, distanceMeters: distMeters };
}

/**
 * Boolean validation check for backwards compatibility.
 */
export function isValidGpsPoint(
  newPoint: GpsCoordinate,
  lastPoint: GpsCoordinate | null,
  maxAllowedSpeedMps = 12
): boolean {
  return validateGpsPoint(newPoint, lastPoint, maxAllowedSpeedMps).valid;
}

/**
 * Computes the total distance in kilometers of an accepted route array.
 */
export function computeTotalDistanceKm(points: GpsCoordinate[]): number {
  if (points.length < 2) return 0;
  let totalMeters = 0;
  for (let i = 1; i < points.length; i++) {
    totalMeters += calculateDistanceMeters(
      points[i - 1].latitude,
      points[i - 1].longitude,
      points[i].latitude,
      points[i].longitude
    );
  }
  return totalMeters / 1000;
}

/**
 * Computes smoothed speed in km/h from the last 3-5 accepted coordinates.
 */
export function computeSmoothedSpeedKmh(points: GpsCoordinate[], windowSize = 4): number {
  if (points.length < 2) return 0;

  const recent = points.slice(-Math.min(points.length, windowSize));
  let totalDistMeters = 0;
  let totalTimeSec = 0;

  for (let i = 1; i < recent.length; i++) {
    const dist = calculateDistanceMeters(
      recent[i - 1].latitude,
      recent[i - 1].longitude,
      recent[i].latitude,
      recent[i].longitude
    );
    const dt = (recent[i].timestamp - recent[i - 1].timestamp) / 1000;
    if (dt > 0) {
      totalDistMeters += dist;
      totalTimeSec += dt;
    }
  }

  if (totalTimeSec <= 0) return 0;
  const speedMps = totalDistMeters / totalTimeSec;
  return Math.max(0, speedMps * 3.6); // Convert m/s to km/h
}
