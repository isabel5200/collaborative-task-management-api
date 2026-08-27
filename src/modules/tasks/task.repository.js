export async function findStatusId(executor, code) {
  const [rows] = await executor.execute('SELECT id FROM task_statuses WHERE code = ?', [code]);
  return rows[0]?.id ?? null;
}

export async function create(executor, task) {
  const [result] = await executor.execute(
    `INSERT INTO tasks (title, description, task_status_id, created_by_user_id)
     VALUES (?, ?, ?, ?)`,
    [task.title, task.description ?? null, task.statusId, task.createdByUserId],
  );
  return result.insertId;
}

export async function lockTask(executor, taskId) {
  const [rows] = await executor.execute(
    `SELECT t.id, t.title, ts.code AS status, t.archived_at AS archivedAt
     FROM tasks t JOIN task_statuses ts ON ts.id = t.task_status_id
     WHERE t.id = ? FOR UPDATE`,
    [taskId],
  );
  return rows[0] ?? null;
}

export async function findExistingAssignmentIds(executor, taskId, userIds) {
  const placeholders = userIds.map(() => '?').join(', ');
  const [rows] = await executor.execute(
    `SELECT user_id AS userId FROM task_assignments
     WHERE task_id = ? AND user_id IN (${placeholders})`,
    [taskId, ...userIds],
  );
  return rows.map((row) => row.userId);
}

export async function addAssignments(executor, taskId, userIds) {
  const values = userIds.map(() => '(?, ?)').join(', ');
  const parameters = userIds.flatMap((userId) => [taskId, userId]);
  await executor.execute(
    `INSERT INTO task_assignments (task_id, user_id) VALUES ${values}`,
    parameters,
  );
}

export async function findTask(executor, taskId) {
  const [rows] = await executor.execute(
    `SELECT t.id, t.title, t.description, ts.code AS status,
            t.created_by_user_id AS createdByUserId, t.archived_at AS archivedAt,
            t.created_at AS createdAt, t.updated_at AS updatedAt
     FROM tasks t JOIN task_statuses ts ON ts.id = t.task_status_id
     WHERE t.id = ?`,
    [taskId],
  );
  return rows[0] ?? null;
}

export async function findAssignments(executor, taskIds) {
  if (taskIds.length === 0) return [];
  const placeholders = taskIds.map(() => '?').join(', ');
  const [rows] = await executor.execute(
    `SELECT ta.task_id AS taskId, u.id AS userId, u.name, u.last_name AS lastName, u.email,
            ta.assigned_at AS assignedAt, ta.completed_at AS completedAt
     FROM task_assignments ta JOIN users u ON u.id = ta.user_id
     WHERE ta.task_id IN (${placeholders})
     ORDER BY ta.task_id, u.id`,
    taskIds,
  );
  return rows;
}

export async function listTasks(executor, status) {
  const parameters = [];
  let where = '';
  if (status) {
    where = 'WHERE ts.code = ?';
    parameters.push(status);
  }
  const [rows] = await executor.execute(
    `SELECT t.id, t.title, t.description, ts.code AS status,
            t.created_by_user_id AS createdByUserId, t.archived_at AS archivedAt,
            t.created_at AS createdAt, t.updated_at AS updatedAt
     FROM tasks t JOIN task_statuses ts ON ts.id = t.task_status_id
     ${where}
     ORDER BY t.created_at DESC, t.id DESC`,
    parameters,
  );
  return rows;
}

export async function isUserAssigned(executor, taskId, userId) {
  const [rows] = await executor.execute(
    'SELECT 1 FROM task_assignments WHERE task_id = ? AND user_id = ?',
    [taskId, userId],
  );
  return rows.length > 0;
}

export async function lockAssignment(executor, taskId, userId) {
  const [rows] = await executor.execute(
    `SELECT id, completed_at AS completedAt FROM task_assignments
     WHERE task_id = ? AND user_id = ? FOR UPDATE`,
    [taskId, userId],
  );
  return rows[0] ?? null;
}

export async function completeAssignment(executor, assignmentId) {
  await executor.execute(
    'UPDATE task_assignments SET completed_at = CURRENT_TIMESTAMP(3) WHERE id = ?',
    [assignmentId],
  );
  const [rows] = await executor.execute(
    'SELECT completed_at AS completedAt FROM task_assignments WHERE id = ?',
    [assignmentId],
  );
  return rows[0].completedAt;
}

export async function countPendingAssignments(executor, taskId) {
  const [rows] = await executor.execute(
    `SELECT COUNT(*) AS pendingCount FROM task_assignments
     WHERE task_id = ? AND completed_at IS NULL`,
    [taskId],
  );
  return Number(rows[0].pendingCount);
}

export async function archiveIfOpen(executor, taskId) {
  const [result] = await executor.execute(
    `UPDATE tasks t
     JOIN task_statuses current_status ON current_status.id = t.task_status_id
     JOIN task_statuses archived_status ON archived_status.code = 'archived'
     SET t.task_status_id = archived_status.id, t.archived_at = CURRENT_TIMESTAMP(3)
     WHERE t.id = ? AND current_status.code = 'open'`,
    [taskId],
  );
  return result.affectedRows === 1;
}

export async function createNotification(executor, taskId) {
  const [result] = await executor.execute(
    `INSERT INTO task_notifications (task_id, status) VALUES (?, 'pending')`,
    [taskId],
  );
  return result.insertId;
}

export async function listNotificationAttempts(executor, taskId) {
  const [rows] = await executor.execute(
    `SELECT n.id AS notificationId, n.status, n.created_at AS createdAt,
            n.delivered_at AS deliveredAt, a.attempt_number AS attemptNumber,
            a.attempted_at AS attemptedAt, a.http_status AS httpStatus,
            a.error_message AS errorMessage
     FROM task_notifications n
     LEFT JOIN notification_attempts a ON a.notification_id = n.id
     WHERE n.task_id = ?
     ORDER BY a.attempt_number`,
    [taskId],
  );
  return rows;
}
