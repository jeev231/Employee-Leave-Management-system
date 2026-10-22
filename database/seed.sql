-- ====================================================================
-- Employee Leave Management System (ELMS) Database Seed Data
-- ====================================================================

USE `leave_management_db`;

-- Temporarily disable FK checks to allow initial cross-referenced insertion
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Insert Admin (CEO)
-- Note: password_hash below is bcrypt hash for 'company@ceo123'
INSERT INTO `employees` (`employee_id`, `full_name`, `email`, `password_hash`, `phone`, `role`, `department_id`)
VALUES (1, 'CEO', 'ceo@company.com', '$2a$10$tZ2R48qQ91jIu8E2W1eOquu2H5KskB1Qo7Zq82j66C9g.oH9G4O5i', '9876543210', 'admin', NULL)
ON DUPLICATE KEY UPDATE `full_name` = VALUES(`full_name`), `password_hash` = VALUES(`password_hash`), `role` = 'admin';

-- 2. Insert Managers (password for all: 'PASSWORD')
INSERT INTO `employees` (`employee_id`, `full_name`, `email`, `password_hash`, `phone`, `role`, `department_id`)
VALUES 
  (2, 'Alex Manager', 'alexmanager@company.com', '$2a$10$wO3tQvE3M1qL.7d4mKj.0OG4T6kS9fL2m9qJ.1r3k8gT7bW1p4O5i', '9811000001', 'manager', NULL),
  (3, 'Priya Manager', 'priyamanager@company.com', '$2a$10$wO3tQvE3M1qL.7d4mKj.0OG4T6kS9fL2m9qJ.1r3k8gT7bW1p4O5i', '9811000002', 'manager', NULL),
  (4, 'Rahul Manager', 'rahulmanager@company.com', '$2a$10$wO3tQvE3M1qL.7d4mKj.0OG4T6kS9fL2m9qJ.1r3k8gT7bW1p4O5i', '9811000003', 'manager', NULL)
ON DUPLICATE KEY UPDATE `full_name` = VALUES(`full_name`), `password_hash` = VALUES(`password_hash`), `role` = 'manager';

-- 3. Insert Departments
INSERT INTO `departments` (`department_id`, `department_name`, `manager_id`)
VALUES
  (1, 'Engineering', 2),
  (2, 'Human Resources', 3),
  (3, 'Marketing', 4)
ON DUPLICATE KEY UPDATE `manager_id` = VALUES(`manager_id`);

-- Update Managers' department_id
UPDATE `employees` SET `department_id` = 1 WHERE `employee_id` = 2;
UPDATE `employees` SET `department_id` = 2 WHERE `employee_id` = 3;
UPDATE `employees` SET `department_id` = 3 WHERE `employee_id` = 4;

-- 4. Insert 15 Employees (5 per department)
INSERT INTO `employees` (`employee_id`, `full_name`, `email`, `password_hash`, `phone`, `role`, `department_id`)
VALUES
  -- Engineering
  (5, 'Arjun Kumar', 'arjunkumar@company.com', '$2a$10$wO3tQvE3M1qL.7d4mKj.0OG4T6kS9fL2m9qJ.1r3k8gT7bW1p4O5i', '9811010001', 'employee', 1),
  (6, 'Ananya Sharma', 'ananyasharma@company.com', '$2a$10$wO3tQvE3M1qL.7d4mKj.0OG4T6kS9fL2m9qJ.1r3k8gT7bW1p4O5i', '9811010002', 'employee', 1),
  (7, 'Karthik Raj', 'karthikraj@company.com', '$2a$10$wO3tQvE3M1qL.7d4mKj.0OG4T6kS9fL2m9qJ.1r3k8gT7bW1p4O5i', '9811010003', 'employee', 1),
  (8, 'Meera Patel', 'meerapatel@company.com', '$2a$10$wO3tQvE3M1qL.7d4mKj.0OG4T6kS9fL2m9qJ.1r3k8gT7bW1p4O5i', '9811010004', 'employee', 1),
  (9, 'Vikram Singh', 'vikramsingh@company.com', '$2a$10$wO3tQvE3M1qL.7d4mKj.0OG4T6kS9fL2m9qJ.1r3k8gT7bW1p4O5i', '9811010005', 'employee', 1),
  -- Human Resources
  (10, 'Sneha Reddy', 'snehareddy@company.com', '$2a$10$wO3tQvE3M1qL.7d4mKj.0OG4T6kS9fL2m9qJ.1r3k8gT7bW1p4O5i', '9811020001', 'employee', 2),
  (11, 'Rahul Verma', 'rahulverma@company.com', '$2a$10$wO3tQvE3M1qL.7d4mKj.0OG4T6kS9fL2m9qJ.1r3k8gT7bW1p4O5i', '9811020002', 'employee', 2),
  (12, 'Divya Nair', 'divyanair@company.com', '$2a$10$wO3tQvE3M1qL.7d4mKj.0OG4T6kS9fL2m9qJ.1r3k8gT7bW1p4O5i', '9811020003', 'employee', 2),
  (13, 'Aditya Rao', 'adityarao@company.com', '$2a$10$wO3tQvE3M1qL.7d4mKj.0OG4T6kS9fL2m9qJ.1r3k8gT7bW1p4O5i', '9811020004', 'employee', 2),
  (14, 'Pooja Iyer', 'poojaiyer@company.com', '$2a$10$wO3tQvE3M1qL.7d4mKj.0OG4T6kS9fL2m9qJ.1r3k8gT7bW1p4O5i', '9811020005', 'employee', 2),
  -- Marketing
  (15, 'Neha Kapoor', 'nehakapoor@company.com', '$2a$10$wO3tQvE3M1qL.7d4mKj.0OG4T6kS9fL2m9qJ.1r3k8gT7bW1p4O5i', '9811030001', 'employee', 3),
  (16, 'Sanjay Gupta', 'sanjaygupta@company.com', '$2a$10$wO3tQvE3M1qL.7d4mKj.0OG4T6kS9fL2m9qJ.1r3k8gT7bW1p4O5i', '9811030002', 'employee', 3),
  (17, 'Ishita Das', 'ishitadas@company.com', '$2a$10$wO3tQvE3M1qL.7d4mKj.0OG4T6kS9fL2m9qJ.1r3k8gT7bW1p4O5i', '9811030003', 'employee', 3),
  (18, 'Rohan Mehta', 'rohanmehta@company.com', '$2a$10$wO3tQvE3M1qL.7d4mKj.0OG4T6kS9fL2m9qJ.1r3k8gT7bW1p4O5i', '9811030004', 'employee', 3),
  (19, 'Kavya Menon', 'kavyamenon@company.com', '$2a$10$wO3tQvE3M1qL.7d4mKj.0OG4T6kS9fL2m9qJ.1r3k8gT7bW1p4O5i', '9811030005', 'employee', 3)
