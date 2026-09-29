-- Website visits, PDF report requests and lab activities shown on the landing page
-- Author: Khadim Gueye
-- Safe to run several times: it only adds what is missing and never removes data.

USE malaria_dashboard;
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS site_visits (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  visitor_id VARCHAR(64) NOT NULL,
  ip_hash CHAR(64) NULL,
  country_code VARCHAR(8) NULL,
  region VARCHAR(120) NULL,
  city VARCHAR(160) NULL,
  latitude DECIMAL(9, 5) NULL,
  longitude DECIMAL(9, 5) NULL,
  path VARCHAR(255) NOT NULL,
  referrer VARCHAR(255) NULL,
  device ENUM('desktop', 'mobile', 'tablet') NOT NULL DEFAULT 'desktop',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_visits_created (created_at),
  INDEX idx_visits_visitor (visitor_id, created_at)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS report_downloads (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  email VARCHAR(200) NOT NULL,
  organization VARCHAR(200) NULL,
  ip_address VARCHAR(45) NULL,
  country_code VARCHAR(8) NULL,
  region VARCHAR(120) NULL,
  city VARCHAR(160) NULL,
  latitude DECIMAL(9, 5) NULL,
  longitude DECIMAL(9, 5) NULL,
  page VARCHAR(255) NULL,
  user_agent VARCHAR(400) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_downloads_created (created_at),
  INDEX idx_downloads_email (email)
) ENGINE = InnoDB;

ALTER TABLE lab_activities
  ADD COLUMN IF NOT EXISTS category VARCHAR(80) NULL AFTER title,
  ADD COLUMN IF NOT EXISTS link_url VARCHAR(500) NULL AFTER image_url,
  ADD COLUMN IF NOT EXISTS is_featured TINYINT(1) NOT NULL DEFAULT 0 AFTER link_url,
  ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0 AFTER is_featured;

INSERT INTO lab_activities (title, category, description, image_url, link_url, is_featured, sort_order)
SELECT * FROM (
  SELECT
    'Sample collection across Nigerian states' AS title,
    'Fieldwork' AS category,
    'Blood samples from patients with malaria are collected with partner health facilities, then shipped to IGH for genomic analysis.' AS description,
    '/home/lab_33.jpg' AS image_url,
    NULL AS link_url,
    1 AS is_featured,
    1 AS sort_order
  UNION ALL SELECT 'Amplicon sequencing at IGH', 'Laboratory',
    'Parasite DNA is extracted and sequenced in the IGH laboratory to read the genes linked to drug and diagnostic resistance.',
    '/home/lab_8.jpg', NULL, 1, 2
  UNION ALL SELECT 'From sequences to policy signals', 'Data',
    'Bioinformatics pipelines turn raw reads into mutation frequencies that are compared with WHO thresholds on this dashboard.',
    '/home/lab_29.jpg', NULL, 1, 3
  UNION ALL SELECT 'ParaSight', 'Project',
    'A platform from the lab that brings malaria parasite genomic data together for researchers and public health teams.',
    '/home/lab_22.jpg', 'https://para-sight.org/', 0, 4
) seed
WHERE NOT EXISTS (SELECT 1 FROM lab_activities)
  AND NOT EXISTS (SELECT 1 FROM site_settings WHERE setting_key = 'migration.06_activities');

INSERT IGNORE INTO site_settings (setting_key, setting_value) VALUES ('migration.06_activities', '"done"');
