export function generateId(prefix = 'id'): string {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 9);
  return `${prefix}_${timestamp}_${randomStr}`;
}

/**
 * Returns a stable, reproducible integer notification ID based on an arbitrary string key.
 * Identical keys always produce the same ID, which is critical for cancel/reschedule
 * to work correctly across app restarts. Range: 1 – 2,000,000,000 (safe for Android int).
 */
export function stableNotifId(key: string): number {
  let hash = 5381;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) + hash) + key.charCodeAt(i);
    hash = hash & 0x7fffffff; // keep positive 31-bit int
  }
  return (hash % 2_000_000_000) + 1;
}

/**
 * Generates a stable notification ID for a specific reminder + day slot.
 * @param reminderId The reminder's unique string id (rem_xxx)
 * @param dayOfWeek  0-6 (Sun-Sat) or -1 for a non-day-specific slot
 */
export function habitNotifId(reminderId: string, dayOfWeek = -1): number {
  return stableNotifId(`${reminderId}:day${dayOfWeek}`);
}

/**
 * @deprecated Use stableNotifId() or habitNotifId() instead.
 * This randomly-generated ID is preserved ONLY for legacy standalone reminders
 * created before the stable-ID migration.
 */
export function generateNotificationId(): number {
  return Math.floor(Math.random() * 900_000) + 100_000;
}
