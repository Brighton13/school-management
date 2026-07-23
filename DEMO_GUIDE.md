# School Management System Demo Guide

This guide is for a full product demo. It covers every visible area in the dashboard, the major workflows, and how the frontend pages, API routes, database models, authentication, permissions, and shared components work together.

## 1. Demo Opening

Start with the main idea:

This is a role-based school management system built with Next.js, NextAuth, Prisma, and a relational database. It manages the school lifecycle from academic setup, student intake, enrollment, class and subject assignment, attendance, results, report cards, fees, inventory, announcements, security logs, and system settings.

Then explain the architecture:

1. The user signs in through `/login`.
2. NextAuth validates the email and password using `lib/auth.ts`.
3. The session stores the user id, role, and permissions.
4. `middleware.ts` and `components/layout/dashboard-layout.tsx` protect dashboard access.
5. The sidebar in `components/layout/sidebar-with-dropdowns.tsx` shows menu items based on role.
6. Dashboard pages under `app/dashboard/*` call API routes under `app/api/*`.
7. API routes use Prisma from `lib/prisma.ts` to read and write database models in `prisma/schema.prisma`.
8. Most write operations are protected by permissions from `lib/permissions.ts`.
9. Important actions are tracked through audit trails, session logs, notifications, and workflow statuses.

## 2. Login, Security, And Navigation

### Login

1. Open the system and go to `/login`.
2. Enter a valid email and password.
3. Submit the form.
4. If credentials are correct and the user is active, NextAuth creates a JWT session.
5. The user is redirected into `/dashboard`.

What to explain:

- Passwords are checked with bcrypt.
- Inactive users cannot log in.
- The session contains the user's role and permissions.
- The dashboard layout blocks unauthenticated users and redirects them to login.

Related components:

- `app/login/page.tsx`: login screen.
- `lib/auth.ts`: credential validation and session creation.
- `app/api/auth/[...nextauth]/route.ts`: NextAuth route.
- `components/session-validator.tsx`: validates active session state.
- `hooks/use-secure-logout.ts`: secure logout handling.
- `components/idle-timeout/idle-timeout-provider.tsx`: idle timeout warning and logout.

### Sidebar And Header

1. After login, point out the header, notification bell, user name, role, and sidebar.
2. Expand sidebar groups such as Main, Academic Management, Student Management, Staff Management, Results, Operations, Communication, Tools, and System.
3. Explain that available modules change depending on the user role.

Related components:

- `components/layout/dashboard-layout.tsx`: wraps every dashboard page.
- `components/layout/header.tsx`: top navigation and mobile menu.
- `components/layout/sidebar-with-dropdowns.tsx`: role-based navigation.
- `components/notifications/notification-bell.tsx`: unread notification access.

## 3. Role-Based Access Control

### Roles

Main roles supported:

- Admin: full administrative access.
- Principal: oversight, approvals, analytics, staff/student visibility, settings.
- Teacher: assigned students, results entry, class result submission, attendance, report comments.
- Accountant: fees and payment management.
- Librarian: inventory management.
- Student: personal dashboard, subjects, results, attendance, fees, announcements.
- Parent: child dashboard, child results, attendance, fees, announcements.

### Permissions

1. Go to `Roles Management`.
2. Create or edit a role.
3. Assign permissions such as `students.read`, `fees.create`, `results.approve`, or `reports.generate`.
4. Go to `User Management`.
5. Assign a role to a user.
6. Sign in as that user to show that menu access and API access change.

What to explain:

- Permissions are stored separately from roles.
- A user can have roles through `UserRole`.
- Roles have permissions through `RolePermission`.
- Users without roles can still have direct `UserPermission`.
- API routes call `requirePermission()` or `requireAnyPermission()` before making protected changes.

Related database models:

- `User`
- `Role`
- `Permission`
- `UserRole`
- `RolePermission`
- `UserPermission`

Related pages and APIs:

- `/dashboard/users`
- `/dashboard/roles`
- `/dashboard/permissions`
- `/api/users`
- `/api/roles`
- `/api/permissions`
- `lib/permissions.ts`

## 4. Dashboard Analytics

### Admin And Principal Dashboard

1. Log in as Admin or Principal.
2. Open `Dashboard`.
3. Show high-level school metrics and charts.
4. Explain that analytics are filtered by the current academic year where applicable.

What to explain:

