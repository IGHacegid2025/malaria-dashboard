-- Owner account and default site settings
-- Author: Khadim Gueye
-- The owner (first super admin) cannot be modified by other admins.
-- Temporary password: admin (must be changed at first login).

USE malaria_dashboard;
SET NAMES utf8mb4;

INSERT INTO admin_users (email, password_hash, full_name, role, is_owner, is_active, must_change_password)
VALUES ('khadimg@run.edu.ng', '$2b$12$bfyV34J5h.cGfnF83XuWC.iu5CyEZpdorWZZd9xyN4x.ho5cl.skK', 'Khadim Gueye', 'super_admin', 1, 1, 1)
ON DUPLICATE KEY UPDATE email = email;

INSERT INTO site_settings (setting_key, setting_value) VALUES
  ('site.title', '"Malaria Genomic Surveillance"'),
  ('site.lab', '"Ify Aniebo Lab"'),
  ('site.institute', '"Institute of Genomics and Global Health, Nigeria"'),
  ('site.announcement', '""'),
  ('site.github_url', '"https://github.com/AnieboGenomicsLab"'),
  ('site.website_url', '"https://ighresearch.org/en/"'),
  ('site.public_url', '"https://para-sight.org/"'),
  ('site.default_year', '2021'),
  ('site.linkedin_url', '"https://www.linkedin.com/company/acegid-igh"'),
  ('site.about', '["The concept of the molecular surveillance reporting tool (dashboard) was developed by Dr. Ifeyinwa Aniebo in her role as Principal Investigator (PI), a Calestous Juma Science Leadership Fellow, and Associate Professor of Molecular Biology and Genomics from a 5 year grant funding from the Bill and Melinda Gates Foundation.", "The dashboard is maintained by laboratory team members Dr. Vera Mitesser, Khadim Gueye, John Openibo, affiliated with the Institute for Genomics and Global Health, Redeemer''s University, Ede, Nigeria under the lead of Prof. Christian Happi."]'),
  ('theme.primary', '"#2a78d6"'),
  ('theme.hero_from', '"#0d366b"'),
  ('theme.hero_via', '"#184f95"'),
  ('theme.hero_to', '"#0f7a5c"'),
  ('theme.status_high', '"#d03b3b"'),
  ('theme.status_watch', '"#fab219"'),
  ('theme.status_low', '"#0ca30c"'),
  ('theme.tile_1', '"#2a78d6"'),
  ('theme.tile_2', '"#1baf7a"'),
  ('theme.tile_3', '"#d03b3b"'),
  ('theme.tile_4', '"#eb6834"'),
  ('theme.map_color', '"#0d366b"'),
  ('theme.font_scale', '1'),
  ('size.title', '30'),
  ('size.kpi', '26'),
  ('size.card_value', '26'),
  ('size.card_title', '16'),
  ('size.panel_title', '15'),
  ('size.map', '400'),
  ('size.trend_chart', '270'),
  ('size.trend_map', '270'),
  ('size.ranking', '300'),
  ('size.explorer_map', '560'),
  ('theme.page_bg', '"#f4f5f7"'),
  ('hero.mode', '"gradient"'),
  ('hero.color', '"#0d366b"'),
  ('hero.media_url', '""'),
  ('hero.overlay', '0.45')
ON DUPLICATE KEY UPDATE setting_key = setting_key;
