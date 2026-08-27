export async function recordAttempt(executor, attempt) {
  await executor.execute(
    `INSERT INTO notification_attempts
      (notification_id, attempt_number, http_status, error_message)
     VALUES (?, ?, ?, ?)`,
    [attempt.notificationId, attempt.attemptNumber, attempt.httpStatus, attempt.errorMessage],
  );
}

export async function markDelivered(executor, notificationId) {
  await executor.execute(
    `UPDATE task_notifications
     SET status = 'delivered', delivered_at = CURRENT_TIMESTAMP(3)
     WHERE id = ? AND status = 'pending'`,
    [notificationId],
  );
}

export async function markFailed(executor, notificationId) {
  await executor.execute(
    `UPDATE task_notifications SET status = 'failed'
     WHERE id = ? AND status = 'pending'`,
    [notificationId],
  );
}