- The dashboard counts active students, staff, classes, pending fees, attendance, performance, and recent activity.
- Analytics are built from `components/analytics/*`.
- APIs aggregate records from students, enrollments, fees, attendance, results, and audit trails.

Related components and APIs:

- `app/dashboard/page.tsx`
- `components/analytics/admin-analytics.tsx`
- `components/analytics/dashboard-charts.tsx`
- `/api/analytics/admin`
- `/api/dashboard/stats`

### Teacher Dashboard

1. Log in as Teacher.
2. Open `Dashboard`.
3. Show assigned classes, subjects, student counts, recent results, and teaching analytics.

Related components and APIs:

- `components/analytics/teacher-dashboard.tsx`
- `components/analytics/teacher-analytics.tsx`
- `/api/analytics/teacher`
- `/api/analytics/teacher/detailed`

### Student, Parent, Accountant, Librarian Dashboards

1. Student sees personal results, attendance, fees, subjects, exams, and announcements.
2. Parent sees linked children, child performance, attendance, and fee summaries.
3. Accountant sees fee totals, payment trends, pending balances, and recent payments.
4. Librarian sees inventory totals, stock status, and low-stock alerts.

Related components and APIs:

- `components/analytics/student-dashboard.tsx`
- `components/analytics/parent-dashboard.tsx`
- `components/analytics/accountant-dashboard.tsx`
- `components/analytics/librarian-dashboard.tsx`
- `/api/analytics/student`
- `/api/analytics/parent`
- `/api/analytics/accountant`
- `/api/analytics/librarian`

## 5. Academic Management

### Academic Years

1. Go to `Academic Years`.
2. Create an academic year with year name, start date, end date, status, current flag, or upcoming flag.
3. Set one academic year as current.
4. Edit or delete when allowed.

What to explain:

- The current academic year drives enrollment, terms, results, reports, fees, attendance, and dashboard filtering.
- Only one year should be current at a time.

Related models and APIs:

- `AcademicYear`
- `/api/academic-years`
- `/api/academic-years/[id]`
- `/api/academic-years/[id]/set-current`

### Terms

1. Go to `Terms`.
2. Add term name, term number, start/end dates, and academic year.
3. Mark the current term.
4. Edit or remove terms where there are no blocking related records.

What to explain:

- Terms sit inside academic years.
- Results, exams, fees, attendance, and reports all attach to a term.

Related models and APIs:

- `Term`
- `/api/terms`
- `/api/terms/[id]`
- `/api/academic-years/[id]/terms`

### Classes

1. Go to `Classes`.
2. Add a class with name, level, and optional capacity.
3. Edit or delete classes.

What to explain:

- Classes are the grade or level.
- Sections, enrollments, class subjects, exams, applications, and timetables depend on classes.

Related models and APIs:

- `Class`
- `/api/classes`
- `/api/classes/[id]`

### Sections

1. Go to `Sections`.
2. Add a section under a class.
3. Optionally assign a class teacher.
4. Set capacity, edit, or delete.

What to explain:

- Sections divide a class into groups such as A, B, Science, or Arts.
- A section connects enrolled students, class teacher review, attendance, reports, applications, and subject assignment.

Related models and APIs:

- `Section`
- `Staff`
- `/api/sections`
- `/api/sections/[id]`
- `/api/teacher-sections`

### Subjects

1. Go to `Subjects`.
2. Add a subject with name, code, description, and type.
3. Choose type: CORE, ELECTIVE, or OPTIONAL.
4. Edit or delete subjects.

What to explain:

- Core subjects are required for complete report generation.
- Elective and optional subjects can be selected by students.

Related models and APIs:

- `Subject`
- `/api/subjects`
- `/api/subjects/[id]`

### Class Subjects

1. Go to `Class Subject Management`.
2. Select a class and optional section.
3. Assign subjects to that class or section.
4. Set max marks, pass marks, and optional teacher.
5. Use bulk assignment to attach many subjects at once.

What to explain:

- `ClassSubject` is the bridge between a class, section, subject, and teacher.
- Results are entered against class subjects, not just generic subjects.
- Teacher assignments use this link to decide which teacher can enter marks.

Related models and APIs:

- `ClassSubject`
- `/api/class-subjects`
- `/api/class-subjects/[id]`

### Exams

1. Go to `Exam Management`.
2. Create an exam with name, type, term, academic year, class, date range, final flag, approval requirement, and status.
3. Activate or manage exams as needed.
4. Use pending tabs to show exam submission progress where available.

