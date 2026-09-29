-- Malaria Dashboard database
-- Author: Khadim Gueye

CREATE DATABASE IF NOT EXISTS malaria_dashboard
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'malaria_app'@'localhost' IDENTIFIED BY 'malaria_pass_2026';
CREATE USER IF NOT EXISTS 'malaria_app'@'%' IDENTIFIED BY 'malaria_pass_2026';
GRANT SELECT, INSERT, UPDATE, DELETE ON malaria_dashboard.* TO 'malaria_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON malaria_dashboard.* TO 'malaria_app'@'%';
FLUSH PRIVILEGES;

USE malaria_dashboard;
