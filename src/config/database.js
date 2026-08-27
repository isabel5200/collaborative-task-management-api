import mysql from 'mysql2/promise';

export function createDatabasePool(databaseConfig, options = {}) {
  return mysql.createPool({
    host: databaseConfig.host,
    port: databaseConfig.port,
    user: databaseConfig.user,
    password: databaseConfig.password,
    database: databaseConfig.name,
    connectionLimit: databaseConfig.connectionLimit,
    waitForConnections: true,
    queueLimit: 0,
    timezone: 'Z',
    dateStrings: false,
    multipleStatements: options.multipleStatements ?? false,
  });
}

export function createServerConnection(databaseConfig) {
  return mysql.createConnection({
    host: databaseConfig.host,
    port: databaseConfig.port,
    user: databaseConfig.user,
    password: databaseConfig.password,
    timezone: 'Z',
  });
}

export async function withTransaction(pool, operation) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const result = await operation(connection);

    await connection.commit();

    return result;
  } catch (error) {
    await connection.rollback();

    throw error;
  } finally {
    connection.release();
  }
}
