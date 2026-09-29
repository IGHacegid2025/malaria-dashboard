-- Malaria Dashboard tables
-- Author: Khadim Gueye

USE malaria_dashboard;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS admin_login_codes;
DROP TABLE IF EXISTS partners;
DROP TABLE IF EXISTS site_visits;
DROP TABLE IF EXISTS report_downloads;
DROP TABLE IF EXISTS team_members;
DROP TABLE IF EXISTS site_settings;
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS alert_levels;
DROP TABLE IF EXISTS alert_rules;
DROP TABLE IF EXISTS mis_prevalence;
DROP TABLE IF EXISTS moi_distribution;
DROP TABLE IF EXISTS hrp_deletions;
DROP TABLE IF EXISTS species_observations;
DROP TABLE IF EXISTS observations;
DROP TABLE IF EXISTS mutations;
DROP TABLE IF EXISTS genes;
DROP TABLE IF EXISTS sequencing_batches;
DROP TABLE IF EXISTS publications;
DROP TABLE IF EXISTS uploads;
DROP TABLE IF EXISTS states;
DROP TABLE IF EXISTS lab_activities;
DROP TABLE IF EXISTS articles;
DROP TABLE IF EXISTS admin_users;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE admin_users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(200) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(200) NULL,
  role ENUM('super_admin', 'admin') NOT NULL DEFAULT 'admin',
  is_owner TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  must_change_password TINYINT(1) NOT NULL DEFAULT 1,
  failed_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  last_login_at DATETIME NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_creator FOREIGN KEY (created_by) REFERENCES admin_users (id) ON DELETE SET NULL
) ENGINE = InnoDB;

CREATE TABLE audit_log (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NULL,
  user_email VARCHAR(200) NULL,
  action VARCHAR(60) NOT NULL,
  entity VARCHAR(60) NULL,
  entity_id VARCHAR(60) NULL,
  details LONGTEXT NULL,
  ip_address VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_created (created_at),
  KEY idx_audit_user (user_id),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES admin_users (id) ON DELETE SET NULL
) ENGINE = InnoDB;

CREATE TABLE uploads (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NULL,
  kind VARCHAR(40) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  rows_inserted INT UNSIGNED NOT NULL DEFAULT 0,
  is_hidden TINYINT(1) NOT NULL DEFAULT 0,
  summary LONGTEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_upload_created (created_at),
  CONSTRAINT fk_upload_user FOREIGN KEY (user_id) REFERENCES admin_users (id) ON DELETE SET NULL
) ENGINE = InnoDB;

CREATE TABLE site_settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  setting_value LONGTEXT NOT NULL,
  updated_by INT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_setting_user FOREIGN KEY (updated_by) REFERENCES admin_users (id) ON DELETE SET NULL
) ENGINE = InnoDB;

CREATE TABLE states (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code CHAR(2) NOT NULL UNIQUE,
  name VARCHAR(50) NOT NULL UNIQUE
) ENGINE = InnoDB;

CREATE TABLE publications (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  author VARCHAR(200) NOT NULL,
  year_of_publication SMALLINT UNSIGNED NOT NULL,
  doi VARCHAR(200) NULL,
  title TEXT NULL,
  upload_id INT UNSIGNED NULL,
  is_hidden TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_publication_doi (doi),
  KEY idx_publication_author (author, year_of_publication),
  CONSTRAINT fk_publication_upload FOREIGN KEY (upload_id) REFERENCES uploads (id)
) ENGINE = InnoDB;

CREATE TABLE sequencing_batches (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  state_id INT UNSIGNED NOT NULL,
  year SMALLINT UNSIGNED NOT NULL,
  UNIQUE KEY uq_batch (state_id, year),
  CONSTRAINT fk_batch_state FOREIGN KEY (state_id) REFERENCES states (id)
) ENGINE = InnoDB;

CREATE TABLE genes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
) ENGINE = InnoDB;

CREATE TABLE mutations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  gene_id INT UNSIGNED NOT NULL,
  mutation_code VARCHAR(100) NOT NULL,
  UNIQUE KEY uq_mutation (gene_id, mutation_code),
  CONSTRAINT fk_mutation_gene FOREIGN KEY (gene_id) REFERENCES genes (id)
) ENGINE = InnoDB;

