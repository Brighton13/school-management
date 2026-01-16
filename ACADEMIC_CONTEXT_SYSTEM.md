# Academic Context System Documentation

## Overview

The Academic Context System ensures that all data queries are automatically filtered by the **current academic year and term**, providing a consistent, context-aware experience throughout the school management system.

## Core Concept: Single Source of Truth

### The `getAcademicContext()` Function

Located in `lib/academic-year.ts`, this function is the **single source of truth** for academic context:

```typescript
import { getAcademicContext } from "@/lib/academic-year"

const context = await getAcademicContext()
// Returns:
// {
//   academicYearId: string,
//   academicYear: string,      // e.g., "2024/2025"
//   termId: string,
//   termName: string,           // e.g., "Term 1"
//   termNumber: number,         // e.g., 1
//   fullContext: AcademicYear   // Full Prisma object with terms
// }
```

### Why This Matters

1. **Consistency**: Every module uses the same current year/term
2. **Accuracy**: No manual academic year selection means no user errors
3. **Simplicity**: One function call replaces complex filtering logic
4. **Maintainability**: Change current year/term in one place, entire app updates

## Database Schema

### Core Models

```prisma
model AcademicYear {
  id          String   @id @default(cuid())
  year        String   @unique  // "2024/2025"
  startDate   DateTime
  endDate     DateTime
  isCurrent   Boolean  @default(false)
  isUpcoming  Boolean  @default(false)
  status      String   @default("ACTIVE")
  
  terms       Term[]
  enrollments ClassEnrollment[]
  applications Application[]
  results     Result[]
  exams       Exam[]
  fees        Fee[]
  reports     StudentReport[]
  attendance  Attendance[]
}

model Term {
  id             String   @id @default(cuid())
  name           String
  academicYearId String
  academicYear   AcademicYear @relation(fields: [academicYearId], references: [id])
  termNumber     Int
  startDate      DateTime
  endDate        DateTime
  isCurrent      Boolean  @default(false)
  
  results     Result[]
  exams       Exam[]
  fees        Fee[]
  reports     StudentReport[]
  attendance  Attendance[]
}
```

### Operational Data with Archiving

```prisma
model Attendance {
  id             String   @id @default(cuid())
  studentId      String
  sectionId      String
  date           DateTime
  status         String
  remarks        String?
  
  // Academic context
  academicYearId String
  termId         String
  isArchived     Boolean  @default(false)
  
  academicYear   AcademicYear @relation(fields: [academicYearId], references: [id])
  term           Term @relation(fields: [termId], references: [id])
  
  @@index([academicYearId, termId])
  @@index([isArchived])
  @@index([termId])
}
```

## Data Filtering Rules

### Rule 1: Operational Data (Current Term Only)

**Applies to**: Attendance, Daily Reports

Default queries show **current term only**:

```typescript
// GET /api/attendance
const context = await getAcademicContext()

const attendance = await prisma.attendance.findMany({
  where: {
    academicYearId: context.academicYearId,
    termId: context.termId,
    isArchived: false,  // Exclude archived data
  },
})
```

**Admin Override**: Use `includeArchived=true` query param to see historical data

### Rule 2: Academic Records (Current Year)

**Applies to**: Enrollments, Exams, Fees

Default queries show **current academic year**:

```typescript
// GET /api/classes/:id/students
const context = await getAcademicContext()

const enrollments = await prisma.classEnrollment.findMany({
  where: {
    classId: classId,
    academicYearId: context.academicYearId,
    status: "ACTIVE",
  },
})
```

### Rule 3: Historical Data (Never Filtered)

**Applies to**: Results, Report Cards

Results remain accessible across all years for progress tracking:

```typescript
// GET /api/students/:id/results - NO CONTEXT FILTERING
const results = await prisma.result.findMany({
  where: {
    studentId: studentId,
    published: true,
  },
  orderBy: [
    { academicYear: { year: "desc" } },
    { term: { termNumber: "asc" } },
  ],
})
```

### Rule 4: Applications (Current/Upcoming Years Only)

Students can only apply for current or upcoming academic years:

```typescript
// POST /api/applications/bulk-approve
const context = await getAcademicContext()

await prisma.classEnrollment.create({
  data: {
    studentId: student.id,
    classId: application.appliedClassId,
    sectionId: sectionId,
    academicYearId: context.academicYearId,  // Always current year
  },
})
```

## Implementation Guide

### Step 1: Import the Context Function

```typescript
import { getAcademicContext } from "@/lib/academic-year"
```

### Step 2: Call at the Start of Your API Handler

```typescript
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get academic context EARLY
    const context = await getAcademicContext()

    // Now use context in all queries...
  }
}
```

### Step 3: Filter Queries with Context

```typescript
// For current year data
const enrollments = await prisma.classEnrollment.findMany({
  where: {
    academicYearId: context.academicYearId,  // ✅ Filtered
    status: "ACTIVE",
  },
})

// For current term data
const attendance = await prisma.attendance.findMany({
  where: {
    academicYearId: context.academicYearId,  // ✅ Filtered by year
    termId: context.termId,                   // ✅ Filtered by term
    isArchived: false,                        // ✅ Exclude archived
  },
})
```

