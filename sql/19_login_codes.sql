-- Sign-in codes sent by email to super admins (two-step sign-in, active once SMTP is set in connection.config)
-- Author: Khadim Gueye
-- Only hashes are stored, never the code itself.

USE malaria_dashboard;

CREATE TABLE IF NOT EXISTS admin_login_codes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  challenge_hash CHAR(64) NOT NULL,
  code_hash CHAR(64) NOT NULL,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_login_code_challenge (challenge_hash),
  INDEX idx_login_code_user (user_id, created_at),
  CONSTRAINT fk_login_code_user FOREIGN KEY (user_id) REFERENCES admin_users (id) ON DELETE CASCADE
) ENGINE = InnoDB;
