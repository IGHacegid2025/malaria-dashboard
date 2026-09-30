-- Requested by Dr. Ify Aniebo (30 September 2026): PATH logo on the TES project, and a separate project for the
-- Nigeria Malaria Indicator Survey led by NMEP, Federal Ministry of Health, placed right after TES
-- Author: Khadim Gueye
-- Runs once: skipped if the NMIS project already exists. Changes are recorded in the audit log.

USE malaria_dashboard;
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

SET @tes = (SELECT id FROM partners WHERE name = 'NMEP/PATH Malaria Therapeutic Efficacy Study (TES)' LIMIT 1);

INSERT INTO audit_log (user_id, user_email, action, entity, entity_id, details)
SELECT NULL, 'migration 20', 'partner_updated', 'partner', id,
       JSON_OBJECT('before', JSON_OBJECT('logo_url', logo_url), 'after', JSON_OBJECT('logo_url', '/api/media/logo_path.png'))
FROM partners WHERE id = @tes AND logo_url = '/api/media/logo_nmep.png';

UPDATE partners SET logo_url = '/api/media/logo_path.png' WHERE id = @tes AND logo_url = '/api/media/logo_nmep.png';

SET @name = 'Nigeria Malaria Indicator Survey (NMIS)';
SET @missing = (SELECT COUNT(*) = 0 FROM partners WHERE name = @name);
SET @after = COALESCE((SELECT sort_order FROM partners WHERE id = @tes), (SELECT MAX(sort_order) FROM partners WHERE kind = 'project'), 0);
SET @visible = (SELECT COALESCE(MAX(is_visible), 0) FROM partners WHERE kind = 'project' AND is_deleted = 0);

UPDATE partners SET sort_order = sort_order + 1 WHERE kind = 'project' AND sort_order > @after AND @missing;

INSERT INTO partners (kind, name, description, logo_url, link_url, sort_order, is_visible)
SELECT 'project', @name,
       'The national household survey led by the National Malaria Elimination Programme (NMEP), Federal Ministry of Health. The lab handled the genomic part of the survey in 2021 and 2025, to track resistance to commonly used antimalarials, hrp2/3 gene deletions and Plasmodium genetic diversity.',
       '/api/media/logo_nmep.png', 'https://nmcp.gov.ng/', @after + 1, @visible
FROM DUAL WHERE @missing;

INSERT INTO audit_log (user_id, user_email, action, entity, entity_id, details)
SELECT NULL, 'migration 20', 'partner_created', 'partner', id, JSON_OBJECT('name', name)
FROM partners WHERE name = @name AND @missing;