ON DUPLICATE KEY UPDATE `full_name` = VALUES(`full_name`), `password_hash` = VALUES(`password_hash`), `department_id` = VALUES(`department_id`), `role` = 'employee';

SET FOREIGN_KEY_CHECKS = 1;

-- 5. Insert Leave Balances for all 19 accounts
INSERT INTO `leave_balances` (`employee_id`, `allocated_days`, `used_days`) VALUES
  (1, 5.0, 0.0), (2, 5.0, 0.0), (3, 5.0, 0.0), (4, 5.0, 0.0),
  (5, 5.0, 2.0), (6, 5.0, 0.0), (7, 5.0, 0.5), (8, 5.0, 0.0), (9, 5.0, 0.0),
  (10, 5.0, 1.5), (11, 5.0, 0.0), (12, 5.0, 2.0), (13, 5.0, 0.0), (14, 5.0, 0.0),
  (15, 5.0, 2.5), (16, 5.0, 0.0), (17, 5.0, 0.0), (18, 5.0, 0.0), (19, 5.0, 0.0)
ON DUPLICATE KEY UPDATE `allocated_days` = 5.0;

-- 6. Insert Leave Requests
INSERT INTO `leave_requests` (`request_id`, `employee_id`, `start_date`, `end_date`, `days_requested`, `reason`, `status`, `reviewed_by`, `reviewed_at`) VALUES
  (1, 5, '2026-11-02', '2026-11-03', 2.0, 'Family wedding ceremony in hometown', 'Approved', 2, '2026-10-18 10:30:00'),
  (2, 6, '2026-11-10', '2026-11-10', 1.0, 'Dental appointment and minor procedure', 'Pending', NULL, NULL),
  (3, 7, '2026-11-15', '2026-11-15', 0.5, 'Attending child school annual function (half day)', 'Approved', 2, '2026-10-19 14:15:00'),
  (4, 8, '2026-11-04', '2026-11-06', 3.0, 'Personal travel and wellness retreat', 'Rejected', 2, '2026-10-20 11:00:00'),
  (5, 10, '2026-11-05', '2026-11-06', 1.5, 'Urgent home repair and maintenance supervision', 'Approved', 3, '2026-10-17 09:45:00'),
  (6, 11, '2026-11-12', '2026-11-12', 1.0, 'Family religious ceremony attendance', 'Pending', NULL, NULL),
  (7, 12, '2026-11-18', '2026-11-19', 2.0, 'Attending regional HR leadership summit', 'Approved', 3, '2026-10-19 16:30:00'),
  (8, 13, '2026-11-20', '2026-11-20', 0.5, 'Vehicle registration appointment at transport office', 'Pending', NULL, NULL),
  (9, 15, '2026-11-09', '2026-11-11', 2.5, 'Medical recovery from viral flu', 'Approved', 4, '2026-10-18 12:20:00'),
  (10, 16, '2026-11-16', '2026-11-16', 1.0, 'Personal banking and government document verification', 'Pending', NULL, NULL),
  (11, 17, '2026-11-22', '2026-11-23', 2.0, 'Out-of-town cousin wedding engagement', 'Rejected', 4, '2026-10-20 15:45:00'),
  (12, 18, '2026-11-25', '2026-11-25', 0.5, 'Scheduled diagnostic health tests (afternoon)', 'Pending', NULL, NULL)
ON DUPLICATE KEY UPDATE `status` = VALUES(`status`);

-- 7. Insert Leave History
INSERT INTO `leave_history` (`request_id`, `status`, `approved_by`, `approved_at`) VALUES
  (1, 'Approved', 2, '2026-10-18 10:30:00'),
  (3, 'Approved', 2, '2026-10-19 14:15:00'),
  (4, 'Rejected', 2, '2026-10-20 11:00:00'),
  (5, 'Approved', 3, '2026-10-17 09:45:00'),
  (7, 'Approved', 3, '2026-10-19 16:30:00'),
  (9, 'Approved', 4, '2026-10-18 12:20:00'),
  (11, 'Rejected', 4, '2026-10-20 15:45:00')
ON DUPLICATE KEY UPDATE `approved_at` = VALUES(`approved_at`);
