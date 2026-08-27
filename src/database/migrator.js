import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDatabasePool } from '../config/database.js';

const migrationsDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../migrations',
);

export async function migrateDatabase(databaseConfig) {
  const pool = createDatabasePool(databaseConfig, { multipleStatements: true });

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename VARCHAR(255) PRIMARY KEY,
        checksum CHAR(64) NOT NULL,
        applied_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
      ) ENGINE = InnoDB
    `);

    const filenames = (await readdir(migrationsDirectory))
      .filter((filename) => filename.endsWith('.sql'))
      .sort();

    for (const filename of filenames) {
      const sql = await readFile(path.join(migrationsDirectory, filename), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const [existingRows] = await pool.execute(
        'SELECT checksum FROM schema_migrations WHERE filename = ?',
        [filename],
      );

      if (existingRows.length > 0) {
        if (existingRows[0].checksum !== checksum) {
          throw new Error(`Applied migration ${filename} has been modified.`);
        }

        continue;
      }

      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        await connection.query(sql);
        await connection.execute(
          'INSERT INTO schema_migrations (filename, checksum) VALUES (?, ?)',
          [filename, checksum],
        );
        await connection.commit();

        console.info(`Applied migration: ${filename}`);
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }
  } finally {
    await pool.end();
  }
}