CREATE TABLE observations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  mutation_id INT UNSIGNED NOT NULL,
  state_id INT UNSIGNED NOT NULL,
  year SMALLINT UNSIGNED NOT NULL,
  source_type ENUM('publication', 'sequencing') NOT NULL,
  publication_id INT UNSIGNED NULL,
  sequencing_batch_id INT UNSIGNED NULL,
  city VARCHAR(100) NULL,
  prevalence DECIMAL(9, 6) NOT NULL,
  sample_count INT UNSIGNED NULL,
  upload_id INT UNSIGNED NULL,
  is_hidden TINYINT(1) NOT NULL DEFAULT 0,
  KEY idx_obs_state_year (state_id, year),
  KEY idx_obs_mutation (mutation_id),
  KEY idx_obs_upload (upload_id),
  CONSTRAINT fk_obs_mutation FOREIGN KEY (mutation_id) REFERENCES mutations (id),
  CONSTRAINT fk_obs_state FOREIGN KEY (state_id) REFERENCES states (id),
  CONSTRAINT fk_obs_publication FOREIGN KEY (publication_id) REFERENCES publications (id),
  CONSTRAINT fk_obs_batch FOREIGN KEY (sequencing_batch_id) REFERENCES sequencing_batches (id),
  CONSTRAINT fk_obs_upload FOREIGN KEY (upload_id) REFERENCES uploads (id),
  CONSTRAINT chk_obs_prevalence CHECK (prevalence BETWEEN 0 AND 1),
  CONSTRAINT chk_obs_source CHECK (
    (source_type = 'publication' AND publication_id IS NOT NULL AND sequencing_batch_id IS NULL) OR
    (source_type = 'sequencing' AND sequencing_batch_id IS NOT NULL AND publication_id IS NULL)
  )
) ENGINE = InnoDB;

CREATE TABLE species_observations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  state_id INT UNSIGNED NOT NULL,
  year SMALLINT UNSIGNED NOT NULL,
  source_type ENUM('publication', 'sequencing') NOT NULL,
  publication_id INT UNSIGNED NULL,
  sequencing_batch_id INT UNSIGNED NULL,
  species_combination VARCHAR(50) NOT NULL,
  sample_count INT UNSIGNED NOT NULL,
  upload_id INT UNSIGNED NULL,
  is_hidden TINYINT(1) NOT NULL DEFAULT 0,
  KEY idx_species_state_year (state_id, year),
  CONSTRAINT fk_species_state FOREIGN KEY (state_id) REFERENCES states (id),
  CONSTRAINT fk_species_publication FOREIGN KEY (publication_id) REFERENCES publications (id),
  CONSTRAINT fk_species_batch FOREIGN KEY (sequencing_batch_id) REFERENCES sequencing_batches (id),
  CONSTRAINT fk_species_upload FOREIGN KEY (upload_id) REFERENCES uploads (id),
  CONSTRAINT chk_species_source CHECK (
    (source_type = 'publication' AND publication_id IS NOT NULL AND sequencing_batch_id IS NULL) OR
    (source_type = 'sequencing' AND sequencing_batch_id IS NOT NULL AND publication_id IS NULL)
  )
) ENGINE = InnoDB;

