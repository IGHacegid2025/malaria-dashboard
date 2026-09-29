-- The photo of the "From sequences to policy signals" activity shows microscopy work: text updated to match it
-- Author: Khadim Gueye
-- Only changes the activity if it still has its original text, and records the change in the audit log.

USE malaria_dashboard;
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

SET @old_title = 'From sequences to policy signals';
SET @old_text = 'Bioinformatics pipelines turn raw reads into mutation frequencies that are compared with WHO thresholds on this dashboard.';
SET @new_title = 'Reading blood smears under the microscope';
SET @new_text = 'Stained blood smears are examined under the microscope to confirm malaria infection and identify the Plasmodium species before the samples go to sequencing.';
SET @id = (SELECT id FROM lab_activities WHERE title = @old_title AND description = @old_text AND image_url = '/home/lab_29.jpg' LIMIT 1);

INSERT INTO audit_log (user_id, user_email, action, entity, entity_id, details)
SELECT NULL, 'migration 13', 'activity_updated', 'activity', @id,
       JSON_OBJECT('before', JSON_OBJECT('title', @old_title, 'category', 'Data', 'description', @old_text),
                   'after', JSON_OBJECT('title', @new_title, 'category', 'Laboratory', 'description', @new_text))
FROM DUAL WHERE @id IS NOT NULL;

UPDATE lab_activities SET title = @new_title, category = 'Laboratory', description = @new_text WHERE id = @id;
