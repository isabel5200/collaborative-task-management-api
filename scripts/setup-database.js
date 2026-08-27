import { loadConfig } from '../src/config/env.js';
import { createDatabase } from '../src/database/create-database.js';
import { migrateDatabase } from '../src/database/migrator.js';
import { seedDatabase } from '../src/database/seeder.js';

const config = loadConfig();
await createDatabase(config.database);
await migrateDatabase(config.database);
await seedDatabase(config.database);
console.info(`Database ${config.database.name} setup completed.`);