What to explain:

- Exams group results by assessment event.
- Exams connect to results, class teacher submission, principal approval, and report generation.
- An exam may require approval before results become final.

Related models and APIs:

- `Exam`
- `ExamResultSubmission`
- `ExamSubjectSubmission`
- `/api/exams`
- `/api/exams/[id]`
- `/api/results/exam-submissions`

## 6. Student Management

### Students

1. Go to `Students`.
2. Search or filter the list.
3. Add a new student.
4. Enter user/login details, admission number, date of birth, gender, address, emergency contact, and optional application information.
5. Edit or delete student records where permitted.
6. Download templates or upload students in bulk if demonstrating import.

What to explain:

- A student has a `User` account and a `Student` profile.
- Student information connects to enrollments, applications, parents, attendance, results, fees, payments, subject selections, and reports.
- Admission numbers can be generated using `lib/admission_number_gen.ts`.

Related models and APIs:

- `User`
- `Student`
- `/api/students`
- `/api/students/[id]`
- `/api/templates/students`
- `/api/bulk/students`

### Application To Enrollment Workflow

This is one of the strongest demo workflows.

1. Go to `Students` and create a student with intended class and academic year, or go to application APIs through the existing workflow.
2. The system creates a student record and a pending `Application`.
3. Go to `Pending Applications`.
4. Review student details, admission number, applied class, suggested section, academic year, creator, and previous enrollment if present.
5. Approve the application.
6. Select or confirm a section.
7. The system marks the application approved and creates an active `ClassEnrollment`.
8. Alternatively, reject the application and enter a reason.

What to explain:

- The person capturing a student records application intent.
- Admin or Principal makes the actual enrollment decision.
- Approval is transactional: application status and enrollment are updated together.
- This prevents accidental class placement and preserves the audit trail.

Related models and APIs:

- `Application`
- `ClassEnrollment`
- `/api/applications`
- `/api/applications/pending`
- `/api/applications/[id]/approve`
- `/api/applications/[id]/reject`
- `/api/enrollment`

### Enrollment

1. Go to `Student Enrollment`.
2. Click `Enroll Student`.
3. Select student, class, section, academic year, and status.
4. Save the enrollment.
5. Edit enrollment if a student changes section or status.

What to explain:

- Enrollment is the official link between a student and a class/section for an academic year.
- Most academic operations depend on this record.

Related models and APIs:

- `ClassEnrollment`
- `/api/enrollment`
- `/api/enrollment/[id]`

### Pending Applications

1. Go to `Pending Applications`.
2. Open the approval dialog for a pending applicant.
3. Select final section and approve.
4. Open reject dialog for another applicant and enter a reason.

What to explain:

- This is the queue for controlled intake.
- Approval creates enrollment.
- Rejection keeps a clear reason and does not enroll the student.

Related APIs:

- `/api/applications/pending`
- `/api/applications/[id]/approve`
- `/api/applications/[id]/reject`
- `/api/applications/bulk-approve`
- `/api/applications/bulk-reject`

### Student Promotions

1. Go to `Student Promotions`.
2. Select a class or group.
3. Review current students.
4. Choose target class, target section, and target academic year.
5. Promote selected students.

What to explain:

- Promotions create or update enrollment records for the next academic year.
- Student history remains intact because enrollments are tied to academic years.

Related models and APIs:

- `ClassEnrollment`
- `AcademicYear`
- `/api/promotions`

### Subject Selection

1. Go to `Subject Selection`.
2. Select a student if using Admin view.
3. View available class subjects.
4. Add elective or optional subjects.
5. Remove selected subjects if needed.

What to explain:

- Core subjects come from class subject setup.
- Elective and optional choices are stored separately in `StudentSubjectSelection`.
- Results and report logic can distinguish core subjects from selected subjects.

Related models and APIs:

- `StudentSubjectSelection`
- `ClassSubject`
- `/api/student-subjects`
- `/api/students/available-subjects`

## 7. Staff Management

### Users

1. Go to `User Management`.
2. Search and filter by role or status.
3. Create a user with name, email, password, phone, role, active status, and permissions.
4. Edit a user.
5. Deactivate or delete where permitted.

What to explain:

- Every login account is a `User`.
- Some users have a linked `Student`, `Staff`, or `Parent` profile.
- User roles determine both visible menus and protected API access.

