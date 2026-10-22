-- ====================================================================
-- Employee Leave Management System (ELMS) Database Schema
-- College DBMS Project - 5 Tables in Third Normal Form (3NF)
-- ====================================================================

CREATE DATABASE IF NOT EXISTS `leave_management_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `leave_management_db`;

-- --------------------------------------------------------------------
-- Drop existing views, procedures, triggers, and tables (in FK order)
-- --------------------------------------------------------------------
DROP VIEW IF EXISTS `vw_leave_request_details`;
DROP PROCEDURE IF EXISTS `sp_get_employee_leave_summary`;
DROP TRIGGER IF EXISTS `trg_after_leave_request_update`;

-- Drop foreign keys first to allow clean table recreation
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `leave_history`;
DROP TABLE IF EXISTS `leave_requests`;
DROP TABLE IF EXISTS `leave_balances`;
DROP TABLE IF EXISTS `employees`;
DROP TABLE IF EXISTS `departments`;
SET FOREIGN_KEY_CHECKS = 1;

-- ====================================================================
-- TABLE 1: departments
-- Represents academic / company departments with a unique assigned manager.
-- ====================================================================
CREATE TABLE `departments` (
  `department_id` INT AUTO_INCREMENT,
  `department_name` VARCHAR(100) NOT NULL,
  `manager_id` INT NOT NULL,
  PRIMARY KEY (`department_id`),
  CONSTRAINT `uq_department_name` UNIQUE (`department_name`),
  CONSTRAINT `uq_department_manager` UNIQUE (`manager_id`)
) ENGINE=InnoDB;

-- ====================================================================
-- TABLE 2: employees
-- Stores login credentials, roles, and department affiliation.
-- Role restricted to ('admin', 'manager', 'employee').
-- ====================================================================
CREATE TABLE `employees` (
  `employee_id` INT AUTO_INCREMENT,
  `full_name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(150) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(15) NULL,
  `role` ENUM('admin', 'manager', 'employee') NOT NULL DEFAULT 'employee',
  `department_id` INT NULL,
  PRIMARY KEY (`employee_id`),
  CONSTRAINT `uq_employee_email` UNIQUE (`email`)
) ENGINE=InnoDB;

-- ====================================================================
-- Add Circular Foreign Keys between departments and employees
-- ====================================================================
ALTER TABLE `departments`
  ADD CONSTRAINT `fk_departments_manager`
  FOREIGN KEY (`manager_id`) REFERENCES `employees` (`employee_id`)
  ON UPDATE CASCADE;

ALTER TABLE `employees`
  ADD CONSTRAINT `fk_employees_department`
  FOREIGN KEY (`department_id`) REFERENCES `departments` (`department_id`)
  ON UPDATE CASCADE
  ON DELETE SET NULL;

