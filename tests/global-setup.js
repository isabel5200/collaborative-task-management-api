import { createDatabase } from '../src/database/create-database.js';
import { migrateDatabase } from '../src/database/migrator.js';
import { getTestConfig } from './test-config.js';

export async function setup() {
  const config = getTestConfig();

  try {
    await createDatabase(config.database);
    await migrateDatabase(config.database);
  } catch (error) {
    throw new Error(
      `Unable to prepare isolated MySQL test database ${config.database.name}: ${error.message}`,
      { cause: error },
    );
  }
}