Related APIs:

- `/api/users`
- `/api/users/[id]`
- `/api/users/[id]/roles`

### Staff

1. Go to `Staff`.
2. Create a staff member with personal details, employee id, designation, department, qualification, experience, salary, joining date, gender, date of birth, address, and status.
3. Edit staff details.
4. Resend verification if needed.

What to explain:

- Staff records connect login users to operational duties.
- Teachers, principals, accountants, librarians, and admins are represented as staff with designations.

Related models and APIs:

- `Staff`
- `User`
- `/api/staff`
- `/api/staff/[id]`
- `/api/staff/[id]/resend-verification`

### Teacher Assignments

1. Go to `Teacher Assignments`.
2. Select a class subject.
3. Select a teacher.
4. Save the assignment.
5. Review all assignments and remove incorrect ones.

What to explain:

- Teacher assignment links a teacher to a specific class/section/subject combination.
- This controls which students and results a teacher works with.

Related models and APIs:

- `ClassSubject`
- `Staff`
- `/api/teacher-assignments`
- `/api/teacher-classes`

## 8. Results Workflow

### Enter Results

1. Log in as Teacher.
2. Go to `Enter Results`.
3. Use `Single Entry` to select student, class subject, term, academic year, exam, marks, max marks, grade, and remarks.
4. Save the result.
5. Use `Bulk Upload` to download a template and upload many results at once.

What to explain:

- Results belong to a student, a class subject, term, academic year, and optionally an exam.
- Result statuses support workflow control: draft, pending class teacher, pending approval, approved, rejected, and published.
- Marks generate grades, points, and remarks depending on configuration.

Related models and APIs:

- `Result`
- `/api/results`
- `/api/results/[id]`
- `/api/bulk/results`

### Class Results Management

1. Log in as a class teacher.
2. Go to `Class Results`.
3. Filter by class, section, subject, exam, term, and academic year.
4. Review student results.
5. Submit the class to the next approval stage.

What to explain:

- Subject teachers enter marks.
- Class teachers review completeness for their section.
- Submission moves results toward principal approval.

Related APIs:

- `/api/results/class-results`
- `/api/results/submit-class`
- `/api/results/class-teacher-submit`
- `/api/results/class-teacher-pending`
- `/api/results/sync-submission`

### Class Teacher Review And Submissions

1. Go to `Class Teacher Review` or `Class Teacher Submissions` if available to the role.
2. Review pending exam/section submissions.
3. Approve or send forward to principal.
4. Track submitted and pending groups.

What to explain:

- `ExamResultSubmission` tracks progress for an entire exam and section.
- `ExamSubjectSubmission` tracks each subject inside that exam/section.
- The system can tell whether all required subjects have been entered.

Related APIs:

- `/api/results/exam-submissions`
- `/api/results/class-teacher-pending`
- `/api/results/class-teacher-submit`

### Principal Approvals

1. Log in as Principal or Admin.
2. Go to `Approvals` or `Results Approval`.
3. Open pending submissions.
4. Review exam, class, section, student statistics, and subject completion.
5. Approve or reject results.
6. Approved results become available for reporting and viewing.

What to explain:

- Principal approval is the quality control gate before results become official.
- Approval records who approved and when.

Related APIs:

- `/api/results/pending-approval`
- `/api/results/principal-approval`
- `/api/results/principal-approval/grouped`
- `/api/results/[id]/approve`
- `/api/results/[id]/review`

## 9. Reports And Report Cards

### Generate Student Reports

1. Go to `Student Reports`.
2. Open `Generate Student Reports` or `Generate Report Forms`.
3. Select academic year, term, exam, class, and section.
4. Select students.
5. Generate reports.

What to explain:

- Reports are generated only when required core subject results are approved.
- The system calculates total marks, maximum marks, current average, previous term average, progress ratio, class position, and class size.
- Report generation creates `StudentReport` records.

Related models and APIs:

- `StudentReport`
- `Result`
- `/api/reports/generate`
- `/api/reports/class-teacher-generate`
- `/api/results/generate-reports`

### Report Detail

1. Open a report from `Student Reports`.
2. Show subject results, marks, grade, comments, signatures, class position, and progress.
3. Print or view the report card.

What to explain:

- Report details combine student profile, enrollment, class/section, term, academic year, exam, approved results, comments, and signatures.

Related APIs:

