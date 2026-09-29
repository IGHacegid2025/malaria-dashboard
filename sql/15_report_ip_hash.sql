-- PDF report requests no longer keep the IP address: only an anonymous fingerprint (to spot abuse) and the place
-- Author: Khadim Gueye
-- Rows saved before this change keep their original values.

USE malaria_dashboard;

ALTER TABLE report_downloads ADD COLUMN IF NOT EXISTS ip_hash CHAR(64) NULL AFTER organization;
