-- Projects and partners shown on the Projects page, and tabs that can be switched off
-- Author: Khadim Gueye
-- Safe to run several times: it only adds what is missing and never removes data.
-- The seeded entries are switched off: nothing is public until an admin turns them on.

USE malaria_dashboard;
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS partners (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kind ENUM('project', 'partner') NOT NULL DEFAULT 'partner',
  name VARCHAR(200) NOT NULL,
  description TEXT NULL,
  logo_url VARCHAR(500) NULL,
  link_url VARCHAR(500) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_visible TINYINT(1) NOT NULL DEFAULT 0,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  deleted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE = InnoDB;

INSERT INTO partners (kind, name, description, link_url, sort_order)
SELECT * FROM (
  SELECT 'project' AS kind,
         'ICEMR West-Central Africa (EMERGENTS)' AS name,
         'NIH-funded International Center of Excellence for Malaria Research studying malaria transmission in Nigeria and Cameroon with genomics and translational systems biology.' AS description,
         'https://www.niaid.nih.gov/research/west-central-africa-emergents-icemr' AS link_url,
         1 AS sort_order
  UNION ALL SELECT 'project', 'RV466', NULL, NULL, 2
  UNION ALL SELECT 'partner', 'National Malaria Elimination Programme (NMEP)', NULL, 'https://nmcp.gov.ng/', 1
  UNION ALL SELECT 'partner', 'Africa CDC', NULL, 'https://africacdc.org/', 2
  UNION ALL SELECT 'partner', 'PATH', NULL, 'https://www.path.org/', 3
) seed
WHERE NOT EXISTS (SELECT 1 FROM partners)
  AND NOT EXISTS (SELECT 1 FROM site_settings WHERE setting_key = 'migration.11_partners');

INSERT IGNORE INTO site_settings (setting_key, setting_value) VALUES ('nav.hidden', '["projects"]');
INSERT IGNORE INTO site_settings (setting_key, setting_value) VALUES ('migration.11_partners', '"done"');
