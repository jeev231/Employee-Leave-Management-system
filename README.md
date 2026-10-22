# Employee Leave Management System (ELMS)

A complete, production-grade **Employee Leave Management System** built as a college DBMS project. Demonstrates strict database normalization (3NF), circular foreign keys, transactional locking, row-level constraints, stored procedures, triggers, views, and role-based authorization.

---

## 1. Tech Stack

- **Frontend:** React (Vite), JavaScript (JSX), and Plain Modern CSS (No Tailwind, No Bootstrap, No TypeScript).
- **Backend:** Node.js + Express.
- **Database:** MySQL Community Server using `mysql2`.
- **Security:** `bcryptjs` password hashing, JSON Web Tokens (`jsonwebtoken`) authentication, and parameterized SQL queries preventing SQL injection.

---

## 2. Database Schema — Exactly Five Tables (3NF)

### 3NF Normalization Justification
1. **First Normal Form (1NF):** All attributes are atomic (scalar values). Each record has a primary key with no repeating groups. Half-day leave durations are represented as decimal increments (`0.5`).
2. **Second Normal Form (2NF):** All non-key attributes are fully functionally dependent on the entire primary key. In the composite primary key table `leave_history(request_id, status)`, the approver details and timestamp depend directly on the full key.
3. **Third Normal Form (3NF):** There are no transitive dependencies. Department names reside strictly in `departments`, user details in `employees`, balance details in `leave_balances`, and leave application details in `leave_requests`. Reviewer details are linked via foreign keys rather than redundant columns.

### Tables Specification

| Table | Primary Key | Foreign Keys | Key Constraints & Rules |
|---|---|---|---|
| **`departments`** | `department_id` | `manager_id` &rarr; `employees.employee_id` | `UNIQUE(department_name)`, `UNIQUE(manager_id)`. Exactly 1 manager per dept, 1 dept per manager. |
| **`employees`** | `employee_id` | `department_id` &rarr; `departments.department_id` | `UNIQUE(email)`, `role IN ('admin','manager','employee')`. Circular FK added via `ALTER TABLE`. |
| **`leave_balances`** | `employee_id` | `employee_id` &rarr; `employees.employee_id` | `CHECK(allocated_days = 5.0)`, `CHECK(used_days >= 0.0)`, `CHECK(used_days <= allocated_days)`. |
| **`leave_requests`** | `request_id` | `employee_id`, `reviewed_by` &rarr; `employees` | `CHECK(days_requested > 0.0)`, `status IN ('Pending','Approved','Rejected','Cancelled')`. |
| **`leave_history`** | `(request_id, status)` | `request_id` &rarr; `leave_requests`, `approved_by` &rarr; `employees` | Composite PK prevents duplicate approval/rejection outcomes. |

### Required DBMS Objects
- **VIEW:** `vw_leave_request_details` — Joins leave requests, employees, departments, reviewers, and remaining balances.
- **Stored Procedure:** `sp_get_employee_leave_summary(IN p_employee_id INT)` — Computes allocated (5.0), used, and remaining leave balance for an employee.
- **Trigger:** `trg_after_leave_request_update` — Fires `AFTER UPDATE ON leave_requests`. When status changes to `'Approved'` or `'Rejected'`, automatically logs the decision to `leave_history` idempotently using `INSERT IGNORE`.

---

## 3. Seed Credentials & Test Accounts

All accounts use **bcrypt-hashed passwords** in the database.

### Admin Account
| Email | Password | Role | Department |
|---|---|---|---|
| `ceo@company.com` | `company@ceo123` | `admin` | `NULL` |

### Department Managers (Password: `PASSWORD`)
| Department | Manager Name | Email |
|---|---|---|
| Engineering | Alex Manager | `alexmanager@company.com` |
| Human Resources | Priya Manager | `priyamanager@company.com` |
| Marketing | Rahul Manager | `rahulmanager@company.com` |

### Employees (Password for all: `PASSWORD`)
- **Engineering:** `arjunkumar@company.com`, `ananyasharma@company.com`, `karthikraj@company.com`, `meerapatel@company.com`, `vikramsingh@company.com`
- **Human Resources:** `snehareddy@company.com`, `rahulverma@company.com`, `divyanair@company.com`, `adityarao@company.com`, `poojaiyer@company.com`
- **Marketing:** `nehakapoor@company.com`, `sanjaygupta@company.com`, `ishitadas@company.com`, `rohanmehta@company.com`, `kavyamenon@company.com`

---

## 4. Manager Approval Rules & Transaction Workflow

1. **Department Boundary:** A manager can only view, approve, or reject requests from employees in their assigned department.
2. **Conflict of Interest Prevention:** A manager cannot approve or reject their own leave requests.
3. **Manager Leave Approvals by Admin CEO:** When a Department Manager applies for leave, their request is routed directly to the Admin (CEO) for review and approval.
4. **Date Range Matching:** Requested leave days must correspond to the selected calendar span. For an $N$-day calendar span (e.g. 2/10/2026 to 5/10/2026 = 4 days), employees can request either $N$ full days (4.0) or half-day adjusted $N - 0.5$ days (3.5). Single-day leaves allow 1.0 day (Full Day) or 0.5 day (Half Day).
5. **Half-Day Precision:** 0.5-day leaves are stored and displayed with exact decimal precision, deducting 0.5 from the leave balance.
6. **Strict Transactional Approval:**
   - Starts MySQL transaction (`connection.beginTransaction()`).
   - Verifies manager/admin role and assignment.
   - Locks the employee's `leave_balances` row using `SELECT ... FOR UPDATE`.
   - Verifies `used_days + days_requested <= allocated_days` (5.0).
   - Increments `used_days` by `days_requested`.
   - Updates `leave_requests` to `Approved` with `reviewed_by` and `reviewed_at`.
   - Records entry in `leave_history` (via trigger / query).
   - Commits transaction (`connection.commit()`).
   - Any failure triggers an automatic rollback (`connection.rollback()`).

---

## 5. Setup & Running the Application

### Prerequisites
- Node.js (v18+)
- MySQL Community Server (v8.0+ / 26.x)

### Step 1: Configure Environment Variables
In `server/.env`, verify your MySQL credentials:
```env
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=leave_management_db
JWT_SECRET=college-dbms-elms-jwt-secret-key-2026
CLIENT_URL=http://localhost:5173
```

### Step 2: Seed the Database
From the root directory or `server/` directory:
```bash
cd server
npm install
npm run seed
```
This runs `database/seed.js`, which creates `leave_management_db`, tables, constraints, view, stored procedure, trigger, and seeds all 19 accounts and sample requests.

*(Alternatively, you can import `database/schema.sql` and `database/seed.sql` directly into MySQL).*

### Step 3: Start the Backend Server
```bash
cd server
npm start
```
The server will start at `http://localhost:5000`.

### Step 4: Start the Frontend Client
In a new terminal window:
```bash
cd client
npm install
npm run dev
```
Open your browser at `http://localhost:5173`. Use the **Quick Fill Demo Credentials** on the login page to sign in as Admin, Manager, or Employee!