### Step 4: Include Context in Create Operations

```typescript
// POST - Creating new records
await prisma.attendance.create({
  data: {
    studentId: studentId,
    sectionId: sectionId,
    date: new Date(),
    status: "PRESENT",
    academicYearId: context.academicYearId,  // ✅ Link to current year
    termId: context.termId,                   // ✅ Link to current term
    isArchived: false,
  },
})
```

## Helper Functions

### Student Enrollment

```typescript
import { getStudentCurrentEnrollment } from "@/lib/academic-year"

// Get student's active enrollment for current academic year
const enrollment = await getStudentCurrentEnrollment(studentId)
// Returns enrollment with class, section, and academicYear
```

### Current Term Attendance

```typescript
import { getCurrentTermAttendance } from "@/lib/academic-year"

// Get attendance for current term only
const attendance = await getCurrentTermAttendance(studentId)

// Include archived data (admin view)
const allAttendance = await getCurrentTermAttendance(studentId, { 
  includeArchived: true 
})
```

### Historical Attendance

```typescript
import { getHistoricalAttendance } from "@/lib/academic-year"

// Get attendance across all years/terms with filters
const history = await getHistoricalAttendance(studentId, {
  academicYearId: "specific-year-id",
  termId: "specific-term-id",
  startDate: new Date("2024-01-01"),
  endDate: new Date("2024-03-31"),
})
```

### Student Results (Historical)

```typescript
import { getStudentResults } from "@/lib/academic-year"

// Get all results (never filtered by context)
const allResults = await getStudentResults(studentId)

// Get published results only
const publishedResults = await getStudentResults(studentId, { 
  publishedOnly: true 
})

// Filter to specific year/term
const termResults = await getStudentResults(studentId, {
  publishedOnly: true,
  academicYearId: "year-id",
  termId: "term-id",
})
```

## Archiving System

### When to Archive

Attendance and operational data should be archived when:
1. A term ends
2. An academic year completes
3. Admin manually triggers archiving

### How to Archive

```typescript
import { archiveTermData } from "@/lib/academic-year"

// Archive all attendance for a completed term
const result = await archiveTermData(termId)
// Returns: {
//   termId: string,
//   termName: string,
//   academicYear: string,
//   archivedAttendance: number  // Count of records archived
// }
```

### Archived Data Behavior

- **Default Queries**: Exclude archived data (`isArchived: false`)
- **Admin Queries**: Include archived data with `includeArchived=true` param
- **Never Deleted**: Archived data remains in database for compliance/auditing

## API Route Examples

### Example 1: Attendance API (Operational Data)

```typescript
// app/api/attendance/route.ts
import { getAcademicContext } from "@/lib/academic-year"

export async function GET(request: NextRequest) {
  const context = await getAcademicContext()
  const includeArchived = request.nextUrl.searchParams.get("includeArchived") === "true"

  const attendance = await prisma.attendance.findMany({
    where: {
      sectionId: sectionId,
      academicYearId: context.academicYearId,  // Current year
      termId: context.termId,                   // Current term
      isArchived: includeArchived ? undefined : false,  // Exclude archived unless requested
    },
  })

  return NextResponse.json({
    attendance,
    academicYear: context.academicYear,
    term: context.termName,
  })
}

export async function POST(request: NextRequest) {
  const context = await getAcademicContext()

  await prisma.attendance.create({
    data: {
      studentId,
      sectionId,
      date: new Date(),
      status: "PRESENT",
      academicYearId: context.academicYearId,
      termId: context.termId,
      isArchived: false,
    },
  })
}
```

### Example 2: Class Students API (Academic Records)

```typescript
// app/api/classes/[id]/students/route.ts
import { getAcademicContext } from "@/lib/academic-year"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const context = await getAcademicContext()

  const students = await prisma.classEnrollment.findMany({
    where: {
      classId: params.id,
      academicYearId: context.academicYearId,  // Only current year enrollments
      status: "ACTIVE",
    },
    include: {
      student: {
        include: { user: true },
      },
      section: true,
    },
  })

  return NextResponse.json({
    students,
    academicYear: context.academicYear,
  })
}
```

### Example 3: Student Results API (Historical Data)

```typescript
// app/api/students/[id]/results/route.ts
// NO CONTEXT FILTERING - Results are always historical

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const results = await prisma.result.findMany({
    where: {
      studentId: params.id,
      published: true,
      // NO academicYearId filter - show all results
    },
    orderBy: [
      { academicYear: { year: "desc" } },
      { term: { termNumber: "asc" } },
    ],
    include: {
      academicYear: true,
      term: true,
      classSubject: {
        include: { subject: true },
      },
    },
  })

  return NextResponse.json({ results })
}
```

## Migration Steps

