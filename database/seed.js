/**
 * Database Seed Script for Employee Leave Management System
 * Uses bcryptjs for password hashing.
 * Safe to rerun idempotently.
 */
const path = require('path');
const fs = require('fs');

const serverNodeModules = path.join(__dirname, '../server/node_modules');
const mysql = require(path.join(serverNodeModules, 'mysql2/promise'));
const bcrypt = require(path.join(serverNodeModules, 'bcryptjs'));
require(path.join(serverNodeModules, 'dotenv')).config({ path: path.join(__dirname, '../server/.env') });

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'leave_management_db'
};

async function executeSchema(db) {
  console.log('Ensuring schema, tables, view, procedure, and trigger exist...');

  // Drop views/triggers/procedures first if recreating
  await db.query('DROP VIEW IF EXISTS `vw_leave_request_details`');
  await db.query('DROP PROCEDURE IF EXISTS `sp_get_employee_leave_summary`');
  await db.query('DROP TRIGGER IF EXISTS `trg_after_leave_request_update`');

  // Disable FK checks to allow clean creation
  await db.query('SET FOREIGN_KEY_CHECKS = 0');
  await db.query('DROP TABLE IF EXISTS `leave_history`');
  await db.query('DROP TABLE IF EXISTS `leave_requests`');
  await db.query('DROP TABLE IF EXISTS `leave_balances`');
  await db.query('DROP TABLE IF EXISTS `employees`');
  await db.query('DROP TABLE IF EXISTS `departments`');
  await db.query('SET FOREIGN_KEY_CHECKS = 1');

  // TABLE 1: departments
  await db.query(`
    CREATE TABLE \`departments\` (
      \`department_id\` INT AUTO_INCREMENT,
      \`department_name\` VARCHAR(100) NOT NULL,
      \`manager_id\` INT NOT NULL,
      PRIMARY KEY (\`department_id\`),
      CONSTRAINT \`uq_department_name\` UNIQUE (\`department_name\`),
      CONSTRAINT \`uq_department_manager\` UNIQUE (\`manager_id\`)
    ) ENGINE=InnoDB
  `);

  // TABLE 2: employees
  await db.query(`
    CREATE TABLE \`employees\` (
      \`employee_id\` INT AUTO_INCREMENT,
      \`full_name\` VARCHAR(100) NOT NULL,
      \`email\` VARCHAR(150) NOT NULL,
      \`password_hash\` VARCHAR(255) NOT NULL,
      \`phone\` VARCHAR(15) NULL,
      \`role\` ENUM('admin', 'manager', 'employee') NOT NULL DEFAULT 'employee',
      \`department_id\` INT NULL,
      PRIMARY KEY (\`employee_id\`),
      CONSTRAINT \`uq_employee_email\` UNIQUE (\`email\`)
    ) ENGINE=InnoDB
  `);

  // Circular Foreign Keys
  await db.query(`
    ALTER TABLE \`departments\`
      ADD CONSTRAINT \`fk_departments_manager\`
      FOREIGN KEY (\`manager_id\`) REFERENCES \`employees\` (\`employee_id\`)
      ON UPDATE CASCADE
  `);

  await db.query(`
    ALTER TABLE \`employees\`
      ADD CONSTRAINT \`fk_employees_department\`
      FOREIGN KEY (\`department_id\`) REFERENCES \`departments\` (\`department_id\`)
      ON UPDATE CASCADE
      ON DELETE SET NULL
  `);

  // TABLE 3: leave_balances
  await db.query(`
    CREATE TABLE \`leave_balances\` (
      \`employee_id\` INT NOT NULL,
      \`allocated_days\` DECIMAL(3,1) NOT NULL DEFAULT 5.0,
      \`used_days\` DECIMAL(3,1) NOT NULL DEFAULT 0.0,
      PRIMARY KEY (\`employee_id\`),
      CONSTRAINT \`fk_leave_balances_employee\`
        FOREIGN KEY (\`employee_id\`) REFERENCES \`employees\` (\`employee_id\`)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT \`chk_allocated_days_fixed\`
        CHECK (\`allocated_days\` = 5.0),
      CONSTRAINT \`chk_used_days_non_negative\`
        CHECK (\`used_days\` >= 0.0),
      CONSTRAINT \`chk_used_days_within_allocation\`
        CHECK (\`used_days\` <= \`allocated_days\`)
    ) ENGINE=InnoDB
  `);

  // TABLE 4: leave_requests
  await db.query(`
    CREATE TABLE \`leave_requests\` (
      \`request_id\` INT AUTO_INCREMENT,
      \`employee_id\` INT NOT NULL,
      \`start_date\` DATE NOT NULL,
      \`end_date\` DATE NOT NULL,
      \`days_requested\` DECIMAL(3,1) NOT NULL,
      \`reason\` TEXT NOT NULL,
      \`status\` ENUM('Pending', 'Approved', 'Rejected', 'Cancelled') NOT NULL DEFAULT 'Pending',
      \`reviewed_by\` INT NULL,
      \`reviewed_at\` DATETIME NULL,
      PRIMARY KEY (\`request_id\`),
      CONSTRAINT \`fk_leave_requests_employee\`
        FOREIGN KEY (\`employee_id\`) REFERENCES \`employees\` (\`employee_id\`)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT \`fk_leave_requests_reviewer\`
        FOREIGN KEY (\`reviewed_by\`) REFERENCES \`employees\` (\`employee_id\`)
        ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT \`chk_days_requested_positive\`
        CHECK (\`days_requested\` > 0.0)
    ) ENGINE=InnoDB
  `);

  // TABLE 5: leave_history
  await db.query(`
    CREATE TABLE \`leave_history\` (
      \`request_id\` INT NOT NULL,
      \`status\` ENUM('Approved', 'Rejected') NOT NULL,
      \`approved_by\` INT NOT NULL,
      \`approved_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`request_id\`, \`status\`),
      CONSTRAINT \`fk_leave_history_request\`
        FOREIGN KEY (\`request_id\`) REFERENCES \`leave_requests\` (\`request_id\`)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT \`fk_leave_history_approver\`
        FOREIGN KEY (\`approved_by\`) REFERENCES \`employees\` (\`employee_id\`)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB
  `);

  // VIEW: vw_leave_request_details
  await db.query(`
    CREATE VIEW \`vw_leave_request_details\` AS
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
    FROM \`leave_requests\` lr
    JOIN \`employees\` e ON lr.employee_id = e.employee_id
    LEFT JOIN \`departments\` d ON e.department_id = d.department_id
    LEFT JOIN \`employees\` rev ON lr.reviewed_by = rev.employee_id
    LEFT JOIN \`leave_balances\` lb ON lr.employee_id = lb.employee_id
  `);

  // STORED PROCEDURE: sp_get_employee_leave_summary
  await db.query(`
    CREATE PROCEDURE \`sp_get_employee_leave_summary\`(IN p_employee_id INT)
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
      FROM \`employees\` e
      LEFT JOIN \`departments\` d ON e.department_id = d.department_id
      LEFT JOIN \`leave_balances\` lb ON e.employee_id = lb.employee_id
      WHERE e.employee_id = p_employee_id;
    END
  `);

  // TRIGGER: trg_after_leave_request_update
  await db.query(`
    CREATE TRIGGER \`trg_after_leave_request_update\`
    AFTER UPDATE ON \`leave_requests\`
    FOR EACH ROW
    BEGIN
      IF OLD.status = 'Pending' AND NEW.status IN ('Approved', 'Rejected') AND NEW.reviewed_by IS NOT NULL THEN
        INSERT IGNORE INTO \`leave_history\` (\`request_id\`, \`status\`, \`approved_by\`, \`approved_at\`)
        VALUES (
          NEW.request_id,
          NEW.status,
          NEW.reviewed_by,
          COALESCE(NEW.reviewed_at, NOW())
        );
      END IF;
    END
  `);
}

