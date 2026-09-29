-- Project descriptions provided by Dr. Ify Aniebo, with the matching partner logos
-- Author: Khadim Gueye
-- Runs once (guarded by migration.12_projects). Previous ICEMR text:
-- "NIH-funded International Center of Excellence for Malaria Research studying malaria transmission
--  in Nigeria and Cameroon with genomics and translational systems biology."

USE malaria_dashboard;
SET NAMES utf8mb4;

UPDATE partners p
JOIN (SELECT COUNT(*) AS n FROM site_settings WHERE setting_key = 'migration.12_projects') g ON g.n = 0
SET p.logo_url = CASE p.name
      WHEN 'National Malaria Elimination Programme (NMEP)' THEN '/api/media/logo_nmep.png'
      WHEN 'Africa CDC' THEN '/api/media/logo_africacdc.png'
      WHEN 'PATH' THEN '/api/media/logo_path.png'
    END
WHERE p.kind = 'partner' AND (p.logo_url IS NULL OR p.logo_url = '')
  AND p.name IN ('National Malaria Elimination Programme (NMEP)', 'Africa CDC', 'PATH');

UPDATE partners p
JOIN (SELECT COUNT(*) AS n FROM site_settings WHERE setting_key = 'migration.12_projects') g ON g.n = 0
SET p.name = 'Malaria MDR RV466/EID005 Study',
    p.sort_order = 1,
    p.description = 'A retrospective genomic surveillance study of antimalarial drug resistance that supports the World Health Organization’s Global Technical Strategy for Malaria 2016-2030 by addressing one of the most critical challenges to malaria eradication: the emergence and spread of antimalarial drug resistance. The project aims to detect and characterize resistance-associated mutations in malaria-positive samples and to inform strategies for reducing the malaria burden.'
WHERE p.kind = 'project' AND p.name = 'RV466';

UPDATE partners p
JOIN (SELECT COUNT(*) AS n FROM site_settings WHERE setting_key = 'migration.12_projects') g ON g.n = 0
SET p.sort_order = 4,
    p.description = 'Genomic epidemiological mapping of both falciparum and non-falciparum malaria (P. vivax, P. ovale and P. malariae) to describe and quantify the parasite reservoir using quantitative PCR.'
WHERE p.kind = 'project' AND p.name = 'ICEMR West-Central Africa (EMERGENTS)';

INSERT INTO partners (kind, name, description, logo_url, link_url, sort_order, is_visible)
SELECT * FROM (
  SELECT 'project' AS kind,
         'Africa CDC Malaria Molecular Surveillance (ACDC-MMS)' AS name,
         'A study led by the Africa CDC Pathogen Genomics Initiative (PGI) to strengthen surveillance of malaria drug and diagnostic resistance in 10 African countries: Nigeria, Ethiopia, Rwanda, Namibia, Uganda, Mozambique, Burundi, Tanzania, Angola and DRC. Through a coordinated review involving technical experts, users across the continent, the World Health Organization (WHO), other international stakeholders and developers, nine assays that best align with the Target Product Profile (TPP) criteria were recommended for broader adoption. Of these, MAD4HatTeR (Illumina) and NOMADS (Oxford Nanopore) came closest to the TPP standards for malaria molecular surveillance in African public health institutions. Following hands-on training on the two adopted protocols, they will be used to sequence 1,000 samples per country for drug and diagnostic resistance genes.' AS description,
         '/api/media/logo_africacdc.png' AS logo_url,
         'https://africacdc.org/' AS link_url,
         2 AS sort_order,
         COALESCE((SELECT MAX(v.is_visible) FROM partners v WHERE v.kind = 'project' AND v.is_deleted = 0), 0) AS is_visible
  UNION ALL SELECT 'project',
         'NMEP/PATH Malaria Therapeutic Efficacy Study (TES)',
         'A molecular study assessing the efficacy of the antimalarial drugs currently used in Nigeria. It determines the population structure of infections and distinguishes recrudescence from reinfection using pfmsp1, pfmsp2 and two WHO-approved markers, pfta1 and pfpolya. It also identifies the circulating SNPs in the drug resistance markers pfcrt, pfmdr1, pfdhps, pfdhfr and pfkelch13, and evaluates hrp2/3 gene deletions in circulating parasites.',
         '/api/media/logo_nmep.png',
         NULL,
         3,
         COALESCE((SELECT MAX(v.is_visible) FROM partners v WHERE v.kind = 'project' AND v.is_deleted = 0), 0)
) seed
WHERE NOT EXISTS (SELECT 1 FROM site_settings WHERE setting_key = 'migration.12_projects')
  AND NOT EXISTS (SELECT 1 FROM partners x WHERE x.name = seed.name);

INSERT IGNORE INTO site_settings (setting_key, setting_value) VALUES ('migration.12_projects', '"done"');
