export const CURRENT_DB_VERSION = 1;

export const SCHEMA_V1 = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS habits (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  type TEXT NOT NULL,
  target_value REAL NOT NULL,
  unit TEXT NOT NULL,
  repeat_days TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS habit_logs (
  id TEXT PRIMARY KEY,
  habit_id TEXT NOT NULL,
  date TEXT NOT NULL,
  progress REAL NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  completed_at INTEGER,
  source TEXT NOT NULL DEFAULT 'manual',
  FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_date ON habit_logs(habit_id, date);
CREATE INDEX IF NOT EXISTS idx_habit_logs_date ON habit_logs(date);

CREATE TABLE IF NOT EXISTS timer_sessions (
  id TEXT PRIMARY KEY,
  habit_id TEXT NOT NULL,
  start_ts INTEGER NOT NULL,
  target_seconds REAL NOT NULL,
  paused_total_ms REAL NOT NULL DEFAULT 0,
  last_paused_at INTEGER,
  status TEXT NOT NULL DEFAULT 'running',
  FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  habit_id TEXT NOT NULL,
  start_ts INTEGER NOT NULL,
  end_ts INTEGER NOT NULL,
  distance_m REAL NOT NULL,
  duration_s REAL NOT NULL,
  route_json TEXT NOT NULL,
  FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  habit_id TEXT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  time TEXT NOT NULL,
  days TEXT NOT NULL,
  sound TEXT NOT NULL DEFAULT 'ringtone_1.mp3',
  vibrate INTEGER NOT NULL DEFAULT 1,
  enabled INTEGER NOT NULL DEFAULT 1,
  notif_id INTEGER NOT NULL UNIQUE,
  FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  opening_balance REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD'
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  category TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_transactions_account_date ON transactions(account_id, date);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);

CREATE TABLE IF NOT EXISTS daily_balance (
  date TEXT NOT NULL,
  account_id TEXT NOT NULL,
  closing_balance REAL NOT NULL,
  PRIMARY KEY (date, account_id),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);
`;
