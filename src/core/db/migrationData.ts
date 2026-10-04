/**
 * Pure migration data — no imports. Breaks the circular dependency
 * between sqliteClient.ts (which runs migrations) and migrations.ts.
 */

export interface Migration {
  version: number;
  description: string;
  upSql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: "Initial schema for habits, logs, timers, runs, reminders, and finance",
    upSql: ""
  },
  {
    version: 2,
    description: "Add description, checklist_items, alarm_time, alarm_sound columns to habits",
    upSql: `
      ALTER TABLE habits ADD COLUMN description TEXT NOT NULL DEFAULT "";
      ALTER TABLE habits ADD COLUMN checklist_items TEXT NOT NULL DEFAULT "[]";
      ALTER TABLE habits ADD COLUMN alarm_time TEXT NOT NULL DEFAULT "";
      ALTER TABLE habits ADD COLUMN alarm_sound TEXT NOT NULL DEFAULT "";
    `
  }
];
