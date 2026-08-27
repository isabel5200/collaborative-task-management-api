import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { createDatabasePool } from '../src/config/database.js';
import { resetTestDatabase } from './helpers/database.js';
import { getTestConfig } from './test-config.js';

const config = getTestConfig();
const pool = createDatabasePool(config.database);
const fetchMock = vi.fn();
const { app } = createApp({
  config,
  pool,
  fetchImpl: (...args) => fetchMock(...args),
  sleep: () => Promise.resolve(),
});

async function login(email, password) {
  const response = await request(app).post('/auth/login').send({ email, password });

  expect(response.status).toBe(200);

  return { token: response.body.data.accessToken, user: response.body.data.user };
}

async function demoActors() {
  const admin = await login('admin@example.com', 'Admin123!');
  const member1 = await login('member1@example.com', 'Member123!');
  const member2 = await login('member2@example.com', 'Member123!');

  return { admin, member1, member2 };
}

function bearer(actor) {
  return `Bearer ${actor.token}`;
}

function idempotencyKey(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

async function createTask(admin, body) {
  return request(app)
    .post('/tasks')
    .set('Authorization', bearer(admin))
    .set('Idempotency-Key', idempotencyKey('create'))
    .send(body);
}

beforeAll(async () => {
  await pool.query('SELECT 1');
});

beforeEach(async () => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ status: 204, ok: true });

  await resetTestDatabase(pool, config.database);
});

afterAll(async () => {
  await pool.end();
});