CREATE TABLE hrp_deletions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  state_id INT UNSIGNED NOT NULL,
  year SMALLINT UNSIGNED NOT NULL,
  source_type ENUM('publication', 'sequencing') NOT NULL,
  publication_id INT UNSIGNED NULL,
  sequencing_batch_id INT UNSIGNED NULL,
  deletion_type ENUM('hrp2', 'hrp3', 'dual', 'none') NOT NULL,
  any_hrp_mutation TINYINT(1) NULL,
  location VARCHAR(255) NULL,
  sample_count INT UNSIGNED NOT NULL,
  upload_id INT UNSIGNED NULL,
  is_hidden TINYINT(1) NOT NULL DEFAULT 0,
  KEY idx_hrp_state_year (state_id, year),
  CONSTRAINT fk_hrp_state FOREIGN KEY (state_id) REFERENCES states (id),
  CONSTRAINT fk_hrp_publication FOREIGN KEY (publication_id) REFERENCES publications (id),
  CONSTRAINT fk_hrp_batch FOREIGN KEY (sequencing_batch_id) REFERENCES sequencing_batches (id),
  CONSTRAINT fk_hrp_upload FOREIGN KEY (upload_id) REFERENCES uploads (id),
  CONSTRAINT chk_hrp_source CHECK (
    (source_type = 'publication' AND publication_id IS NOT NULL AND sequencing_batch_id IS NULL) OR
    (source_type = 'sequencing' AND sequencing_batch_id IS NOT NULL AND publication_id IS NULL)
  )
) ENGINE = InnoDB;

CREATE TABLE moi_distribution (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sequencing_batch_id INT UNSIGNED NOT NULL,
  moi_value TINYINT UNSIGNED NOT NULL,
  sample_count INT UNSIGNED NOT NULL,
  upload_id INT UNSIGNED NULL,
  is_hidden TINYINT(1) NOT NULL DEFAULT 0,
  KEY idx_moi_batch (sequencing_batch_id, moi_value),
  CONSTRAINT fk_moi_batch FOREIGN KEY (sequencing_batch_id) REFERENCES sequencing_batches (id),
  CONSTRAINT fk_moi_upload FOREIGN KEY (upload_id) REFERENCES uploads (id)
) ENGINE = InnoDB;

CREATE TABLE mis_prevalence (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  state_id INT UNSIGNED NOT NULL,
  year SMALLINT UNSIGNED NOT NULL,
  prevalence DECIMAL(9, 6) NOT NULL,
  upload_id INT UNSIGNED NULL,
  is_hidden TINYINT(1) NOT NULL DEFAULT 0,
  KEY idx_mis_state_year (state_id, year),
  CONSTRAINT fk_mis_state FOREIGN KEY (state_id) REFERENCES states (id),
  CONSTRAINT fk_mis_upload FOREIGN KEY (upload_id) REFERENCES uploads (id),
  CONSTRAINT chk_mis_prevalence CHECK (prevalence BETWEEN 0 AND 1)
) ENGINE = InnoDB;

CREATE TABLE alert_rules (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  gene VARCHAR(50) NOT NULL,
  mutation_pattern VARCHAR(100) NOT NULL,
  antimalarial VARCHAR(100) NULL,
  resistance_level VARCHAR(50) NULL,
  reference_text TEXT NULL,
  UNIQUE KEY uq_alert_rule (gene, mutation_pattern)
) ENGINE = InnoDB;

CREATE TABLE alert_levels (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  alert_rule_id INT UNSIGNED NOT NULL,
  level_order TINYINT UNSIGNED NOT NULL,
  max_prevalence DECIMAL(9, 6) NOT NULL,
  classification ENUM('low', 'intermediate', 'high') NOT NULL,
  guideline TEXT NULL,
  message TEXT NULL,
  summary VARCHAR(255) NULL,
  UNIQUE KEY uq_alert_level (alert_rule_id, level_order),
  CONSTRAINT fk_level_rule FOREIGN KEY (alert_rule_id) REFERENCES alert_rules (id) ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE articles (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title TEXT NOT NULL,
  authors VARCHAR(500) NULL,
  journal VARCHAR(200) NULL,
  year SMALLINT UNSIGNED NULL,
  doi VARCHAR(200) NULL,
  url VARCHAR(500) NULL,
  abstract TEXT NULL,
  is_hidden TINYINT(1) NOT NULL DEFAULT 0,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_article_user FOREIGN KEY (created_by) REFERENCES admin_users (id) ON DELETE SET NULL
) ENGINE = InnoDB;

CREATE TABLE lab_activities (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  activity_date DATE NULL,
  image_url VARCHAR(500) NULL,
  is_hidden TINYINT(1) NOT NULL DEFAULT 0,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_activity_user FOREIGN KEY (created_by) REFERENCES admin_users (id) ON DELETE SET NULL
) ENGINE = InnoDB;
