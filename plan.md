
---

### **1. Project Setup**

* **Setup Supabase**

  * Create a Supabase project.
  * Set up authentication (email/password).
  * Create tables:

    * `users` (role: admin/employee)
    * `tasks` (id, title, description, status, assigned\_to)
    * `attendance` (id, user\_id, check\_in, check\_out)
    * `reports` (user\_id, summary)
  * Enable Row Level Security (RLS) with policies.
  * Set up triggers for automatic report generation.

---

### **2. Authentication Flow**

**Refer to Image 3 (Login Diagram):**

* Create login form (HTML).
* On submit, verify credentials using Supabase Auth.
* Handle login attempts (lock after 3 incorrect logins).
* Redirect to role-based dashboard (admin/employee).

---

### **3. Dashboard UI**

**Refer to Image 1 & 2: Main Menu and Functional Paths**

#### **Admin Dashboard**

* Assign task
* Edit task
* Edit attendance
* Edit salary
* Add/Delete task
* View reports
* Logout

#### **Employee Dashboard**

* View assigned tasks
* Start/Resume/Cancel tasks
* View attendance
* Generate report
* Logout

---

### **4. Core Modules**

#### **Task Management**

* Admin assigns tasks (`status: pending`)
* Employees:

  * View assigned tasks
  * Start task (change status to "running")
  * Pause/Resume/Cancel (update status)

#### **Attendance Tracking**

* Allow employees to mark attendance.
* Admin can edit entries.

#### **Report Generation**

* Generate report based on:

  * Completed tasks
  * Attendance
  * Time logs
* Store/report summary in `reports` table.

---

### **5. UI Components**

* Use plain HTML/CSS:

  * Forms (Login, Task Assign, Attendance)
  * Tables (task lists, attendance records)
  * Buttons (Start, Resume, Cancel, Logout)
* Optional: Use light CSS framework or custom styles for layout.

---

### **6. Supabase Integration (JS)**

* Use `@supabase/supabase-js`:

  ```bash
  npm install @supabase/supabase-js
  ```
* Initialize in JS:

  ```js
  import { createClient } from '@supabase/supabase-js';
  const supabase = createClient('https://xyzcompany.supabase.co', 'public-anon-key');
  ```

---

### **7. Security and Role Management**

* Supabase RLS policies:

  * Only admins can assign/edit tasks.
  * Employees can view only their data.
* Hide/show UI elements based on role.

---

### **8. Testing and Deployment**

* **Test** each user journey manually.
* **Deploy** on platforms like:

  * Netlify / Vercel (frontend)
  * Supabase (backend already hosted)

---