describe('Collaborative Task Management API', () => {
  it('returns a successful health check', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { status: 'ok' } });
  });

  it('logs in with valid credentials and returns the current user', async () => {
    const admin = await login('admin@example.com', 'Admin123!');
    const response = await request(app).get('/auth/me').set('Authorization', bearer(admin));

    expect(response.status).toBe(200);
    expect(response.body.data.user.role).toBe('ADMIN');
  });

  it('rejects missing and invalid access tokens', async () => {
    const missing = await request(app).get('/auth/me');
    const invalid = await request(app).get('/auth/me').set('Authorization', 'Bearer invalid');

    expect(missing.status).toBe(401);
    expect(invalid.status).toBe(401);
  });

  it('prevents a member from performing administrator actions', async () => {
    const member = await login('member1@example.com', 'Member123!');
    const response = await request(app)
      .post('/tasks')
      .set('Authorization', bearer(member))
      .set('Idempotency-Key', idempotencyKey('forbidden-task'))
      .send({ title: 'Forbidden task' });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('requires Idempotency-Key and does not modify state when it is missing', async () => {
    const admin = await login('admin@example.com', 'Admin123!');
    const before = await request(app).get('/tasks').set('Authorization', bearer(admin));

    const response = await request(app)
      .post('/tasks')
      .set('Authorization', bearer(admin))
      .send({ title: 'Must not be created' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'IDEMPOTENCY_KEY_REQUIRED',
        message: 'Idempotency-Key header is required.',
      },
    });

    const after = await request(app).get('/tasks').set('Authorization', bearer(admin));
    expect(after.body.data.tasks).toEqual(before.body.data.tasks);
  });

  it('creates users with hashed credentials and rejects duplicate email', async () => {
    const admin = await login('admin@example.com', 'Admin123!');
    const body = {
      name: 'New',
      lastName: 'Member',
      email: 'new.member@example.com',
      password: 'NewMember123!',
      role: 'MEMBER',
    };
    const created = await request(app)
      .post('/users')
      .set('Authorization', bearer(admin))
      .set('Idempotency-Key', idempotencyKey('create-user'))
      .send(body);

    expect(created.status).toBe(201);
    expect(created.body.data.user).not.toHaveProperty('passwordHash');

    const newLogin = await request(app)
      .post('/auth/login')
      .send({ email: body.email, password: body.password });
    expect(newLogin.status).toBe(200);

    const duplicate = await request(app)
      .post('/users')
      .set('Authorization', bearer(admin))
      .set('Idempotency-Key', idempotencyKey('duplicate-user'))
      .send(body);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('DUPLICATE_EMAIL');
  });

  it('rejects assigning the same user twice without partially modifying the task', async () => {
    const { admin, member1, member2 } = await demoActors();
    const taskResponse = await createTask(admin, { title: 'Assignment test' });
    const taskId = taskResponse.body.data.task.id;

    const first = await request(app)
      .post(`/tasks/${taskId}/assign`)
      .set('Authorization', bearer(admin))
      .set('Idempotency-Key', idempotencyKey('assign'))
      .send({ userIds: [member1.user.id] });
    const duplicate = await request(app)
      .post(`/tasks/${taskId}/assign`)
      .set('Authorization', bearer(admin))
      .set('Idempotency-Key', idempotencyKey('assign-duplicate'))
      .send({ userIds: [member1.user.id, member2.user.id] });

    expect(first.status).toBe(200);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('DUPLICATE_ASSIGNMENT');

    const detail = await request(app).get(`/tasks/${taskId}`).set('Authorization', bearer(admin));
    expect(detail.body.data.task.assignments.map((item) => item.userId)).toEqual([member1.user.id]);
  });

  it('prevents a member from completing another assignment', async () => {
    const { admin, member1, member2 } = await demoActors();
    const task = await createTask(admin, {
      title: 'Ownership test',
      userIds: [member1.user.id, member2.user.id],
    });
    const response = await request(app)
      .post(`/tasks/${task.body.data.task.id}/complete`)
      .set('Authorization', bearer(member1))
      .set('Idempotency-Key', idempotencyKey('complete-other'))
      .send({ userId: member2.user.id });
    expect(response.status).toBe(403);
  });

  it('keeps the task open for the first completion and archives on the last only once', async () => {
    const { admin, member1, member2 } = await demoActors();
    const task = await createTask(admin, {
      title: 'Critical flow',
      userIds: [member1.user.id, member2.user.id],
    });
    const taskId = task.body.data.task.id;

    const first = await request(app)
      .post(`/tasks/${taskId}/complete`)
      .set('Authorization', bearer(member1))
      .set('Idempotency-Key', idempotencyKey('complete-first'))
      .send({ userId: member1.user.id });
    expect(first.status).toBe(200);
    expect(first.body.data.taskStatus).toBe('open');
    expect(fetchMock).not.toHaveBeenCalled();

    const last = await request(app)
      .post(`/tasks/${taskId}/complete`)
      .set('Authorization', bearer(member2))
      .set('Idempotency-Key', idempotencyKey('complete-last'))
      .send({ userId: member2.user.id });
    expect(last.status).toBe(200);
    expect(last.body.data.taskStatus).toBe('archived');
    expect(last.body.data.archivedAt).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const repeated = await request(app)
      .post(`/tasks/${taskId}/complete`)
      .set('Authorization', bearer(member2))
      .set('Idempotency-Key', idempotencyKey('complete-repeat'))
      .send({ userId: member2.user.id });
    expect(repeated.status).toBe(200);
    expect(repeated.body.data.alreadyCompleted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const history = await request(app)
      .get(`/tasks/${taskId}/notifications`)
      .set('Authorization', bearer(admin));
    expect(history.body.data.notifications).toHaveLength(1);
    expect(history.body.data.notifications[0].attempts).toHaveLength(1);
  });

  it('archives once when the final assignments complete concurrently', async () => {
    const { admin, member1, member2 } = await demoActors();
    const task = await createTask(admin, {
      title: 'Concurrent completion',
      userIds: [member1.user.id, member2.user.id],
    });
    const taskId = task.body.data.task.id;

    const [first, second] = await Promise.all([
      request(app)
        .post(`/tasks/${taskId}/complete`)
        .set('Authorization', bearer(member1))
        .set('Idempotency-Key', idempotencyKey('concurrent-member-1'))
        .send({ userId: member1.user.id }),
      request(app)
        .post(`/tasks/${taskId}/complete`)
        .set('Authorization', bearer(member2))
        .set('Idempotency-Key', idempotencyKey('concurrent-member-2'))
        .send({ userId: member2.user.id }),
    ]);

    expect([first.status, second.status]).toEqual([200, 200]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const detail = await request(app).get(`/tasks/${taskId}`).set('Authorization', bearer(admin));
    expect(detail.body.data.task.status).toBe('archived');
  });

  it('executes a parallel MEMBER completion with the same idempotency key only once', async () => {
    const { admin, member1 } = await demoActors();
    const task = await createTask(admin, {
      title: 'Idempotent member completion',
      userIds: [member1.user.id],
    });
    const taskId = task.body.data.task.id;
    const key = `member-complete-${crypto.randomUUID()}`;
    const complete = () =>
      request(app)
        .post(`/tasks/${taskId}/complete`)
        .set('Authorization', bearer(member1))
        .set('Idempotency-Key', key)
        .send({ userId: member1.user.id });

    const [first, second] = await Promise.all([complete(), complete()]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(first.body.data.taskStatus).toBe('archived');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const history = await request(app)
      .get(`/tasks/${taskId}/notifications`)
      .set('Authorization', bearer(admin));
    expect(history.body.data.notifications).toHaveLength(1);
  });

  it('replays the same response for parallel POST requests with one idempotency key', async () => {
    const { admin } = await demoActors();
    const key = `parallel-${crypto.randomUUID()}`;
    const send = () =>
      request(app)
        .post('/tasks')
        .set('Authorization', bearer(admin))
        .set('Idempotency-Key', key)
        .send({ title: 'One logical task' });

    const [first, second] = await Promise.all([send(), send()]);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body).toEqual(first.body);

    const conflict = await request(app)
      .post('/tasks')
      .set('Authorization', bearer(admin))
      .set('Idempotency-Key', key)
      .send({ title: 'Different task body' });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('IDEMPOTENCY_CONFLICT');

    const tasks = await request(app).get('/tasks').set('Authorization', bearer(admin));
    expect(tasks.body.data.tasks).toHaveLength(1);
  });

  it('retries 5xx responses, stores attempts, and uses a stable event key', async () => {
    fetchMock
      .mockResolvedValueOnce({ status: 503, ok: false })
      .mockResolvedValueOnce({ status: 500, ok: false })
      .mockResolvedValueOnce({ status: 204, ok: true });
    const { admin, member1 } = await demoActors();
    const task = await createTask(admin, {
      title: 'Retry webhook',
      userIds: [member1.user.id],
    });
    const taskId = task.body.data.task.id;

    await request(app)
      .post(`/tasks/${taskId}/complete`)
      .set('Authorization', bearer(member1))
      .set('Idempotency-Key', idempotencyKey('complete-retry'))
      .send({ userId: member1.user.id });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][1].headers['X-Idempotency-Key']).toBe(`task.archived:${taskId}`);
    const history = await request(app)
      .get(`/tasks/${taskId}/notifications`)
      .set('Authorization', bearer(admin));
    expect(history.body.data.notifications[0].status).toBe('delivered');
    expect(history.body.data.notifications[0].attempts).toHaveLength(3);
  });

  it('rejects inactive assignees and filters tasks by status', async () => {
    const { admin, member1 } = await demoActors();
    await pool.execute('UPDATE users SET is_active = FALSE WHERE id = ?', [member1.user.id]);
    const invalid = await createTask(admin, {
      title: 'Invalid assignee',
      userIds: [member1.user.id],
    });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('INVALID_ASSIGNEES');

    await createTask(admin, { title: 'Open task' });
    const open = await request(app).get('/tasks?status=open').set('Authorization', bearer(admin));
    expect(open.status).toBe(200);
    expect(open.body.data.tasks.every((task) => task.status === 'open')).toBe(true);
  });
});
