import { describe, it, expect, beforeEach } from 'vitest';
import { dexieDb } from '../core/db/dexieClient';
import { TimerEngine } from '../core/services/timerEngine';
import { logRepository } from '../core/db/repositories/logRepo';
import { getTodayString } from '../core/utils/date';
import { TimerSession } from '../core/types/log';

describe('Timer Engine Service (Timestamp Based)', () => {
  beforeEach(async () => {
    await dexieDb.timer_sessions.clear();
    await dexieDb.habit_logs.clear();
  });

  it('calculates remaining seconds precisely based on start timestamp', () => {
    const startMs = 1000000;
    const session: TimerSession = {
      id: 'ts_test',
      habit_id: 'h_read',
      start_ts: startMs,
      target_seconds: 1200, // 20 min
      paused_total_ms: 0,
      last_paused_at: null,
      status: 'running'
    };

    // 5 minutes (300s) have passed
    const nowMs = startMs + 300 * 1000;
    const remaining = TimerEngine.calculateRemainingSeconds(session, nowMs);
    expect(remaining).toBe(900); // 15 min left
  });

  it('handles pause and resume without losing elapsed time', async () => {
    const startMs = 1000000;
    let session = await TimerEngine.startSession('h_read', 1200, startMs);

    // Run for 100 seconds
    const pauseTime = startMs + 100 * 1000;
    session = await TimerEngine.pauseSession(session, pauseTime);
    expect(session.status).toBe('paused');
    expect(session.last_paused_at).toBe(pauseTime);

    // Paused for 500 seconds
    const resumeTime = pauseTime + 500 * 1000;
    session = await TimerEngine.resumeSession(session, resumeTime);
    expect(session.status).toBe('running');
    expect(session.paused_total_ms).toBe(500 * 1000);

    // Check remaining at resume time: should still be exactly (1200 - 100) = 1100s
    const remaining = TimerEngine.calculateRemainingSeconds(session, resumeTime);
    expect(remaining).toBe(1100);
  });

  it('adds extra time (+5 minutes / 300s)', async () => {
    let session = await TimerEngine.startSession('h_read', 600, 1000000);
    session = await TimerEngine.addTime(session, 300);
    expect(session.target_seconds).toBe(900);
  });

  it('reconciles completed session after simulated app-kill and marks habit complete', async () => {
    const startMs = 1000000;
    const session = await TimerEngine.startSession('h_read', 1200, startMs);

    // Simulate process death / device sleep: app reopens 25 minutes later (> 20 min)
    const reopenedMs = startMs + 25 * 60 * 1000;
    const result = await TimerEngine.reconcileSession(session, reopenedMs);

    expect(result.finished).toBe(true);
    expect(result.session.status).toBe('done');

    // Verify habit log is marked complete with source='timer'
    const todayStr = getTodayString();
    const log = await logRepository.getLog('h_read', todayStr);
    expect(log).not.toBeNull();
    expect(log?.completed).toBe(1);
    expect(log?.source).toBe('timer');
  });
});
