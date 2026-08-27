import { createServerConnection } from '../config/database.js';

export async function createDatabase(databaseConfig) {
  if (!/^[A-Za-z0-9_]+$/.test(databaseConfig.name)) {
    throw new Error('Unsafe database name. Use only letters, numbers, and underscores.');
  }

  const connection = await createServerConnection(databaseConfig);

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${databaseConfig.name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } finally {
    await connection.end();
  }
}
