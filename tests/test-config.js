export function getTestConfig() {
  const databaseName = process.env.TEST_DB_NAME || 'collaborative_task_manager_test';
  if (!databaseName.endsWith('_test')) {
    throw new Error('TEST_DB_NAME must end with _test to protect non-test databases.');
  }

  return {
    env: 'test',
    port: 0,
    database: {
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      name: databaseName,
      connectionLimit: 10,
    },
    jwt: {
      secret: 'test-only-secret-that-is-at-least-32-characters',
      expiresIn: '1h',
    },
    notification: {
      url: 'http://127.0.0.1:4000/test-webhook',
      timeoutMs: 500,
      retryBaseMs: 0,
    },
    corsOrigins: '*',
  };
}