- `/api/reports/[id]`
- `/api/reports/comments`

### Comment Configuration

1. Go to `Comment Configuration`.
2. Create comment templates by marks range.
3. Set the performance area such as overall, conduct, participation, effort, or attendance.
4. Save and reuse templates when commenting on reports.

Related models and APIs:

- `ReportCommentConfig`
- `CommentTemplate`
- `/api/reports/comment-config`
- `/api/settings/comment-templates`

### Bulk Report Approval

1. Log in as Principal.
2. Go to `Bulk Report Approvals`.
3. Review pending reports grouped by section.
4. Select a group or reports.
5. Approve selected reports.

What to explain:

- Bulk approval speeds up end-of-term processing.
- Approved reports become visible to students and parents.
- Notifications are sent after approval.

Related APIs:

- `/api/reports/bulk-approve`

### Report Configuration

1. Go to `Report Config`.
2. Use the tabs for school details, signatures, remarks, and comments.
3. Update school name, motto, address, phone, email, logo, ministry header, principal details, footer, next term date, remark ranges, comment templates, and points configuration.

What to explain:

- These settings control how generated report cards look and how automatic remarks/points are produced.

Related models and APIs:

- `SchoolConfig`
- `Signature`
- `RemarkTemplate`
- `CommentTemplate`
- `PointsConfig`
- `/api/settings/school-config`
- `/api/settings/signatures`
- `/api/settings/remark-templates`
- `/api/settings/comment-templates`
- `/api/settings/points-config`
- `/api/reports/comment-config`

### Signature Management

1. Go to `Signature Management`.
2. Choose signature type.
3. Upload signature image.
4. Save it.

What to explain:

- Signatures are stored against users and can appear on reports.

Related APIs:

- `/api/signatures`
- `/api/settings/signatures`

## 10. Attendance

1. Go to `Attendance`.
2. Select section and date.
3. Load students.
4. Mark each student as present, absent, late, or excused.
5. Save attendance.
6. View attendance records in dashboards and analytics.

What to explain:

- Attendance is tied to student or staff, section, academic year, term, and date.
- Attendance can be filtered into analytics for students, parents, teachers, and administrators.

Related models and APIs:

- `Attendance`
- `/api/attendance`

## 11. Fees And Payments

### Fees Management

1. Go to `Fees Management`.
2. Show fee summary cards: total fees, total paid, pending, overdue.
3. Create a fee for a student, term, academic year, fee type, amount, due date, and remarks.
4. Filter by status, fee type, term, academic year, and search.
5. Edit fee records or record payments.

What to explain:

- Fees are attached to students, terms, and academic years.
- Payment updates paid amount and status.
- Status can be pending, partial, paid, or overdue.

Related models and APIs:

- `Fee`
- `Payment`
- `/api/fees`
- `/api/fees/[id]`
- `/api/fees/bulk`
- `/api/payments`

### Receipts

1. After a payment, open or generate the receipt.
2. Print the receipt or email it.

What to explain:

- Receipts are based on payment records and school configuration.
- Receipt numbers are generated for traceability.

Related API:

- `/api/payments/[id]/receipt`

### Mobile Money

1. Start a mobile money payment if configured.
2. Enter phone, operator, country, and amount.
3. Check status.
4. Explain webhook update from Lenco.

What to explain:

- The system creates a pending payment and mobile money transaction.
- Lenco webhook updates the transaction status.
- Successful transactions update the related fee balance.

Related models and APIs:

- `MobileMoneyTransaction`
- `/api/payments/mobile-money`
- `/api/payments/mobile-money/check-status`
- `/api/webhooks/lenco`
- `lib/lenco.ts`

### Student And Parent Fee View

1. Log in as Student or Parent.
2. Go to `My Fees`.
3. Show personal or child fee balances and payment status.

What to explain:

- Students see their own fees.
- Parents see fees for linked children.

## 12. Inventory

1. Go to `Inventory`.
2. Add an item with name, category, quantity, unit, minimum stock, location, supplier, and cost.
3. Review inventory list.
4. Explain stock categories and low-stock tracking.

What to explain:

- `InventoryItem` stores the current item.
- `InventoryTransaction` records movements such as IN, OUT, TRANSFER, or ADJUSTMENT.
- Librarian, Principal, and Admin can use this area depending on role.

Related models and APIs:

- `InventoryItem`
- `InventoryTransaction`
- `/api/inventory`

