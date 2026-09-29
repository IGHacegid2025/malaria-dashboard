-- Data downloads (CSV) ask for the same details as PDF reports: record which one was downloaded
-- Author: Khadim Gueye
-- Rows saved before this change are PDF reports.

USE malaria_dashboard;

ALTER TABLE report_downloads
  ADD COLUMN IF NOT EXISTS kind ENUM('report', 'data') NOT NULL DEFAULT 'report' AFTER organization,
  ADD COLUMN IF NOT EXISTS label VARCHAR(255) NULL AFTER page;
