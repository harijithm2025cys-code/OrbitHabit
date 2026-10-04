import { HabitLog, TimerSession } from '../../types/log';
import { dexieDb } from '../dexieClient';
import { sqliteService } from '../sqliteClient';

export interface ILogRepository {
  getAllLogs(): Promise<HabitLog[]>;
  getLogsByDate(date: string): Promise<HabitLog[]>;
  getLogsForHabit(habitId: string, startDate?: string, endDate?: string): Promise<HabitLog[]>;
  getLog(habitId: string, date: string): Promise<HabitLog | null>;
  upsertLog(log: HabitLog): Promise<void>;
  deleteLog(id: string): Promise<void>;
  saveTimerSession(session: TimerSession): Promise<void>;
  getActiveTimerSession(): Promise<TimerSession | null>;
  clearActiveTimerSession(): Promise<void>;
}

class LogRepository implements ILogRepository {
  async getAllLogs(): Promise<HabitLog[]> {
    if (sqliteService.isNativeActive()) {
      return await sqliteService.query<HabitLog>('SELECT * FROM habit_logs');
    }
    return await dexieDb.habit_logs.toArray();
  }

  async deleteLog(id: string): Promise<void> {
    if (sqliteService.isNativeActive()) {
      await sqliteService.run('DELETE FROM habit_logs WHERE id = ?', [id]);
      return;
    }
    await dexieDb.habit_logs.delete(id);
  }
  async getLogsByDate(date: string): Promise<HabitLog[]> {
    if (sqliteService.isNativeActive()) {
      return await sqliteService.query<HabitLog>(
        'SELECT * FROM habit_logs WHERE date = ?',
        [date]
      );
    }
    return await dexieDb.habit_logs.where('date').equals(date).toArray();
  }

  async getLogsForHabit(habitId: string, startDate?: string, endDate?: string): Promise<HabitLog[]> {
    if (sqliteService.isNativeActive()) {
      let sql = 'SELECT * FROM habit_logs WHERE habit_id = ?';
      const params: any[] = [habitId];

      if (startDate && endDate) {
        sql += ' AND date >= ? AND date <= ?';
        params.push(startDate, endDate);
      } else if (startDate) {
        sql += ' AND date >= ?';
        params.push(startDate);
      }

      sql += ' ORDER BY date ASC';
      return await sqliteService.query<HabitLog>(sql, params);
    }

    let query = dexieDb.habit_logs.where('habit_id').equals(habitId);
    let results = await query.toArray();

    if (startDate && endDate) {
      results = results.filter((l) => l.date >= startDate && l.date <= endDate);
    } else if (startDate) {
      results = results.filter((l) => l.date >= startDate);
    }

    return results.sort((a, b) => a.date.localeCompare(b.date));
  }

  async getLog(habitId: string, date: string): Promise<HabitLog | null> {
    if (sqliteService.isNativeActive()) {
      const rows = await sqliteService.query<HabitLog>(
        'SELECT * FROM habit_logs WHERE habit_id = ? AND date = ?',
        [habitId, date]
      );
      return rows[0] || null;
    }

    const log = await dexieDb.habit_logs
      .where('[habit_id+date]')
      .equals([habitId, date])
      .first();
    return log || null;
  }

  async upsertLog(log: HabitLog): Promise<void> {
    if (sqliteService.isNativeActive()) {
      await sqliteService.run(
        `INSERT INTO habit_logs (id, habit_id, date, progress, completed, completed_at, source)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           progress = excluded.progress,
           completed = excluded.completed,
           completed_at = excluded.completed_at,
           source = excluded.source`,
        [
          log.id,
          log.habit_id,
          log.date,
          log.progress,
          log.completed,
          log.completed_at,
          log.source
        ]
      );
      return;
    }

    await dexieDb.habit_logs.put(log);
  }

  async saveTimerSession(session: TimerSession): Promise<void> {
    if (sqliteService.isNativeActive()) {
      await sqliteService.run(
        `INSERT INTO timer_sessions (id, habit_id, start_ts, target_seconds, paused_total_ms, last_paused_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           paused_total_ms = excluded.paused_total_ms,
           last_paused_at = excluded.last_paused_at,
           status = excluded.status`,
        [
          session.id,
          session.habit_id,
          session.start_ts,
          session.target_seconds,
          session.paused_total_ms,
          session.last_paused_at,
          session.status
        ]
      );
      return;
    }

    await dexieDb.timer_sessions.put(session);
  }

  async getActiveTimerSession(): Promise<TimerSession | null> {
    if (sqliteService.isNativeActive()) {
      const rows = await sqliteService.query<TimerSession>(
        "SELECT * FROM timer_sessions WHERE status IN ('running', 'paused') ORDER BY start_ts DESC LIMIT 1"
      );
      return rows[0] || null;
    }

    const sessions = await dexieDb.timer_sessions
      .where('status')
      .anyOf(['running', 'paused'])
      .toArray();
    return sessions.length > 0 ? sessions[sessions.length - 1] : null;
  }

  async clearActiveTimerSession(): Promise<void> {
    if (sqliteService.isNativeActive()) {
      await sqliteService.run("UPDATE timer_sessions SET status = 'cancelled' WHERE status IN ('running', 'paused')");
      return;
    }

    await dexieDb.timer_sessions
      .where('status')
      .anyOf(['running', 'paused'])
      .modify({ status: 'cancelled' });
  }
}

export const logRepository = new LogRepository();
