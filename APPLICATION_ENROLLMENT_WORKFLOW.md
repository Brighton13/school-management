# Application → Enrollment Workflow System

## Overview

This system implements a professional **Application → Enrollment** workflow that separates student intake from enrollment decisions. This prevents confusion, ensures proper class placement, and maintains a clear audit trail.

---

## Core Principle

**The teacher who captures a student does NOT decide the class placement.**  
They only record the **application intent**.

---

## Architecture

### 1. Database Schema

#### Application Table
```prisma
model Application {
  id                 String   @id @default(cuid())
  studentId          String
  appliedClassId     String
  appliedSectionId   String?
  academicYear       String
  applicationStatus  String   @default("PENDING") // PENDING, APPROVED, REJECTED
  notes              String?
  rejectionReason    String?
  createdBy          String
  approvedBy         String?
  approvedAt         DateTime?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  
  // Relations
  student        Student  @relation(...)
  appliedClass   Class    @relation(...)
  appliedSection Section? @relation(...)
  creator        User     @relation("ApplicationCreator", ...)
  approver       User?    @relation("ApplicationApprover", ...)
}
```

---

## Workflow Stages

### Stage 1: Student Capture (Application)

**Who:** Teacher A, Data Entry Staff  
**Permission:** `students:create`

When capturing a new student:

1. **Fill basic student information:**
   - Name, admission number, date of birth, etc.

2. **Record application intent:**
   - `appliedClassId` - Which class the student should join (e.g., Grade 3)
   - `appliedSectionId` (optional) - Suggested section
   - `academicYear` - Intake year (e.g., 2024-2025)
   - `notes` - Any special requirements or comments

**Result:** Student record + Application record created  
**Status:** Application status = `PENDING`

#### API Endpoint
```typescript
POST /api/students
{
  "email": "student@example.com",
  "password": "defaultPassword",
  "name": "John Banda",
  "phone": "+260971234567",
  "admissionNumber": "ADM2025001",
  "dateOfBirth": "2010-05-15",
  "gender": "Male",
  "address": "123 Main St",
  "emergencyContact": "+260977654321",
  "appliedClassId": "class-id-123",        // Required
  "appliedSectionId": "section-id-456",    // Optional
  "academicYear": "2024-2025",             // Required
  "applicationNotes": "Special needs consideration"
}
```

---

### Stage 2: Pending Applications Queue

**Who:** Head Teacher, Admin, Principal  
**Permission:** `applications:read`, `applications:approve`

**View:** `/dashboard/pending-applications`

The enrollment officer sees a queue showing:

| Student | Admission No. | Applied Class | Suggested Section | Academic Year | Previous Enrollment | Applied By | Applied Date | Actions |
|---------|--------------|---------------|-------------------|---------------|-------------------|------------|--------------|---------|
| John Banda | ADM2025001 | Grade 3 | A | 2024-2025 | Grade 2 - A (2023-2024) | Teacher Mary | 2024-12-30 | Approve / Reject |
| Mary Phiri | ADM2025002 | Grade 5 | - | 2024-2025 | New student | Teacher John | 2024-12-29 | Approve / Reject |

**Key Features:**
- Clear display of application intent
- Shows previous enrollment history (if any)
- Shows who created the application
- Allows confirmation or override of class/section

#### API Endpoints
```typescript
GET /api/applications/pending
// Returns all pending applications with student details
```

---

### Stage 3: Enrollment Decision

**Who:** Head Teacher, Admin, Principal

#### Option A: Approve Application

1. **Review application details**
2. **Confirm or select section** (required if not specified)
3. **Click "Approve & Enroll"**

**System Actions:**
- Updates application status to `APPROVED`
- Records approver and approval timestamp
- Creates `ClassEnrollment` record
- Transaction ensures atomicity

#### Option B: Reject Application

1. **Provide rejection reason** (required)
2. **Click "Reject Application"**

**System Actions:**
- Updates application status to `REJECTED`
- Records rejection reason and approver
- Student remains in database but not enrolled
- Can create new application if needed

#### API Endpoints
```typescript
// Approve
POST /api/applications/{id}/approve
{
  "sectionId": "section-id-789",
  "academicYear": "2024-2025"
}

// Reject
POST /api/applications/{id}/reject
{
  "rejectionReason": "Age requirement not met"
}
```

---

## Bulk Enrollment Template

### Enhanced Template Download

The template now includes **intelligent data** about each student:

**Template Columns:**
- `AdmissionNumber` - Student's admission number
- `StudentName` - Full name
- `CurrentClass` - Current enrolled class (if any)
- `CurrentSection` - Current enrolled section (if any)
- `PendingApplicationClass` - Class from pending application (if any)
- `PendingApplicationSection` - Section from pending application (if any)
- `AcademicYear` - Academic year

**Download API:**
```typescript
GET /api/bulk/enrollment
// Returns CSV with all students and their enrollment/application data
```

**Example Template:**
```csv
AdmissionNumber,StudentName,CurrentClass,CurrentSection,PendingApplicationClass,PendingApplicationSection,AcademicYear
ADM2024001,John Banda,"Grade 2","A","Grade 3","A",2024-2025
ADM2025001,Mary Phiri,"","","Grade 5","",2024-2025
ADM2024002,Alex Tembo,"Grade 4","B","","",2023-2024
```

