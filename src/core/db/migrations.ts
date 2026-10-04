import { sqliteService } from './sqliteClient';
import { dexieDb } from './dexieClient';

// Re-export types and data from migrationData to avoid circular imports with sqliteClient
export type { Migration } from './migrationData';
export { MIGRATIONS } from './migrationData';

export async function initializeDatabase(): Promise<void> {
  // Initialize native SQLite if available (runs schema creation + incremental migrations)
  await sqliteService.initialize();

  // Initialize Dexie for web/fallback
  if (!dexieDb.isOpen()) {
    await dexieDb.open();
  }
}

