-- Downloads made from the Map page just before migration 16 were saved as PDF reports: the Map page only offers data files
-- Author: Khadim Gueye
-- Only touches those rows, and records the change in the audit log.

USE malaria_dashboard;
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO audit_log (user_id, user_email, action, entity, entity_id, details)
SELECT NULL, 'migration 17', 'download_type_corrected', 'report_downloads', id,
       JSON_OBJECT('before', JSON_OBJECT('kind', kind, 'label', label), 'after', JSON_OBJECT('kind', 'data', 'label', 'Map data, details not recorded'))
FROM report_downloads WHERE page LIKE '/map%' AND kind = 'report' AND label IS NULL;

UPDATE report_downloads SET kind = 'data', label = 'Map data, details not recorded'
WHERE page LIKE '/map%' AND kind = 'report' AND label IS NULL;