-- ====================================================================
-- TABLE 3: leave_balances
-- Enforces 5-day allocation per employee and tracks consumed days.
-- CHECK constraints guarantee:
--  1) allocated_days = 5.0
--  2) used_days >= 0.0
--  3) used_days <= allocated_days
-- ====================================================================
CREATE TABLE `leave_balances` (
  `employee_id` INT NOT NULL,
  `allocated_days` DECIMAL(3,1) NOT NULL DEFAULT 5.0,
  `used_days` DECIMAL(3,1) NOT NULL DEFAULT 0.0,
  PRIMARY KEY (`employee_id`),
  CONSTRAINT `fk_leave_balances_employee`
    FOREIGN KEY (`employee_id`) REFERENCES `employees` (`employee_id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_allocated_days_fixed`
    CHECK (`allocated_days` = 5.0),
  CONSTRAINT `chk_used_days_non_negative`
    CHECK (`used_days` >= 0.0),
  CONSTRAINT `chk_used_days_within_allocation`
    CHECK (`used_days` <= `allocated_days`)
) ENGINE=InnoDB;

-- ====================================================================
-- TABLE 4: leave_requests
-- Stores individual leave applications submitted by employees.
-- Enforces days_requested > 0.
-- ====================================================================
CREATE TABLE `leave_requests` (
  `request_id` INT AUTO_INCREMENT,
  `employee_id` INT NOT NULL,
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `days_requested` DECIMAL(3,1) NOT NULL,
  `reason` TEXT NOT NULL,
  `status` ENUM('Pending', 'Approved', 'Rejected', 'Cancelled') NOT NULL DEFAULT 'Pending',
  `reviewed_by` INT NULL,
  `reviewed_at` DATETIME NULL,
  PRIMARY KEY (`request_id`),
  CONSTRAINT `fk_leave_requests_employee`
    FOREIGN KEY (`employee_id`) REFERENCES `employees` (`employee_id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_leave_requests_reviewer`
    FOREIGN KEY (`reviewed_by`) REFERENCES `employees` (`employee_id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `chk_days_requested_positive`
    CHECK (`days_requested` > 0.0)
) ENGINE=InnoDB;

-- ====================================================================
-- TABLE 5: leave_history
-- Records final outcome decisions (Approved or Rejected).
-- Composite Primary Key (request_id, status) prevents duplicate records.
-- ====================================================================
CREATE TABLE `leave_history` (
  `request_id` INT NOT NULL,
  `status` ENUM('Approved', 'Rejected') NOT NULL,
  `approved_by` INT NOT NULL,
  `approved_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`request_id`, `status`),
  CONSTRAINT `fk_leave_history_request`
    FOREIGN KEY (`request_id`) REFERENCES `leave_requests` (`request_id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_leave_history_approver`
    FOREIGN KEY (`approved_by`) REFERENCES `employees` (`employee_id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ====================================================================
-- VIEW: vw_leave_request_details
-- Denormalized view joining requests, applicants, departments, reviewers.
-- ====================================================================
CREATE VIEW `vw_leave_request_details` AS
SELECT
  lr.request_id,
  lr.employee_id,
  e.full_name AS employee_name,
  e.email AS employee_email,
  e.role AS employee_role,
  e.department_id,
  d.department_name,
  d.manager_id AS department_manager_id,
  lr.start_date,
  lr.end_date,
  lr.days_requested,
  lr.reason,
  lr.status,
  lr.reviewed_by,
  rev.full_name AS reviewer_name,
  lr.reviewed_at,
  lb.allocated_days,
  lb.used_days,
  (lb.allocated_days - lb.used_days) AS remaining_days
FROM `leave_requests` lr
JOIN `employees` e ON lr.employee_id = e.employee_id
LEFT JOIN `departments` d ON e.department_id = d.department_id
LEFT JOIN `employees` rev ON lr.reviewed_by = rev.employee_id
LEFT JOIN `leave_balances` lb ON lr.employee_id = lb.employee_id;

-- ====================================================================
-- STORED PROCEDURE: sp_get_employee_leave_summary
-- Computes and returns allocated, used, and remaining leave balance.
-- ====================================================================
DELIMITER $$
CREATE PROCEDURE `sp_get_employee_leave_summary`(IN p_employee_id INT)
BEGIN
  SELECT
    e.employee_id,
    e.full_name,
    e.email,
    e.role,
    d.department_name,
    COALESCE(lb.allocated_days, 5.0) AS allocated_days,
    COALESCE(lb.used_days, 0.0) AS used_days,
    COALESCE(lb.allocated_days - lb.used_days, 5.0) AS remaining_days
  FROM `employees` e
  LEFT JOIN `departments` d ON e.department_id = d.department_id
  LEFT JOIN `leave_balances` lb ON e.employee_id = lb.employee_id
  WHERE e.employee_id = p_employee_id;
END$$
DELIMITER ;

-- ====================================================================
-- TRIGGER: trg_after_leave_request_update
-- Automatically records decision in leave_history whenever a pending
-- request is transitioned to 'Approved' or 'Rejected'.
-- Uses INSERT IGNORE to prevent duplicate history records.
-- ====================================================================
DELIMITER $$
CREATE TRIGGER `trg_after_leave_request_update`
AFTER UPDATE ON `leave_requests`
FOR EACH ROW
BEGIN
  IF OLD.status = 'Pending' AND NEW.status IN ('Approved', 'Rejected') AND NEW.reviewed_by IS NOT NULL THEN
    INSERT IGNORE INTO `leave_history` (`request_id`, `status`, `approved_by`, `approved_at`)
    VALUES (
      NEW.request_id,
      NEW.status,
      NEW.reviewed_by,
      COALESCE(NEW.reviewed_at, NOW())
    );
  END IF;
END$$
DELIMITER ;
