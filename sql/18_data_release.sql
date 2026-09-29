-- First data release number for the citation, the footer and the PDF report (can be changed in Site settings)
-- Author: Khadim Gueye
-- Only adds the values if they were never set.

USE malaria_dashboard;

INSERT IGNORE INTO site_settings (setting_key, setting_value) VALUES ('site.data_release', '"2026.1"');
INSERT IGNORE INTO site_settings (setting_key, setting_value) VALUES ('site.data_release_date', '"2026-09-29"');
