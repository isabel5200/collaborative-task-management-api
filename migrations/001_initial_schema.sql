CREATE TABLE
  roles (
    id SMALLINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(50) NOT NULL
  ) ENGINE = InnoDB;


CREATE TABLE
  task_statuses (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(50) NOT NULL
  ) ENGINE = InnoDB;


CREATE TABLE
  users (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    role_id SMALLINT UNSIGNED NOT NULL,
    name VARCHAR(80) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(254) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE RESTRICT ON UPDATE RESTRICT
  ) ENGINE = InnoDB;


CREATE TABLE
  tasks (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(100) NOT NULL,
    description TEXT NULL,
    task_status_id INT UNSIGNED NOT NULL DEFAULT 1,
    created_by_user_id INT UNSIGNED NOT NULL,
    archived_at TIMESTAMP(3) NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_tasks_status FOREIGN KEY (task_status_id) REFERENCES task_statuses (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_tasks_creator FOREIGN KEY (created_by_user_id) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT
  ) ENGINE = InnoDB;


CREATE TABLE
  task_assignments (
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    task_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    assigned_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    completed_at TIMESTAMP(3) NULL,
    CONSTRAINT uq_task_assignments_task_user UNIQUE (task_id, user_id),
    INDEX idx_task_assignments_user (user_id),
    INDEX idx_task_assignments_pending (task_id, completed_at),
    CONSTRAINT fk_task_assignments_task FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_task_assignments_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT
  ) ENGINE = InnoDB;


CREATE TABLE
  task_notifications (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    task_id INT UNSIGNED NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    delivered_at TIMESTAMP(3) NULL,
    CONSTRAINT fk_task_notifications_task FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT chk_task_notifications_status CHECK (status IN ('pending', 'delivered', 'failed'))
  ) ENGINE = InnoDB;