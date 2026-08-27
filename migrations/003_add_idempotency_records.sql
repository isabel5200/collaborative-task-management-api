CREATE TABLE IF NOT EXISTS idempotency_records (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  idempotency_key VARCHAR(255) NOT NULL,
  request_method VARCHAR(10) NOT NULL,
  request_path VARCHAR(255) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  state VARCHAR(20) NOT NULL,
  response_status SMALLINT UNSIGNED NULL,
  response_body JSON NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT uq_idempotency_request UNIQUE (idempotency_key, request_method, request_path),
  CONSTRAINT chk_idempotency_state CHECK (state IN ('processing', 'completed'))
) ENGINE = InnoDB;
