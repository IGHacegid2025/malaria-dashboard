-- Nothing is ever erased: deleted activities and team members are only flagged, and stay in the database
-- Author: Khadim Gueye
-- Safe to run several times: it only adds what is missing and never removes data.

USE malaria_dashboard;
SET NAMES utf8mb4;

ALTER TABLE lab_activities
  ADD COLUMN IF NOT EXISTS is_deleted TINYINT(1) NOT NULL DEFAULT 0 AFTER is_hidden,
  ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL AFTER is_deleted;

ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS is_deleted TINYINT(1) NOT NULL DEFAULT 0 AFTER is_hidden,
  ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL AFTER is_deleted;
