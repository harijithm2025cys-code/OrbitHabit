import { Reminder } from '../../types/reminder';
import { dexieDb, ReminderDoc } from '../dexieClient';
import { sqliteService } from '../sqliteClient';

export interface IReminderRepository {
  getAll(): Promise<Reminder[]>;
  getById(id: string): Promise<Reminder | null>;
  getByHabitId(habitId: string): Promise<Reminder[]>;
  create(reminder: Reminder): Promise<void>;
  update(reminder: Reminder): Promise<void>;
  toggleEnabled(id: string, enabled: boolean): Promise<void>;
  delete(id: string): Promise<void>;
}

class ReminderRepository implements IReminderRepository {
  async getAll(): Promise<Reminder[]> {
    if (sqliteService.isNativeActive()) {
      const rows = await sqliteService.query<any>('SELECT * FROM reminders ORDER BY time ASC');
      return rows.map(this.mapSqliteRowToReminder);
    }
    const docs = await dexieDb.reminders.toCollection().sortBy('time');
    return docs.map(this.mapDocToReminder);
  }

  async getById(id: string): Promise<Reminder | null> {
    if (sqliteService.isNativeActive()) {
      const rows = await sqliteService.query<any>('SELECT * FROM reminders WHERE id = ?', [id]);
      return rows.length > 0 ? this.mapSqliteRowToReminder(rows[0]) : null;
    }
    const doc = await dexieDb.reminders.get(id);
    return doc ? this.mapDocToReminder(doc) : null;
  }

  async getByHabitId(habitId: string): Promise<Reminder[]> {
    if (sqliteService.isNativeActive()) {
      const rows = await sqliteService.query<any>(
        'SELECT * FROM reminders WHERE habit_id = ? ORDER BY time ASC',
        [habitId]
      );
      return rows.map(this.mapSqliteRowToReminder);
    }
    const docs = await dexieDb.reminders.where('habit_id').equals(habitId).toArray();
    return docs.map(this.mapDocToReminder);
  }

  async create(reminder: Reminder): Promise<void> {
    if (sqliteService.isNativeActive()) {
      await sqliteService.run(
        `INSERT INTO reminders (id, habit_id, title, body, time, days, sound, vibrate, enabled, notif_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          reminder.id,
          reminder.habit_id,
          reminder.title,
          reminder.body,
          reminder.time,
          JSON.stringify(reminder.days),
          reminder.sound,
          reminder.vibrate,
          reminder.enabled,
          reminder.notif_id
        ]
      );
      return;
    }
    await dexieDb.reminders.add(this.mapReminderToDoc(reminder));
  }

  async update(reminder: Reminder): Promise<void> {
    if (sqliteService.isNativeActive()) {
      await sqliteService.run(
        `UPDATE reminders SET habit_id = ?, title = ?, body = ?, time = ?, days = ?, sound = ?, vibrate = ?, enabled = ?, notif_id = ?
         WHERE id = ?`,
        [
          reminder.habit_id,
          reminder.title,
          reminder.body,
          reminder.time,
          JSON.stringify(reminder.days),
          reminder.sound,
          reminder.vibrate,
          reminder.enabled,
          reminder.notif_id,
          reminder.id
        ]
      );
      return;
    }
    await dexieDb.reminders.put(this.mapReminderToDoc(reminder));
  }

  async toggleEnabled(id: string, enabled: boolean): Promise<void> {
    if (sqliteService.isNativeActive()) {
      await sqliteService.run('UPDATE reminders SET enabled = ? WHERE id = ?', [
        enabled ? 1 : 0,
        id
      ]);
      return;
    }
    await dexieDb.reminders.update(id, { enabled: enabled ? 1 : 0 });
  }

  async delete(id: string): Promise<void> {
    if (sqliteService.isNativeActive()) {
      await sqliteService.run('DELETE FROM reminders WHERE id = ?', [id]);
      return;
    }
    await dexieDb.reminders.delete(id);
  }

  private mapDocToReminder(doc: ReminderDoc): Reminder {
    return {
      ...doc,
      days: JSON.parse(doc.days || '[0,1,2,3,4,5,6]')
    };
  }

  private mapReminderToDoc(reminder: Reminder): ReminderDoc {
    return {
      ...reminder,
      days: JSON.stringify(reminder.days)
    };
  }

  private mapSqliteRowToReminder(row: any): Reminder {
    return {
      id: row.id,
      habit_id: row.habit_id,
      title: row.title,
      body: row.body,
      time: row.time,
      days: typeof row.days === 'string' ? JSON.parse(row.days) : row.days,
      sound: row.sound,
      vibrate: row.vibrate,
      enabled: row.enabled,
      notif_id: row.notif_id
    };
  }
}

export const reminderRepository = new ReminderRepository();
