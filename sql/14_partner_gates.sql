-- Gates Foundation added as the first partner
-- Author: Khadim Gueye
-- Runs once: skipped if a Gates Foundation entry already exists.

USE malaria_dashboard;
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

SET @missing = (SELECT COUNT(*) = 0 FROM partners WHERE name = 'Gates Foundation');
SET @visible = (SELECT COALESCE(MAX(is_visible), 0) FROM partners WHERE kind = 'partner' AND is_deleted = 0);

UPDATE partners SET sort_order = sort_order + 1 WHERE kind = 'partner' AND @missing;

INSERT INTO partners (kind, name, description, logo_url, link_url, sort_order, is_visible)
SELECT 'partner', 'Gates Foundation', NULL, '/api/media/logo_gates.svg', 'https://www.gatesfoundation.org/', 1, @visible
FROM DUAL WHERE @missing;