### 1. Run the Migration

```bash
npx prisma migrate dev --name add_academic_year_and_term_tables
```

### 2. Seed Initial Data

Create academic years and terms:

```typescript
// prisma/seed-academic-years.ts
import { prisma } from "./lib/prisma"

async function main() {
  // Create 2024/2025 academic year
  const academicYear = await prisma.academicYear.create({
    data: {
      year: "2024/2025",
      startDate: new Date("2024-09-01"),
      endDate: new Date("2025-06-30"),
      isCurrent: true,
      isUpcoming: false,
      status: "ACTIVE",
    },
  })

  // Create terms
  await prisma.term.createMany({
    data: [
      {
        name: "Term 1",
        academicYearId: academicYear.id,
        termNumber: 1,
        startDate: new Date("2024-09-01"),
        endDate: new Date("2024-12-20"),
        isCurrent: true,
      },
      {
        name: "Term 2",
        academicYearId: academicYear.id,
        termNumber: 2,
        startDate: new Date("2025-01-07"),
        endDate: new Date("2025-03-28"),
        isCurrent: false,
      },
      {
        name: "Term 3",
        academicYearId: academicYear.id,
        termNumber: 3,
        startDate: new Date("2025-04-15"),
        endDate: new Date("2025-06-30"),
        isCurrent: false,
      },
    ],
  })

  console.log("Academic years and terms seeded successfully!")
}

main()
```

Run: `npx ts-node prisma/seed-academic-years.ts`

### 3. Update Existing API Routes

Replace manual academic year handling with `getAcademicContext()`:

**Before:**
```typescript
const { academicYear } = await request.json()
// Manual validation, error-prone
```

**After:**
```typescript
const context = await getAcademicContext()
// Always correct, always current
```

### 4. Test the System

1. ✅ Create attendance - should link to current year/term
2. ✅ View attendance - should show current term only
3. ✅ View results - should show all years
4. ✅ Approve applications - should enroll in current year
5. ✅ Change current term - data should update automatically

## Admin UI Requirements

### Academic Year Management Page

Create `/dashboard/admin/academic-years` with:

1. **List All Academic Years**
   - Show year, dates, status, isCurrent, isUpcoming
   - Edit, Delete actions

2. **Set Current Academic Year**
   - Button to mark a year as current
   - Only one year can be current

3. **Manage Terms**
   - Create/edit terms for each year
   - Set current term
   - Only one term can be current

4. **Archive Term**
   - Button to archive completed terms
   - Shows count of records to be archived
   - Confirmation dialog

### Example UI Component

```typescript
async function setCurrentTerm(termId: string) {
  const res = await fetch("/api/system-settings/current-term", {
    method: "POST",
    body: JSON.stringify({ termId }),
  })
  
  if (res.ok) {
    toast({ title: "Current term updated! All screens now show new term data." })
    router.refresh()  // Refresh entire app
  }
}
```

## Common Pitfalls

### ❌ Don't: Accept academicYearId from client

```typescript
// BAD - User can send any year
const { academicYearId } = await request.json()
await prisma.classEnrollment.create({
  data: { academicYearId }  // Could enroll in past year!
})
```

### ✅ Do: Always use getAcademicContext()

```typescript
// GOOD - Always uses current year
const context = await getAcademicContext()
await prisma.classEnrollment.create({
  data: { academicYearId: context.academicYearId }
})
```

### ❌ Don't: Forget to filter by isArchived

```typescript
// BAD - Will return archived data
const attendance = await prisma.attendance.findMany({
  where: { studentId }
})
```

### ✅ Do: Always exclude archived data by default

```typescript
// GOOD - Only shows active data
const attendance = await prisma.attendance.findMany({
  where: { 
    studentId,
    isArchived: false  // ✅
  }
})
```

## Benefits Summary

1. **Data Integrity**: Foreign keys prevent orphaned records
2. **User Experience**: Students/teachers only see relevant data
3. **Performance**: Indexed queries are faster with context filters
4. **Compliance**: Archived data preserved for auditing
5. **Maintainability**: Single source of truth simplifies codebase
6. **Flexibility**: Admin can change current year/term instantly

## Next Steps

1. ✅ Schema restructured with AcademicYear and Term tables
2. ✅ Created getAcademicContext() and helper functions
3. ✅ Updated bulk-approve endpoint as reference implementation
4. ✅ Updated attendance API as reference implementation
5. ⏳ Run migration to apply schema changes
6. ⏳ Seed initial academic year and terms
7. ⏳ Update remaining API routes (classes, students, fees, exams, etc.)
8. ⏳ Create admin UI for academic year/term management
9. ⏳ Add archiving automation (cron job or manual trigger)
10. ⏳ Update frontend components to use academic context

---

**For questions or issues, refer to this document or check the reference implementations in:**
- `lib/academic-year.ts` - Core functions
- `app/api/applications/bulk-approve/route.ts` - Enrollment context
- `app/api/attendance/route.ts` - Operational data with archiving
