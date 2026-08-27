CREATE TABLE IF NOT EXISTS notification_attempts (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  notification_id BIGINT UNSIGNED NOT NULL,
  attempt_number SMALLINT UNSIGNED NOT NULL,
  attempted_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  http_status SMALLINT UNSIGNED NULL,
  error_message VARCHAR(500) NULL,
  CONSTRAINT uq_notification_attempt_number UNIQUE (notification_id, attempt_number),
  CONSTRAINT fk_notification_attempts_notification FOREIGN KEY (notification_id)
    REFERENCES task_notifications (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE = InnoDB;
