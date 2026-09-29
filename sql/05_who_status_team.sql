-- WHO status of alert rules and team members
-- Author: Khadim Gueye
-- Safe to run several times: it only adds what is missing and never removes data.
-- WHO statuses are set on the first run only, so later edits made in the admin area are kept.

USE malaria_dashboard;
SET NAMES utf8mb4;

ALTER TABLE alert_rules
  ADD COLUMN IF NOT EXISTS who_status ENUM('validated', 'candidate', 'none') NOT NULL DEFAULT 'none' AFTER mutation_pattern;

UPDATE alert_rules r
SET r.who_status = 'validated'
WHERE r.who_status = 'none' AND NOT EXISTS (SELECT 1 FROM site_settings WHERE setting_key = 'migration.05_who_status')
  AND EXISTS (SELECT 1 FROM alert_levels l WHERE l.alert_rule_id = r.id AND l.message LIKE '%validated mutation%');

UPDATE alert_rules r
SET r.who_status = 'candidate'
WHERE r.who_status = 'none' AND NOT EXISTS (SELECT 1 FROM site_settings WHERE setting_key = 'migration.05_who_status')
  AND EXISTS (SELECT 1 FROM alert_levels l WHERE l.alert_rule_id = r.id AND l.message LIKE '%candidate mutation%');

UPDATE alert_rules SET who_status = 'none' WHERE mutation_pattern = '*' AND NOT EXISTS (SELECT 1 FROM site_settings WHERE setting_key = 'migration.05_who_status');

UPDATE alert_rules SET who_status = 'validated'
WHERE NOT EXISTS (SELECT 1 FROM site_settings WHERE setting_key = 'migration.05_who_status') AND gene = 'kelch13' AND mutation_pattern IN ('F446I', 'N458Y', 'C469Y', 'M476I', 'Y493H', 'R539T', 'I543T', 'P553L', 'R561H', 'P574L', 'C580Y', 'R622I', 'A675V');

UPDATE alert_rules SET who_status = 'candidate'
WHERE NOT EXISTS (SELECT 1 FROM site_settings WHERE setting_key = 'migration.05_who_status') AND gene = 'kelch13' AND mutation_pattern IN ('P441L', 'G449A', 'C469F', 'A481V', 'R515K', 'P527H', 'N537I', 'N537D', 'G538V', 'V568G');

CREATE TABLE IF NOT EXISTS team_members (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  title VARCHAR(255) NULL,
  affiliation VARCHAR(255) NULL,
  bio TEXT NULL,
  photo_url VARCHAR(500) NULL,
  email VARCHAR(200) NULL,
  is_lead TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  is_hidden TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE = InnoDB;

INSERT INTO team_members (name, title, affiliation, bio, photo_url, is_lead, sort_order)
SELECT * FROM (
  SELECT
    'Dr. Ify Aniebo' AS name,
    'PI - Malaria team' AS title,
    'Associate Professor of Molecular Biology and Genomics, Calestous Juma Science Leadership Fellow' AS affiliation,
    'Dr. Ifeyinwa Aniebo developed the concept of this molecular surveillance reporting tool as Principal Investigator, with a five-year grant from the Bill and Melinda Gates Foundation. Her lab at the Institute of Genomics and Global Health tracks antimalarial drug resistance and diagnostic resistance across Nigeria.' AS bio,
    '/team/ify_aniebo.jpg' AS photo_url,
    1 AS is_lead,
    0 AS sort_order
  UNION ALL SELECT 'Dr. Vera Mitesser', 'Laboratory team member', 'Institute of Genomics and Global Health, Redeemer''s University', NULL, '/team/vera_mitesser.jpg', 0, 1
  UNION ALL SELECT 'Khadim Gueye', 'Senior Bioinformatician', 'Institute of Genomics and Global Health, Redeemer''s University', NULL, '/team/khadim_gueye.jpg', 0, 2
  UNION ALL SELECT 'John Openibo', 'Laboratory team member', 'Institute of Genomics and Global Health, Redeemer''s University', NULL, '/team/john_openibo.jpg', 0, 3
) seed
WHERE NOT EXISTS (SELECT 1 FROM team_members);

INSERT INTO site_settings (setting_key, setting_value) VALUES ('migration.05_who_status', '"done"')
ON DUPLICATE KEY UPDATE setting_key = setting_key;
