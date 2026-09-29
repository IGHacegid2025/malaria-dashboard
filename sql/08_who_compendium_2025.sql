-- WHO status of resistance markers aligned with the WHO Compendium of molecular markers
-- for antimalarial drug resistance (version 1.0, December 2025), and fixes in alert messages.
-- Author: Khadim Gueye
-- Safe to run several times. Status changes are applied on the first run only, so later
-- edits made in the admin area are kept.

USE malaria_dashboard;
SET NAMES utf8mb4;

UPDATE alert_levels SET message = REPLACE(message, 'artemsisin', 'artemisinin') WHERE message LIKE '%artemsisin%';
UPDATE alert_levels SET message = REPLACE(message, 'sufficent', 'sufficient') WHERE message LIKE '%sufficent%';
UPDATE alert_levels SET summary = REPLACE(summary, 'pyrimthamine', 'pyrimethamine') WHERE summary LIKE '%pyrimthamine%';

UPDATE alert_levels l JOIN alert_rules r ON r.id = l.alert_rule_id
SET l.message = 'This molecular marker is a candidate mutation for artemisinin partial resistance as classified by WHO. It is present at low prevalence in this region. Artemisinin might no longer be active.'
WHERE r.gene = 'kelch13' AND r.mutation_pattern = 'P441L' AND l.message LIKE '%validated mutation%';

UPDATE alert_levels l JOIN alert_rules r ON r.id = l.alert_rule_id
SET l.message = REPLACE(l.message,
  'is a candidate mutation for artemisinin partial resistance as classified by WHO.',
  'was listed by WHO as a candidate marker of artemisinin partial resistance until 2025; it is now considered a potential marker, as the evidence is not yet sufficient.')
WHERE r.gene = 'kelch13' AND r.mutation_pattern IN ('G449A', 'A481V', 'R515K', 'P527H', 'N537D')
  AND NOT EXISTS (SELECT 1 FROM site_settings WHERE setting_key = 'migration.08_who_compendium_2025');

UPDATE alert_rules SET who_status = 'none'
WHERE gene = 'kelch13' AND mutation_pattern IN ('G449A', 'A481V', 'R515K', 'P527H', 'N537D')
  AND NOT EXISTS (SELECT 1 FROM site_settings WHERE setting_key = 'migration.08_who_compendium_2025');

UPDATE alert_rules SET who_status = 'validated'
WHERE ((gene = 'crt' AND mutation_pattern = 'K76T')
    OR (gene = 'mdr1' AND mutation_pattern = 'N86Y')
    OR (gene = 'psfr' AND mutation_pattern IN ('A437G-N51I-C59R-S108N', 'A437G-K540E-N51I-C59R-S108N')))
  AND NOT EXISTS (SELECT 1 FROM site_settings WHERE setting_key = 'migration.08_who_compendium_2025');

UPDATE alert_rules SET who_status = 'candidate'
WHERE gene = 'psfr' AND mutation_pattern = 'A437G-K540E-A581G-N51I-C59R-S108N'
  AND NOT EXISTS (SELECT 1 FROM site_settings WHERE setting_key = 'migration.08_who_compendium_2025');

INSERT INTO alert_rules (gene, mutation_pattern, who_status, antimalarial, resistance_level, reference_text)
SELECT gene, 'G533S', 'validated', antimalarial, resistance_level, reference_text
FROM alert_rules
WHERE gene = 'kelch13' AND mutation_pattern = 'C580Y'
  AND NOT EXISTS (SELECT 1 FROM alert_rules WHERE gene = 'kelch13' AND mutation_pattern = 'G533S')
LIMIT 1;

INSERT INTO alert_levels (alert_rule_id, level_order, max_prevalence, classification, guideline, message, summary)
SELECT n.id, l.level_order, l.max_prevalence, l.classification, l.guideline, l.message, l.summary
FROM alert_rules n
JOIN alert_rules src ON src.gene = 'kelch13' AND src.mutation_pattern = 'C580Y'
JOIN alert_levels l ON l.alert_rule_id = src.id
WHERE n.gene = 'kelch13' AND n.mutation_pattern = 'G533S'
  AND NOT EXISTS (SELECT 1 FROM alert_levels x WHERE x.alert_rule_id = n.id);

INSERT INTO alert_rules (gene, mutation_pattern, who_status, antimalarial, resistance_level, reference_text)
SELECT gene, 'E252Q', 'candidate', antimalarial, resistance_level, reference_text
FROM alert_rules
WHERE gene = 'kelch13' AND mutation_pattern = 'P441L'
  AND NOT EXISTS (SELECT 1 FROM alert_rules WHERE gene = 'kelch13' AND mutation_pattern = 'E252Q')
LIMIT 1;

INSERT INTO alert_levels (alert_rule_id, level_order, max_prevalence, classification, guideline, message, summary)
SELECT n.id, l.level_order, l.max_prevalence, l.classification, l.guideline, l.message, l.summary
FROM alert_rules n
JOIN alert_rules src ON src.gene = 'kelch13' AND src.mutation_pattern = 'P441L'
JOIN alert_levels l ON l.alert_rule_id = src.id
WHERE n.gene = 'kelch13' AND n.mutation_pattern = 'E252Q'
  AND NOT EXISTS (SELECT 1 FROM alert_levels x WHERE x.alert_rule_id = n.id);

INSERT IGNORE INTO site_settings (setting_key, setting_value) VALUES ('migration.08_who_compendium_2025', '"done"');
