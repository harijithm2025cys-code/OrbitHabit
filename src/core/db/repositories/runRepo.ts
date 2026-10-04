import { RunRecord } from '../../types/log';
import { dexieDb } from '../dexieClient';
import { sqliteService } from '../sqliteClient';

export interface IRunRepository {
  getAllRuns(habitId?: string): Promise<RunRecord[]>;
  getRunById(id: string): Promise<RunRecord | null>;
  saveRun(run: RunRecord): Promise<void>;
  deleteRun(id: string): Promise<void>;
}

class RunRepository implements IRunRepository {
  async getAllRuns(habitId?: string): Promise<RunRecord[]> {
    if (sqliteService.isNativeActive()) {
      let sql = 'SELECT * FROM runs';
      const params: any[] = [];
      if (habitId) {
        sql += ' WHERE habit_id = ?';
        params.push(habitId);
      }
      sql += ' ORDER BY start_ts DESC';
      return await sqliteService.query<RunRecord>(sql, params);
    }

    if (habitId) {
      return await dexieDb.runs
        .where('habit_id')
        .equals(habitId)
        .reverse()
        .sortBy('start_ts');
    }
    return await dexieDb.runs.toCollection().reverse().sortBy('start_ts');
  }

  async getRunById(id: string): Promise<RunRecord | null> {
    if (sqliteService.isNativeActive()) {
      const rows = await sqliteService.query<RunRecord>('SELECT * FROM runs WHERE id = ?', [id]);
      return rows[0] || null;
    }
    const run = await dexieDb.runs.get(id);
    return run || null;
  }

  async saveRun(run: RunRecord): Promise<void> {
    if (sqliteService.isNativeActive()) {
      await sqliteService.run(
        `INSERT INTO runs (id, habit_id, start_ts, end_ts, distance_m, duration_s, route_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           end_ts = excluded.end_ts,
           distance_m = excluded.distance_m,
           duration_s = excluded.duration_s,
           route_json = excluded.route_json`,
        [
          run.id,
          run.habit_id,
          run.start_ts,
          run.end_ts,
          run.distance_m,
          run.duration_s,
          run.route_json
        ]
      );
      return;
    }

    await dexieDb.runs.put(run);
  }

  async deleteRun(id: string): Promise<void> {
    if (sqliteService.isNativeActive()) {
      await sqliteService.run('DELETE FROM runs WHERE id = ?', [id]);
      return;
    }
    await dexieDb.runs.delete(id);
  }
}

export const runRepository = new RunRepository();