## 13. Announcements And Notifications

### Announcements

1. Go to `Announcements`.
2. Create an announcement with title, content, type, target audience, optional target class/section, published status, expiry date, and attachments.
3. Publish it.
4. Open the announcement detail page.
5. Attach or remove files if needed.

What to explain:

- Announcements can target all users, students, parents, staff, or a class/section.
- Published announcements create notifications for the intended audience.
- Attachments are stored through the file upload system.

Related models and APIs:

- `Announcement`
- `AnnouncementAttachment`
- `Notification`
- `/api/announcements`
- `/api/announcements/[id]`
- `/api/announcements/[id]/attachments`
- `/api/files/upload`
- `/api/files/upload-multiple`
- `/api/files/download/[filename]`
- `/api/files/delete/[filename]`

### Notifications

1. Click the notification bell.
2. View unread and recent notifications.
3. Mark notifications as read.
4. Follow links to related pages.

What to explain:

- Notifications support results, reports, announcements, fees, exams, and other categories.
- Server-sent events are available through the stream route for live updates.

Related components and APIs:

- `components/notifications/notification-bell.tsx`
- `components/notifications/notification-list.tsx`
- `hooks/use-notifications.ts`
- `/api/notifications`
- `/api/notifications/[id]`
- `/api/notifications/stream`
- `lib/notifications.ts`

## 14. Bulk Upload Tools

1. Go to `Bulk Upload`.
2. Show the tabs:
   - Students
   - Staff
   - Sections
   - Enrollment
   - Class and Section Enrollment
   - Teacher Assignments
3. Download the template for each area.
4. Fill the template.
5. Upload the file.
6. Review success and validation errors.

What to explain:

- Bulk upload uses templates to reduce manual data entry.
- Upload routes validate rows before creating records.
- Enrollment templates include current enrollment and pending application context.

Related components and APIs:

- `components/bulk-upload.tsx`
- `components/bulk-upload-class-section.tsx`
- `/api/templates/students`
- `/api/templates/staff`
- `/api/bulk/students`
- `/api/bulk/staff`
- `/api/bulk/sections`
- `/api/bulk/enrollment`
- `/api/bulk/enrollment-class-section`
- `/api/bulk/teacher-assignments`
- `/api/bulk/results`

## 15. Profile

1. Go to `My Profile`.
2. View account details.
3. Edit editable profile fields.
4. Save changes.

What to explain:

- This page reads from the authenticated session and user profile.
- Profile updates are written through `/api/profile`.

Related API:

- `/api/profile`

## 16. Email Configuration

1. Go to `Email Config`.
2. Enter SMTP host, port, secure setting, username, password, from address, and active flag.
3. Save the configuration.
4. Explain that email is used for password resets, verification, receipts, and notifications where enabled.

Related models and APIs:

- `EmailConfig`
- `/api/email-config`
- `lib/email.ts`

## 17. Settings And Session Timeout

1. Go to `Settings`.
2. Review session timeout configuration.
3. Set idle timeout minutes.
4. Set warning-before-logout minutes.
5. Enable or disable idle timeout.
6. Save.

What to explain:

- The idle timeout provider reads these settings.
- Users get warned before automatic logout.
- This protects unattended sessions.

Related models and APIs:

- `SystemSettings`
- `/api/system-settings`
- `/api/system-settings/idle-timeout`
- `hooks/use-idle-timeout.ts`

## 18. Audit Trails

1. Go to `Audit Trails`.
2. Filter by user, action, entity type, or date.
3. Export to CSV.
4. Open an activity row to explain what happened.

What to explain:

- Audit trails record important system activity.
- They help administrators answer who did what, when, and on which record.

Related models and APIs:

- `AuditTrail`
- `/api/audit-trails`
- `lib/audit.ts`

## 19. Session Logs

1. Go to `Session Logs`.
2. Filter by user, device, browser, active status, or date.
3. Export to CSV.
4. Show login time, logout time, duration, and active status.

What to explain:

- Session logs track authentication activity.
- Logout updates the active session record.
- This supports security monitoring.

Related models and APIs:

- `SessionLog`
- `/api/session-logs`

## 20. Password Recovery And Email Verification

### Forgot Password

1. Go to `/forgot-password`.
2. Enter email address.
3. Submit request.
4. The system creates a password reset token.
5. User opens reset link and sets a new password at `/reset-password`.

