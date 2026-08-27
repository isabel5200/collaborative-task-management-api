import { loadConfig } from '../src/config/env.js';
import { migrateDatabase } from '../src/database/migrator.js';

const config = loadConfig();
await migrateDatabase(config.database);
