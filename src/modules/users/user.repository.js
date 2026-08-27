export async function findByEmail(executor, email) {
  const [rows] = await executor.execute(
    `SELECT u.id, u.name, u.last_name AS lastName, u.email, u.password_hash AS passwordHash,
            u.is_active AS isActive, r.code AS role, u.created_at AS createdAt
     FROM users u JOIN roles r ON r.id = u.role_id
     WHERE u.email = ?`,
    [email],
  );

  return rows[0] ?? null;
}

export async function findById(executor, userId) {
  const [rows] = await executor.execute(
    `SELECT u.id, u.name, u.last_name AS lastName, u.email, u.is_active AS isActive,
            r.code AS role, u.created_at AS createdAt
     FROM users u JOIN roles r ON r.id = u.role_id
     WHERE u.id = ?`,
    [userId],
  );
  return rows[0] ?? null;
}

export async function findRoleId(executor, roleCode) {
  const [rows] = await executor.execute('SELECT id FROM roles WHERE code = ?', [roleCode]);
  return rows[0]?.id ?? null;
}

export async function create(executor, user) {
  const [result] = await executor.execute(
    `INSERT INTO users (role_id, name, last_name, email, password_hash)
     VALUES (?, ?, ?, ?, ?)`,
    [user.roleId, user.name, user.lastName, user.email, user.passwordHash],
  );

  return findById(executor, result.insertId);
}

export async function findAssignableMembers(executor, userIds) {
  const placeholders = userIds.map(() => '?').join(', ');
  const [rows] = await executor.execute(
    `SELECT u.id
     FROM users u JOIN roles r ON r.id = u.role_id
     WHERE u.id IN (${placeholders}) AND u.is_active = TRUE AND r.code = 'MEMBER'`,
    userIds,
  );
  return rows.map((row) => row.id);
}

export async function listWithPendingTasks(executor) {
  const [rows] = await executor.execute(
    `SELECT u.id, u.name, u.last_name AS lastName, u.email, u.is_active AS isActive,
            r.code AS role, u.created_at AS createdAt,
            t.id AS taskId, t.title AS taskTitle, ts.code AS taskStatus
     FROM users u
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN task_assignments ta ON ta.user_id = u.id AND ta.completed_at IS NULL
     LEFT JOIN tasks t ON t.id = ta.task_id
     LEFT JOIN task_statuses ts ON ts.id = t.task_status_id
     ORDER BY u.id, t.id`,
  );
  return rows;
}

export async function listTasksForUser(executor, userId) {
  const [rows] = await executor.execute(
    `SELECT t.id, t.title, t.description, ts.code AS status, t.archived_at AS archivedAt,
            t.created_at AS createdAt, ta.assigned_at AS assignedAt,
            ta.completed_at AS completedAt
     FROM task_assignments ta
     JOIN tasks t ON t.id = ta.task_id
     JOIN task_statuses ts ON ts.id = t.task_status_id
     WHERE ta.user_id = ?
     ORDER BY t.created_at DESC, t.id DESC`,
    [userId],
  );
  return rows;
}
