import { loadConfig } from '../src/config/env.js';
import { createDatabase } from '../src/database/create-database.js';

const config = loadConfig();

await createDatabase(config.database);

console.info(`Database ${config.database.name} is ready.`);
