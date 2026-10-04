import { Capacitor } from '@capacitor/core';
import {
  CapacitorSQLite,
  SQLiteConnection,
  SQLiteDBConnection
} from '@capacitor-community/sqlite';
import { SCHEMA_V1 } from './schema.sql';
import { MIGRATIONS } from './migrationData';

const DB_NAME = 'orbithabit_db';
/** Must match the highest migration version in MIGRATIONS array */
const DB_SCHEMA_VERSION = 2;

class SqliteService {
  private sqliteConnection: SQLiteConnection | null = null;
  private db: SQLiteDBConnection | null = null;
  private isNative: boolean = false;
  private isInitialized: boolean = false;

  constructor() {
    this.isNative = Capacitor.isNativePlatform();
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    if (this.isNative) {
      try {
        this.sqliteConnection = new SQLiteConnection(CapacitorSQLite);
        const ret = await this.sqliteConnection.checkConnectionsConsistency();
        const isConn = (await this.sqliteConnection.isConnection(DB_NAME, false)).result;

        if (ret.result && isConn) {
          this.db = await this.sqliteConnection.retrieveConnection(DB_NAME, false);
        } else {
          this.db = await this.sqliteConnection.createConnection(
            DB_NAME,
            false,
            'no-encryption',
            DB_SCHEMA_VERSION,
            false
          );
        }

        await this.db.open();
        await this.runMigrations();
      } catch (err) {
        console.error('Failed to initialize native SQLite database, falling back to Dexie', err);
        this.isNative = false;
      }
    }

    this.isInitialized = true;
  }

  private async runMigrations(): Promise<void> {
    if (!this.db) return;

    try {
      // Apply base schema (all CREATE IF NOT EXISTS — safe to re-run)
      await this.db.execute(SCHEMA_V1);

      // Determine current applied version
      const res = await this.db.query('SELECT MAX(version) as current_v FROM schema_migrations');
      let currentVersion: number = res.values?.[0]?.current_v ?? 0;

      // Apply any pending incremental migrations in order
      for (const migration of MIGRATIONS) {
        if (migration.version > currentVersion && migration.upSql.trim()) {
          console.log(`[DB] Applying migration v${migration.version}: ${migration.description}`);
          // SQLite ALTER TABLE statements must be run individually
          const statements = migration.upSql
            .split(';')
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
          for (const stmt of statements) {
            try {
              await this.db.run(stmt);
            } catch (alterErr: any) {
              // Ignore "duplicate column" errors so re-installs don't crash
              if (!alterErr?.message?.includes('duplicate column')) {
                throw alterErr;
              }
            }
          }
          await this.db.run(
            'INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)',
            [migration.version, Date.now()]
          );
          currentVersion = migration.version;
        }
      }

      // Ensure v1 baseline is recorded
      await this.db.run(
        'INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)',
        [1, Date.now()]
      );
    } catch (err) {
      console.error('[DB] Error running SQLite migrations:', err);
    }
  }

  public isNativeActive(): boolean {
    return this.isNative && this.db !== null;
  }

  public getDb(): SQLiteDBConnection | null {
    return this.db;
  }

  public async execute(sql: string): Promise<void> {
    if (this.db) {
      await this.db.execute(sql);
    }
  }

  public async query<T = any>(statement: string, values: any[] = []): Promise<T[]> {
    if (!this.db) return [];
    const res = await this.db.query(statement, values);
    return (res.values as T[]) || [];
  }

  public async run(statement: string, values: any[] = []): Promise<any> {
    if (!this.db) return null;
    return await this.db.run(statement, values);
  }
}

export const sqliteService = new SqliteService();
