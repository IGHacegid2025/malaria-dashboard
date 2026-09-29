-- LinkedIn profiles of team members, Khadim Gueye's bio and Adedayo Adesida
-- Author: Khadim Gueye
-- Safe to run several times: it only fills empty fields and adds missing members.

USE malaria_dashboard;
SET NAMES utf8mb4;

ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR(300) NULL AFTER email;

UPDATE team_members SET linkedin_url = 'https://www.linkedin.com/in/ifyaniebo/'
WHERE linkedin_url IS NULL AND name LIKE '%Aniebo%';
UPDATE team_members SET linkedin_url = 'https://www.linkedin.com/in/vera-mitesser-a1403119b/'
WHERE linkedin_url IS NULL AND name LIKE '%Mitesser%';
UPDATE team_members SET linkedin_url = 'https://www.linkedin.com/in/khadimgueyekgy/'
WHERE linkedin_url IS NULL AND name LIKE '%Khadim Gueye%';
UPDATE team_members SET linkedin_url = 'https://www.linkedin.com/in/john-openibo-160ba0141/'
WHERE linkedin_url IS NULL AND name LIKE '%Openibo%';

UPDATE team_members
SET bio = CONCAT(
  'Khadim Gueye is a Senior Bioinformatician at the Institute of Genomics and Global Health (IGH) in Nigeria, where he leads the computational analysis of national malaria genomic surveillance data within the Ify Aniebo Lab. His work focuses on antimalarial drug resistance, parasite genetic diversity, population genomics and gene flow, and on translating these results into evidence for malaria control policy. He is also the Co-Founder and Chief Executive Officer of ABCOMICS, an initiative dedicated to strengthening bioinformatics capacity across Africa.\n\n',
  'Mr Gueye brings eight years of experience in genomic epidemiology and data science across Africa and Europe. At EMBL-EBI in the United Kingdom, he served as a bioinformatician for the European Nucleotide Archive, ensuring the quality of genomic data submitted by the international research community. At IRESSEF in Senegal, he led the bioinformatics team for national SARS-CoV-2 genomic surveillance, contributing to the first detection of a Variant of Concern in the country. He previously studied Plasmodium falciparum population genetics at the MRC Unit The Gambia at the London School of Hygiene and Tropical Medicine.\n\n',
  'He holds a Master''s degree in Bioinformatics and Biomathematics from Cheikh Anta Diop University of Dakar and has co-authored twelve peer-reviewed publications, including contributions to Nucleic Acids Research.'
)
WHERE name LIKE '%Khadim Gueye%' AND (bio IS NULL OR bio = '');

INSERT INTO team_members (name, title, affiliation, photo_url, linkedin_url, is_lead, sort_order)
SELECT 'Adedayo Adesida', 'PhD student', 'Institute of Genomics and Global Health, Redeemer''s University',
       '/team/adedayo_adesida.jpg', 'https://www.linkedin.com/in/adedayo-adesida/', 0, 4
WHERE NOT EXISTS (SELECT 1 FROM team_members WHERE name LIKE '%Adesida%');

UPDATE team_members
SET bio = CONCAT(
  'Adedayo is a PhD research fellow at the Institute of Genomics and Global Health. His research interest is on the applications of molecular biology, genomics and bio-informatics tools to understudy the dynamics of transmission of parasitic agents and the identification of molecular markers that mediate parasites'' resistance and host susceptibility.\n\n',
  'His PhD research is on molecular surveillance and translational modeling of antimalarial drug and diagnostic resistance.'
)
WHERE name LIKE '%Adesida%' AND (bio IS NULL OR bio = '');

UPDATE team_members
SET bio = CONCAT(
  'John O. Openibo is a Research Scientist at the Institute of Genomics and Global Health (IGH, formerly ACEGID), with more than ten years of experience in infectious disease research. He studied Microbiology at Lagos State University (BSc) and Covenant University (MSc), and his work is guided by Sustainable Development Goal 3: good health and well-being.\n\n',
  'During his studies, he received the Lagos State University academic scholarship three times, the Lagos State Indigene undergraduate scholarship twice and the Lagos State postgraduate academic scholarship once. He was also awarded The World Academy of Sciences and Covenant University Bioinformatics Research (TWAS-CUBRe) Postgraduate Fellowship.\n\n',
  'His research covers tuberculosis, malaria and SARS-CoV-2, from diagnosis and drug testing to therapeutic efficacy studies and genomic surveillance. He is skilled in the use of microbiology, molecular biology and genomics equipment for diagnosis and research, and has several scientific certifications and publications to his credit. He also takes part in public health campaigns on infectious and non-communicable diseases, and has worked both as a team lead and as a team member on research projects.'
)
WHERE name LIKE '%Openibo%' AND (bio IS NULL OR bio = '');

UPDATE team_members SET title = 'Research Scientist'
WHERE name LIKE '%Openibo%' AND title = 'Laboratory team member';

UPDATE team_members
SET bio = CONCAT(
  'Dr. Vera Mitesser is a postdoctoral researcher at the Institute of Genomics and Global Health (IGH) in Ede, Nigeria. She earned her PhD from the Hebrew University of Jerusalem, Israel, in January 2023. Her doctoral research focused on the basic biology of Plasmodium, the parasite that causes human malaria, and in particular on transcriptional regulation and DNA compaction.\n\n',
  'After her PhD, she turned to the analysis of field samples from malaria-endemic regions. She now studies the genetic mechanisms behind antimalarial drug resistance and diagnostic evasion in endemic settings. Convinced that high-quality research must also be carried out within the countries affected by malaria, she moved permanently to Nigeria, where she contributes to strengthening local research capacity and scientific infrastructure.\n\n',
  'Alongside her expertise in molecular biology techniques, she has bioinformatics skills and experience in mentoring students and junior researchers, coordinating projects, leading teams and supervising collaborative research. Her publications span several areas of infectious disease research, often as part of interdisciplinary collaborations.\n\n',
  'During her PhD, she held a two-year fellowship from the Minerva Foundation, which supports German-Israeli scientific cooperation under the umbrella of the Max Planck Society. She has also contributed to several grant applications, including a successful proposal to the U.S.-Israel Binational Science Foundation (BSF) built on the findings of her doctoral research.'
)
WHERE name LIKE '%Mitesser%' AND (bio IS NULL OR bio = '');

UPDATE team_members SET title = 'Postdoctoral Researcher'
WHERE name LIKE '%Mitesser%' AND title = 'Laboratory team member';
