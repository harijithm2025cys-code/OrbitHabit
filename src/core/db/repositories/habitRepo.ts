import { Habit } from "../../types/habit";
import { dexieDb, HabitDoc } from "../dexieClient";
import { sqliteService } from "../sqliteClient";

export interface IHabitRepository {
  getAll(includeArchived?: boolean): Promise<Habit[]>;
  getById(id: string): Promise<Habit | null>;
  create(habit: Habit): Promise<void>;
  update(habit: Habit): Promise<void>;
  archive(id: string, archived?: boolean): Promise<void>;
  delete(id: string): Promise<void>;
}

class HabitRepository implements IHabitRepository {
  async getAll(includeArchived = false): Promise<Habit[]> {
    if (sqliteService.isNativeActive()) {
      const sql = includeArchived
        ? "SELECT * FROM habits ORDER BY created_at ASC"
        : "SELECT * FROM habits WHERE archived = 0 ORDER BY created_at ASC";
      const rows = await sqliteService.query<any>(sql);
      return rows.map(this.mapSqliteRowToHabit);
    }
    let query = dexieDb.habits.toCollection();
    if (!includeArchived) {
      query = dexieDb.habits.where("archived").equals(0);
    }
    const docs = await query.sortBy("created_at");
    return docs.map(this.mapDocToHabit);
  }

  async getById(id: string): Promise<Habit | null> {
    if (sqliteService.isNativeActive()) {
      const rows = await sqliteService.query<any>("SELECT * FROM habits WHERE id = ?", [id]);
      if (rows.length === 0) return null;
      return this.mapSqliteRowToHabit(rows[0]);
    }
    const doc = await dexieDb.habits.get(id);
    return doc ? this.mapDocToHabit(doc) : null;
  }

  async create(habit: Habit): Promise<void> {
    if (sqliteService.isNativeActive()) {
      await sqliteService.run(
        `INSERT INTO habits (id, name, description, icon, color, type, target_value, unit,
           repeat_days, checklist_items, alarm_time, alarm_sound, created_at, archived)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          habit.id,
          habit.name,
          habit.description || "",
          habit.icon,
          habit.color,
          habit.type,
          habit.target_value,
          habit.unit,
          JSON.stringify(habit.repeat_days),
          JSON.stringify(habit.checklist_items || []),
          habit.alarm_time || "",
          habit.alarm_sound || "",
          habit.created_at,
          habit.archived
        ]
      );
      return;
    }
    await dexieDb.habits.add(this.mapHabitToDoc(habit));
  }

  async update(habit: Habit): Promise<void> {
    if (sqliteService.isNativeActive()) {
      await sqliteService.run(
        `UPDATE habits SET name = ?, description = ?, icon = ?, color = ?, type = ?,
           target_value = ?, unit = ?, repeat_days = ?, checklist_items = ?,
           alarm_time = ?, alarm_sound = ?, archived = ?
         WHERE id = ?`,
        [
          habit.name,
          habit.description || "",
          habit.icon,
          habit.color,
          habit.type,
          habit.target_value,
          habit.unit,
          JSON.stringify(habit.repeat_days),
          JSON.stringify(habit.checklist_items || []),
          habit.alarm_time || "",
          habit.alarm_sound || "",
          habit.archived,
          habit.id
        ]
      );
      return;
    }
    await dexieDb.habits.put(this.mapHabitToDoc(habit));
  }

  async archive(id: string, archived = true): Promise<void> {
    if (sqliteService.isNativeActive()) {
      await sqliteService.run("UPDATE habits SET archived = ? WHERE id = ?", [
        archived ? 1 : 0,
        id
      ]);
      return;
    }
    await dexieDb.habits.update(id, { archived: archived ? 1 : 0 });
  }

  async delete(id: string): Promise<void> {
    if (sqliteService.isNativeActive()) {
      await sqliteService.run("DELETE FROM habits WHERE id = ?", [id]);
      await sqliteService.run("DELETE FROM habit_logs WHERE habit_id = ?", [id]);
      await sqliteService.run("DELETE FROM runs WHERE habit_id = ?", [id]);
      await sqliteService.run("DELETE FROM timer_sessions WHERE habit_id = ?", [id]);
      return;
    }
    await dexieDb.transaction("rw", [dexieDb.habits, dexieDb.habit_logs, dexieDb.runs, dexieDb.timer_sessions], async () => {
      await dexieDb.habits.delete(id);
      await dexieDb.habit_logs.where("habit_id").equals(id).delete();
      await dexieDb.runs.where("habit_id").equals(id).delete();
      await dexieDb.timer_sessions.where("habit_id").equals(id).delete();
    });
  }

  private mapDocToHabit(doc: HabitDoc): Habit {
    return {
      ...doc,
      repeat_days: JSON.parse(doc.repeat_days || "[0,1,2,3,4,5,6]"),
      checklist_items: typeof (doc as any).checklist_items === "string"
        ? JSON.parse((doc as any).checklist_items || "[]")
        : ((doc as any).checklist_items || [])
    };
  }

  private mapHabitToDoc(habit: Habit): HabitDoc {
    return {
      ...habit,
      repeat_days: JSON.stringify(habit.repeat_days),
      checklist_items: JSON.stringify(habit.checklist_items || []) as any
    };
  }

  private mapSqliteRowToHabit(row: any): Habit {
    return {
      id: row.id,
      name: row.name,
      description: row.description || "",
      icon: row.icon,
      color: row.color,
      type: row.type,
      target_value: row.target_value,
      unit: row.unit,
      repeat_days: typeof row.repeat_days === "string" ? JSON.parse(row.repeat_days) : row.repeat_days,
      checklist_items: typeof row.checklist_items === "string"
        ? JSON.parse(row.checklist_items || "[]")
        : (row.checklist_items || []),
      alarm_time: row.alarm_time || undefined,
      alarm_sound: row.alarm_sound || undefined,
      created_at: row.created_at,
      archived: row.archived
    };
  }
}

export const habitRepository = new HabitRepository();
