import { loadConfig } from '../src/config/env.js';
import { seedDatabase } from '../src/database/seeder.js';

const config = loadConfig();
await seedDatabase(config.database);
