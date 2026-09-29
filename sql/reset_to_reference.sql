-- Removes every row added through the admin uploads and restores hidden reference rows.
-- Reference data (03_data.sql) has upload_id = NULL and is kept.
-- Accounts, audit log and site settings are kept.
-- Author: Khadim Gueye

USE malaria_dashboard;

START TRANSACTION;

DELETE FROM observations WHERE upload_id IS NOT NULL;
DELETE FROM species_observations WHERE upload_id IS NOT NULL;
DELETE FROM hrp_deletions WHERE upload_id IS NOT NULL;
DELETE FROM moi_distribution WHERE upload_id IS NOT NULL;
DELETE FROM mis_prevalence WHERE upload_id IS NOT NULL;
DELETE FROM publications WHERE upload_id IS NOT NULL;
DELETE FROM uploads;

UPDATE observations SET is_hidden = 0;
UPDATE species_observations SET is_hidden = 0;
UPDATE hrp_deletions SET is_hidden = 0;
UPDATE moi_distribution SET is_hidden = 0;
UPDATE mis_prevalence SET is_hidden = 0;
UPDATE publications SET is_hidden = 0;

DELETE FROM mutations
WHERE id NOT IN (SELECT DISTINCT mutation_id FROM observations);

DELETE FROM sequencing_batches
WHERE id NOT IN (SELECT sequencing_batch_id FROM observations WHERE sequencing_batch_id IS NOT NULL)
  AND id NOT IN (SELECT sequencing_batch_id FROM species_observations WHERE sequencing_batch_id IS NOT NULL)
  AND id NOT IN (SELECT sequencing_batch_id FROM hrp_deletions WHERE sequencing_batch_id IS NOT NULL)
  AND id NOT IN (SELECT sequencing_batch_id FROM moi_distribution);

COMMIT;
