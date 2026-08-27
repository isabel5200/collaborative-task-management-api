import bcrypt from 'bcryptjs';
import { createDatabasePool, withTransaction } from '../config/database.js';

const demoUsers = [
  {
    role: 'ADMIN',
    name: 'Demo',
    lastName: 'Admin',
    email: 'admin@example.com',
    password: 'Admin123!',
  },
  {
    role: 'MEMBER',
    name: 'Demo',
    lastName: 'Member One',
    email: 'member1@example.com',
    password: 'Member123!',
  },
  {
    role: 'MEMBER',
    name: 'Demo',
    lastName: 'Member Two',
    email: 'member2@example.com',
    password: 'Member123!',
  },
];

export async function seedDatabase(databaseConfig) {
  const pool = createDatabasePool(databaseConfig);

  try {
    await withTransaction(pool, async (connection) => {
      await connection.execute(
        `INSERT INTO roles (code, name) VALUES ('ADMIN', 'Administrator'), ('MEMBER', 'Member')
         ON DUPLICATE KEY UPDATE name = VALUES(name)`,
      );

      await connection.execute(
        `INSERT INTO task_statuses (code, name) VALUES ('open', 'Open'), ('archived', 'Archived'), ('in_progress', 'In progress')
         ON DUPLICATE KEY UPDATE name = VALUES(name)`,
      );

      const [roles] = await connection.execute('SELECT id, code FROM roles');
      const roleIds = Object.fromEntries(roles.map((role) => [role.code, role.id]));

      for (const user of demoUsers) {
        const passwordHash = await bcrypt.hash(user.password, 10);

        await connection.execute(
          `INSERT INTO users (role_id, name, last_name, email, password_hash, is_active)
           VALUES (?, ?, ?, ?, ?, TRUE)
           ON DUPLICATE KEY UPDATE
             role_id = VALUES(role_id), name = VALUES(name), last_name = VALUES(last_name),
             password_hash = VALUES(password_hash), is_active = TRUE`,
          [roleIds[user.role], user.name, user.lastName, user.email, passwordHash],
        );
      }
    });
    console.info('Seed data is ready.');
  } finally {
    await pool.end();
  }
}