async function seed() {
  console.log('Connecting to MySQL host...');
  const rootConn = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password
  });

  await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await rootConn.end();

  const db = await mysql.createConnection(config);
  console.log(`Connected to database: ${config.database}`);

  try {
    await executeSchema(db);

    const adminPasswordHash = await bcrypt.hash('company@ceo123', 10);
    const standardPasswordHash = await bcrypt.hash('PASSWORD', 10);

    // 1. Insert Admin (CEO)
    console.log('Seeding Admin account...');
    await db.query(
      `INSERT INTO employees (full_name, email, password_hash, phone, role, department_id)
       VALUES (?, ?, ?, ?, 'admin', NULL)
       ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), password_hash = VALUES(password_hash), role = 'admin'`,
      ['CEO', 'ceo@company.com', adminPasswordHash, '9876543210']
    );

    // 2. Insert Managers first without department_id
    console.log('Seeding Managers...');
    const managers = [
      { name: 'Alex Manager', email: 'alexmanager@company.com', phone: '9811000001', dept: 'Engineering' },
      { name: 'Priya Manager', email: 'priyamanager@company.com', phone: '9811000002', dept: 'Human Resources' },
      { name: 'Rahul Manager', email: 'rahulmanager@company.com', phone: '9811000003', dept: 'Marketing' }
    ];

    const managerIds = {};
    for (const m of managers) {
      await db.query(
        `INSERT INTO employees (full_name, email, password_hash, phone, role, department_id)
         VALUES (?, ?, ?, ?, 'manager', NULL)
         ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), password_hash = VALUES(password_hash), role = 'manager'`,
        [m.name, m.email, standardPasswordHash, m.phone]
      );
      const [rows] = await db.query('SELECT employee_id FROM employees WHERE email = ?', [m.email]);
      managerIds[m.dept] = rows[0].employee_id;
    }

    // 3. Insert Departments referencing manager_id
    console.log('Seeding Departments...');
    const departmentIds = {};
    for (const m of managers) {
      const mgrId = managerIds[m.dept];
      await db.query(
        `INSERT INTO departments (department_name, manager_id)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE manager_id = VALUES(manager_id)`,
        [m.dept, mgrId]
      );
      const [deptRows] = await db.query('SELECT department_id FROM departments WHERE department_name = ?', [m.dept]);
      departmentIds[m.dept] = deptRows[0].department_id;
    }

    // 4. Update Managers to assign department_id
    for (const m of managers) {
      const mgrId = managerIds[m.dept];
      const deptId = departmentIds[m.dept];
      await db.query('UPDATE employees SET department_id = ? WHERE employee_id = ?', [deptId, mgrId]);
    }

    // 5. Insert 5 Employees per department
    console.log('Seeding Employees...');
    const employeesData = [
      // Engineering
      { name: 'Arjun Kumar', email: 'arjunkumar@company.com', phone: '9811010001', dept: 'Engineering' },
      { name: 'Ananya Sharma', email: 'ananyasharma@company.com', phone: '9811010002', dept: 'Engineering' },
      { name: 'Karthik Raj', email: 'karthikraj@company.com', phone: '9811010003', dept: 'Engineering' },
      { name: 'Meera Patel', email: 'meerapatel@company.com', phone: '9811010004', dept: 'Engineering' },
      { name: 'Vikram Singh', email: 'vikramsingh@company.com', phone: '9811010005', dept: 'Engineering' },

      // Human Resources
      { name: 'Sneha Reddy', email: 'snehareddy@company.com', phone: '9811020001', dept: 'Human Resources' },
      { name: 'Rahul Verma', email: 'rahulverma@company.com', phone: '9811020002', dept: 'Human Resources' },
      { name: 'Divya Nair', email: 'divyanair@company.com', phone: '9811020003', dept: 'Human Resources' },
      { name: 'Aditya Rao', email: 'adityarao@company.com', phone: '9811020004', dept: 'Human Resources' },
      { name: 'Pooja Iyer', email: 'poojaiyer@company.com', phone: '9811020005', dept: 'Human Resources' },

      // Marketing
      { name: 'Neha Kapoor', email: 'nehakapoor@company.com', phone: '9811030001', dept: 'Marketing' },
      { name: 'Sanjay Gupta', email: 'sanjaygupta@company.com', phone: '9811030002', dept: 'Marketing' },
      { name: 'Ishita Das', email: 'ishitadas@company.com', phone: '9811030003', dept: 'Marketing' },
      { name: 'Rohan Mehta', email: 'rohanmehta@company.com', phone: '9811030004', dept: 'Marketing' },
      { name: 'Kavya Menon', email: 'kavyamenon@company.com', phone: '9811030005', dept: 'Marketing' }
    ];

    const employeeMap = {};
    for (const emp of employeesData) {
      const deptId = departmentIds[emp.dept];
      await db.query(
        `INSERT INTO employees (full_name, email, password_hash, phone, role, department_id)
         VALUES (?, ?, ?, ?, 'employee', ?)
         ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), password_hash = VALUES(password_hash), department_id = VALUES(department_id), role = 'employee'`,
        [emp.name, emp.email, standardPasswordHash, emp.phone, deptId]
      );
      const [rows] = await db.query('SELECT employee_id FROM employees WHERE email = ?', [emp.email]);
      employeeMap[emp.email] = rows[0].employee_id;
    }

    // Map all employees including admin and managers
    const [allEmps] = await db.query('SELECT employee_id, email, full_name FROM employees');
    console.log(`Total employees in database: ${allEmps.length} (Expected: 19)`);

    // 6. Seed Leave Balances for all 19 accounts
    console.log('Seeding Leave Balances...');
    for (const emp of allEmps) {
      await db.query(
        `INSERT INTO leave_balances (employee_id, allocated_days, used_days)
         VALUES (?, 5.0, 0.0)
         ON DUPLICATE KEY UPDATE allocated_days = 5.0`,
        [emp.employee_id]
      );
    }

    // 7. Seed Sample Leave Requests (12 requests: Approved, Pending, Rejected)
    console.log('Seeding Sample Leave Requests & History...');
    const alexId = managerIds['Engineering'];
    const priyaId = managerIds['Human Resources'];
    const rahulId = managerIds['Marketing'];

    const sampleRequests = [
      // Engineering
      {
        email: 'arjunkumar@company.com',
        start: '2026-11-02',
        end: '2026-11-03',
        days: 2.0,
        reason: 'Family wedding ceremony in hometown',
        status: 'Approved',
        reviewerId: alexId,
        reviewedAt: '2026-10-18 10:30:00'
      },
      {
        email: 'ananyasharma@company.com',
        start: '2026-11-10',
        end: '2026-11-10',
        days: 1.0,
        reason: 'Dental appointment and minor procedure',
        status: 'Pending',
        reviewerId: null,
        reviewedAt: null
      },
      {
        email: 'karthikraj@company.com',
        start: '2026-11-15',
        end: '2026-11-15',
        days: 0.5,
        reason: 'Attending child school annual function (half day)',
        status: 'Approved',
        reviewerId: alexId,
        reviewedAt: '2026-10-19 14:15:00'
      },
      {
        email: 'meerapatel@company.com',
        start: '2026-11-04',
        end: '2026-11-06',
        days: 3.0,
        reason: 'Personal travel and wellness retreat',
        status: 'Rejected',
        reviewerId: alexId,
        reviewedAt: '2026-10-20 11:00:00'
      },

      // Human Resources
      {
        email: 'snehareddy@company.com',
        start: '2026-11-05',
        end: '2026-11-06',
        days: 1.5,
        reason: 'Urgent home repair and maintenance supervision',
        status: 'Approved',
        reviewerId: priyaId,
        reviewedAt: '2026-10-17 09:45:00'
      },
      {
        email: 'rahulverma@company.com',
        start: '2026-11-12',
        end: '2026-11-12',
        days: 1.0,
        reason: 'Family religious ceremony attendance',
        status: 'Pending',
        reviewerId: null,
        reviewedAt: null
      },
      {
        email: 'divyanair@company.com',
        start: '2026-11-18',
        end: '2026-11-19',
        days: 2.0,
        reason: 'Attending regional HR leadership summit',
        status: 'Approved',
        reviewerId: priyaId,
        reviewedAt: '2026-10-19 16:30:00'
      },
      {
        email: 'adityarao@company.com',
        start: '2026-11-20',
        end: '2026-11-20',
        days: 0.5,
        reason: 'Vehicle registration appointment at transport office',
        status: 'Pending',
        reviewerId: null,
        reviewedAt: null
      },

      // Marketing
      {
        email: 'nehakapoor@company.com',
        start: '2026-11-09',
        end: '2026-11-11',
        days: 2.5,
        reason: 'Medical recovery from viral flu',
        status: 'Approved',
        reviewerId: rahulId,
        reviewedAt: '2026-10-18 12:20:00'
      },
      {
        email: 'sanjaygupta@company.com',
        start: '2026-11-16',
        end: '2026-11-16',
        days: 1.0,
        reason: 'Personal banking and government document verification',
        status: 'Pending',
        reviewerId: null,
        reviewedAt: null
      },
      {
        email: 'ishitadas@company.com',
        start: '2026-11-22',
        end: '2026-11-23',
        days: 2.0,
        reason: 'Out-of-town cousin wedding engagement',
        status: 'Rejected',
        reviewerId: rahulId,
        reviewedAt: '2026-10-20 15:45:00'
      },
      {
        email: 'rohanmehta@company.com',
        start: '2026-11-25',
        end: '2026-11-25',
        days: 0.5,
        reason: 'Scheduled diagnostic health tests (afternoon)',
        status: 'Pending',
        reviewerId: null,
        reviewedAt: null
      }
    ];

    for (const req of sampleRequests) {
      const empId = employeeMap[req.email];
      const [result] = await db.query(
        `INSERT INTO leave_requests (employee_id, start_date, end_date, days_requested, reason, status, reviewed_by, reviewed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [empId, req.start, req.end, req.days, req.reason, req.status, req.reviewerId, req.reviewedAt]
      );

      const requestId = result.insertId;

      if (req.status === 'Approved' || req.status === 'Rejected') {
        await db.query(
          `INSERT INTO leave_history (request_id, status, approved_by, approved_at)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE approved_at = VALUES(approved_at)`,
          [requestId, req.status, req.reviewerId, req.reviewedAt]
        );
      }

      if (req.status === 'Approved') {
        await db.query(
          `UPDATE leave_balances SET used_days = used_days + ? WHERE employee_id = ?`,
          [req.days, empId]
        );
      }
    }

    console.log('✅ Database seeded successfully!');
    console.log('\n--- Test Account Credentials Summary ---');
    console.log('ADMIN:');
    console.log('  Email: ceo@company.com | Password: company@ceo123 | Role: admin');
    console.log('\nMANAGERS: (Password for all: PASSWORD)');
    console.log('  alexmanager@company.com   (Engineering)');
    console.log('  priyamanager@company.com  (Human Resources)');
    console.log('  rahulmanager@company.com  (Marketing)');
    console.log('\nEMPLOYEES: (Password for all: PASSWORD)');
    console.log('  Engineering: arjunkumar, ananyasharma, karthikraj, meerapatel, vikramsingh (@company.com)');
    console.log('  HR:          snehareddy, rahulverma, divyanair, adityarao, poojaiyer (@company.com)');
    console.log('  Marketing:   nehakapoor, sanjaygupta, ishitadas, rohanmehta, kavyamenon (@company.com)');
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

seed();