Related models and APIs:

- `PasswordResetToken`
- `/api/auth/forgot-password`
- `/api/auth/reset-password`
- `/api/auth/verify-token`

### Email Verification

1. Use `/verify-email` for verification flow.
2. Show that staff verification emails can be resent from staff management where implemented.

Related pages and APIs:

- `/verify-email`
- `/api/staff/[id]/resend-verification`

## 21. Health And File Services

1. Mention `/api/health` as a simple health check route.
2. Explain file upload, download, multi-upload, and delete support.
3. Explain that announcement attachments use the file routes and optional file server integration.

Related APIs:

- `/api/health`
- `/api/files/upload`
- `/api/files/upload-multiple`
- `/api/files/download/[filename]`
- `/api/files/delete/[filename]`
- `lib/fileserver.ts`

## 22. How Main Components Relate

### User And Role Structure

`User` is the login identity. A user can connect to `Student`, `Staff`, or `Parent`. Roles and permissions decide what the user can see and do.

Flow:

`User -> UserRole -> Role -> RolePermission -> Permission`

If a user has no roles, direct permissions can be used:

`User -> UserPermission -> Permission`

### Academic Structure

Academic years contain terms. Classes contain sections. Students become part of a class and section through enrollment.

Flow:

`AcademicYear -> Term`

`Class -> Section`

`Student -> ClassEnrollment -> Class + Section + AcademicYear`

### Teaching Structure

Subjects are assigned to classes or sections through class subjects. Teachers can be attached to those class subjects.

Flow:

`Subject -> ClassSubject -> Class + Section + Staff`

`Teacher -> ClassSubject -> Results`

### Enrollment Structure

Applications capture intent. Enrollment confirms official placement.

Flow:

`Student -> Application -> Approval -> ClassEnrollment`

### Results Structure

Results are entered for students in specific class subjects, terms, academic years, and exams. They move through teacher/class teacher/principal workflow.

Flow:

`Student + ClassSubject + Term + AcademicYear + Exam -> Result -> Review -> Approval -> Published/Report`

Exam-level tracking:

`Exam -> ExamResultSubmission -> ExamSubjectSubmission`

### Report Structure

Reports depend on approved results. Reports combine marks, class position, progress ratio, comments, signatures, and school configuration.

Flow:

`Approved Results -> StudentReport -> ReportComment + Signature + SchoolConfig`

### Fees Structure

Fees are created for students by term and academic year. Payments reduce balances and receipts document transactions.

Flow:

`Student -> Fee -> Payment -> Receipt`

Mobile money:

`Payment -> MobileMoneyTransaction -> Lenco Webhook -> Fee Update`

### Communication Structure

Announcements create notifications for target audiences. Attachments are handled through file upload routes.

Flow:

`Announcement -> AnnouncementAttachment`

`Announcement/Report/Fee/Event -> Notification -> NotificationBell`

### Security And Monitoring Structure

Authentication, authorization, audit trails, session logs, and timeout settings work together.

Flow:

`Login -> Session -> Permission Checks -> AuditTrail`

`Login/Logout/Timeout -> SessionLog`

`SystemSettings -> IdleTimeoutProvider`

## 23. Recommended Demo Order

Use this order for a clean Wednesday presentation:

1. Login and role-based navigation.
2. Dashboard analytics for Admin or Principal.
3. Academic setup: academic year, terms, classes, sections, subjects, class subjects.
4. Staff setup: users, roles, permissions, staff, teacher assignments.
5. Student lifecycle: create student, pending application, approve enrollment.
6. Promotions and subject selection.
7. Attendance marking.
8. Results entry as teacher.
9. Class teacher review and principal approval.
10. Report generation, comments, signatures, and bulk approval.
11. Fees, payment recording, receipt, and mobile money integration.
12. Inventory management.
13. Announcements and notifications.
14. Bulk upload tools.
15. Profile, email config, settings, idle timeout.
16. Audit trails and session logs.
17. Close with the data relationships and security model.

## 24. Short Closing Script

This system is not just a set of separate pages. The important part is how the records connect. Academic years and terms define the school period. Classes and sections place students. Subjects and teacher assignments define who teaches what. Results move through review and approval before report cards are generated. Fees and payments track the financial side. Announcements and notifications keep users informed. Roles, permissions, audit trails, session logs, and idle timeout protect the system and make actions traceable.

