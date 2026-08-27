import { seedDatabase } from '../../src/database/seeder.js';

const tables = [
  'notification_attempts',
  'task_notifications',
  'idempotency_records',
  'task_assignments',
  'tasks',
  'users',
  'roles',
  'task_statuses',
];

export async function resetTestDatabase(pool, databaseConfig) {
  if (!databaseConfig.name.endsWith('_test')) {
    throw new Error('Refusing to reset a database whose name does not end with _test.');
  }

  const connection = await pool.getConnection();
  try {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    for (const table of tables) {
      await connection.query(`TRUNCATE TABLE \`${table}\``);
    }
  } finally {
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    connection.release();
  }
  await seedDatabase(databaseConfig);
}