**Benefits:**
- ✅ Shows current enrollment status
- ✅ Shows pending applications
- ✅ Enrollment officer can see complete context
- ✅ No guessing required
- ✅ Can make bulk decisions based on data

---

## Role-Based Access Control

| Role | Can Add Student | Can Create Application | Can Approve/Reject | Can Enroll |
|------|----------------|----------------------|-------------------|-----------|
| Teacher | ✔ | ✔ (automatic) | ❌ | ❌ |
| Head Teacher | ✔ | ✔ | ✔ | ✔ |
| Principal | ✔ | ✔ | ✔ | ✔ |
| Admin | ✔ | ✔ | ✔ | ✔ |

**Permissions:**
- `students:create` - Add new students
- `applications:create` - Create applications
- `applications:read` - View applications
- `applications:approve` - Approve applications
- `applications:reject` - Reject applications
- `enrollment:create` - Create enrollments

---

## Benefits of This System

### ✅ No Guessing
The class is explicitly declared at application time and confirmed at enrollment time.

### ✅ Audit Trail
- Who created the application
- When it was created
- Who approved/rejected it
- When it was approved/rejected
- Rejection reasons (if any)

### ✅ Prevents Conflicts
- Clear separation of duties
- Only authorized personnel can approve enrollments
- Prevents unauthorized class changes

### ✅ Data Integrity
- Atomic transactions ensure consistency
- Can't have enrollment without approved application
- Can't approve application twice
- Prevents duplicate enrollments

### ✅ Visibility
- Clear queue of pending applications
- Shows previous enrollment history
- Bulk download template with full context

---

## Example Scenarios

### Scenario 1: New Student (No Previous Enrollment)

1. **Teacher A** creates student record:
   - Name: "John Banda"
   - Applied Class: Grade 3
   - Academic Year: 2024-2025

2. **Application** created with status `PENDING`

3. **Head Teacher** reviews pending applications:
   - Sees John Banda → Grade 3
   - Selects Section A
   - Clicks "Approve & Enroll"

4. **System** creates enrollment record:
   - Student: John Banda
   - Class: Grade 3
   - Section: A
   - Academic Year: 2024-2025

### Scenario 2: Returning Student (Has Previous Enrollment)

1. **Teacher B** creates application for existing student:
   - Student: Mary Phiri (was in Grade 2-A in 2023-2024)
   - Applied Class: Grade 3
   - Academic Year: 2024-2025

2. **Head Teacher** reviews application:
   - Sees previous enrollment: Grade 2-A (2023-2024)
   - Confirms promotion to Grade 3
   - Selects Section B
   - Approves

3. **System** creates new enrollment for 2024-2025

### Scenario 3: Application Rejected

1. **Teacher C** creates application:
   - Student: Alex Tembo
   - Applied Class: Grade 1
   - Academic Year: 2024-2025

2. **Principal** reviews application:
   - Age verification fails
   - Clicks "Reject"
   - Provides reason: "Student does not meet minimum age requirement"

3. **Application** marked as `REJECTED`
   - Student record remains
   - No enrollment created
   - Can create new application for correct grade level

---

## API Reference

### Applications

#### Get All Applications
```
GET /api/applications?status=PENDING&academicYear=2024-2025
```

#### Get Pending Applications
```
GET /api/applications/pending
```

#### Create Application
```
POST /api/applications
{
  "studentId": "student-id",
  "appliedClassId": "class-id",
  "appliedSectionId": "section-id",  // optional
  "academicYear": "2024-2025",
  "notes": "Optional notes"
}
```

#### Get Application by ID
```
GET /api/applications/{id}
```

#### Update Application
```
PATCH /api/applications/{id}
{
  "appliedClassId": "class-id",
  "appliedSectionId": "section-id",
  "notes": "Updated notes"
}
```

#### Approve Application
```
POST /api/applications/{id}/approve
{
  "sectionId": "section-id",
  "academicYear": "2024-2025"
}
```

#### Reject Application
```
POST /api/applications/{id}/reject
{
  "rejectionReason": "Reason for rejection"
}
```

#### Delete Application
```
DELETE /api/applications/{id}
```

### Students (Enhanced)

#### Create Student with Application
```
POST /api/students
{
  // ... student fields ...
  "appliedClassId": "class-id",      // Creates application
  "appliedSectionId": "section-id",  // Optional
  "academicYear": "2024-2025",
  "applicationNotes": "Notes"
}
```

---

## Migration Notes

### For Existing Students

If you have existing students without applications, you can:

1. **Option A:** Bulk create applications for all unenrolled students
2. **Option B:** Allow direct enrollment for existing students (legacy mode)
3. **Option C:** Require manual application creation for each student

### Database Migration

Run the following to apply schema changes:

```bash
npx prisma migrate dev --name add_application_model
```

Or if database is unavailable:

```bash
npx prisma generate
```

---

## Summary

This **Application → Enrollment** system provides:

1. **Clear Intent** - Teachers record WHY a student is being added
2. **Approval Workflow** - Authorized personnel review and approve
3. **Audit Trail** - Complete history of decisions
4. **Data Integrity** - Atomic transactions prevent corruption
5. **Visibility** - Clear queue and bulk template with context
6. **Role-Based Access** - Proper separation of duties

✅ **No more guessing which class a student belongs to!**
