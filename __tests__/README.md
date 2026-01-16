# Test Suite Documentation

This directory contains comprehensive workflow tests for the school management system.

## Test Structure

### Workflow Tests

1. **Admin Workflow** (`admin-workflow.test.ts`)
   - Admin creates academic term
   - Admin creates class
   - Admin creates section
   - Admin creates subject
   - Admin creates exam
   - Admin creates teacher and staff record
   - Admin assigns teacher to class-subject
   - Admin assigns class teacher to section

2. **Teacher Workflow** (`teacher-workflow.test.ts`)
   - Teacher enters result for assigned subject
   - Teacher can only see students from assigned classes
   - Result automatically goes to class teacher when submitted

3. **Class Teacher Workflow** (`class-teacher-workflow.test.ts`)
   - Class teacher can view all results for their class
   - Class teacher can submit all class results for approval

4. **Principal Workflow** (`principal-workflow.test.ts`)
   - Principal can view pending approvals
   - Principal can approve results
   - Principal can publish approved results
   - Complete workflow verification

5. **Integration Workflow** (`integration-workflow.test.ts`)
   - Complete end-to-end test covering:
     - Admin setup (terms, classes, sections, subjects, exams)
     - Student enrollment
     - Teacher assignment
     - Result entry by subject teacher
     - Class teacher review and submission
     - Principal approval and publication

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run a specific test file
npm test -- admin-workflow.test.ts
```

## Test Workflow

The tests verify the complete workflow:

1. **Admin Setup Phase**
   - Creates academic terms
   - Creates classes and sections
   - Creates subjects
   - Creates exams
   - Enrolls students
   - Assigns teachers to classes/subjects

2. **Teacher Phase**
   - Subject teachers enter results
   - Results automatically go to `PENDING_CLASS_TEACHER` status

3. **Class Teacher Phase**
   - Class teachers review all results for their class
   - Submit all results for principal approval
   - Status changes to `PENDING_APPROVAL`

4. **Principal Phase**
   - Principal reviews pending results
   - Approves results (status: `APPROVED`)
   - Publishes results (status: `PUBLISHED`)

## Test Data

Each test suite creates its own test data and cleans up after execution. Test users are created with the following pattern:
- Admin: `testadmin*@school.com`
- Principal: `testprincipal@school.com`
- Teachers: `testteacher*@school.com`, `testclassteacher*@school.com`
- Students: `teststudent*@school.com`

## Notes

- Tests use the same database as the application (SQLite)
- Each test suite cleans up its data in `afterAll`
- Tests run sequentially to avoid database conflicts
- Test timeout is set to 30 seconds for database operations

## Expected Results

When all tests pass, you should see:
- ✅ Admin can perform all management tasks
- ✅ Teachers can only access their assigned students/subjects
- ✅ Results flow correctly: Teacher → Class Teacher → Principal
- ✅ Complete integration workflow works end-to-end

