import { TimerSession } from '../types/log';
import { logRepository } from '../db/repositories/logRepo';
import { getTodayString } from '../utils/date';
import { generateId } from '../utils/id';

export class TimerEngine {
  /**
   * Calculates exact remaining seconds based on timestamps.
   * Survives process death, device sleep, and backgrounding.
   */
  public static calculateRemainingSeconds(
    session: TimerSession,
    nowMs: number = Date.now()
  ): number {
    if (session.status === 'done') return 0;
    if (session.status === 'cancelled') return session.target_seconds;

    let elapsedMs = 0;
    if (session.status === 'paused') {
      const pausedAt = session.last_paused_at || nowMs;
      elapsedMs = pausedAt - session.start_ts - session.paused_total_ms;
    } else {
      // running
      elapsedMs = nowMs - session.start_ts - session.paused_total_ms;
    }

    const elapsedSeconds = Math.max(0, elapsedMs / 1000);
    const remaining = Math.max(0, session.target_seconds - elapsedSeconds);
    return Math.ceil(remaining);
  }

  /**
   * Checks if an active session reached its target time and reconciles it.
   */
  public static async reconcileSession(
    session: TimerSession,
    nowMs: number = Date.now()
  ): Promise<{ finished: boolean; session: TimerSession }> {
    const remaining = this.calculateRemainingSeconds(session, nowMs);

    if (remaining <= 0 && session.status === 'running') {
      const updatedSession: TimerSession = {
        ...session,
        status: 'done'
      };
      await logRepository.saveTimerSession(updatedSession);

      // Mark habit log complete
      const todayStr = getTodayString();
      const existingLog = await logRepository.getLog(session.habit_id, todayStr);
      await logRepository.upsertLog({
        id: existingLog?.id || generateId('log'),
        habit_id: session.habit_id,
        date: todayStr,
        progress: session.target_seconds / 60,
        completed: 1,
        completed_at: nowMs,
        source: 'timer'
      });

      return { finished: true, session: updatedSession };
    }

    return { finished: false, session };
  }

  /**
   * Creates a new timer session and saves to DB.
   */
  public static async startSession(
    habitId: string,
    targetSeconds: number,
    startMs: number = Date.now()
  ): Promise<TimerSession> {
    // Clear any previous active sessions
    await logRepository.clearActiveTimerSession();

    const session: TimerSession = {
      id: generateId('timer'),
      habit_id: habitId,
      start_ts: startMs,
      target_seconds: targetSeconds,
      paused_total_ms: 0,
      last_paused_at: null,
      status: 'running'
    };

    await logRepository.saveTimerSession(session);
    return session;
  }

  public static async pauseSession(
    session: TimerSession,
    nowMs: number = Date.now()
  ): Promise<TimerSession> {
    if (session.status !== 'running') return session;

    const updated: TimerSession = {
      ...session,
      status: 'paused',
      last_paused_at: nowMs
    };
    await logRepository.saveTimerSession(updated);
    return updated;
  }

  public static async resumeSession(
    session: TimerSession,
    nowMs: number = Date.now()
  ): Promise<TimerSession> {
    if (session.status !== 'paused' || !session.last_paused_at) return session;

    const pauseDuration = Math.max(0, nowMs - session.last_paused_at);
    const updated: TimerSession = {
      ...session,
      status: 'running',
      paused_total_ms: session.paused_total_ms + pauseDuration,
      last_paused_at: null
    };
    await logRepository.saveTimerSession(updated);
    return updated;
  }

  public static async addTime(
    session: TimerSession,
    secondsToAdd: number
  ): Promise<TimerSession> {
    const updated: TimerSession = {
      ...session,
      target_seconds: session.target_seconds + secondsToAdd
    };
    await logRepository.saveTimerSession(updated);
    return updated;
  }

  public static async cancelSession(session: TimerSession): Promise<TimerSession> {
    const updated: TimerSession = {
      ...session,
      status: 'cancelled'
    };
    await logRepository.saveTimerSession(updated);
    return updated;
  }
}
