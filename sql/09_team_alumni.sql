-- Alumni: former team members shown at the bottom of the Team page
-- Author: Khadim Gueye
-- Safe to run several times: it only adds what is missing and never removes data.

USE malaria_dashboard;
SET NAMES utf8mb4;

ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS is_alumni TINYINT(1) NOT NULL DEFAULT 0 AFTER is_lead;
