import 'dotenv/config';

export function getTestConfig() {
  const databaseName = process.env.TEST_DB_NAME || 'collab_task_manager_test';
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
      secret: 'a84c6c6cbea106804ebabd8445de1239310eed11fcbeacf524f6d1bb5bc789b8',
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
