# Quick Start Guide: Running the Migration

## Prerequisites Check

Before running migration, ensure:
- [x] PostgreSQL is running
- [x] `.env` file has correct `DATABASE_URL`
- [x] No uncommitted important changes (git status)

## Step-by-Step Migration Process

### Step 1: Backup Your Database (IMPORTANT!)

```bash
# Windows PowerShell
pg_dump -U postgres school_management > backup_$(Get-Date -Format "yyyyMMdd_HHmmss").sql

# Or using psql
psql -U postgres -c "\copy (SELECT * FROM \"Student\") TO 'students_backup.csv' CSV HEADER"
```

### Step 2: Run the Migration

```bash
cd c:\Users\Dell\Desktop\school-management

# This will apply the schema changes
npx prisma migrate dev --name add_academic_year_and_term_tables
```

**Expected output:**
```
✔ Prisma schema loaded from prisma\schema.prisma
✔ Datasource "db": PostgreSQL database "school_management"

Applying migration `add_academic_year_and_term_tables`

The following migration have been applied:

migrations/
  └─ 20241215_add_academic_year_and_term_tables/
      └─ migration.sql

✔ Generated Prisma Client
```

### Step 3: Create Seed Script

Create file `prisma/seed-academic-years.ts`:

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding academic years and terms...')

  // Delete existing data (if re-running)
  await prisma.term.deleteMany()
  await prisma.academicYear.deleteMany()

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

  console.log('✅ Created academic year:', academicYear.year)

  // Create terms
  const terms = await prisma.term.createMany({
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

  console.log('✅ Created', terms.count, 'terms')

  // Create 2025/2026 upcoming year
  const upcomingYear = await prisma.academicYear.create({
    data: {
      year: "2025/2026",
      startDate: new Date("2025-09-01"),
      endDate: new Date("2026-06-30"),
      isCurrent: false,
      isUpcoming: true,
      status: "ACTIVE",
    },
  })

  console.log('✅ Created upcoming academic year:', upcomingYear.year)

  await prisma.term.createMany({
    data: [
      {
        name: "Term 1",
        academicYearId: upcomingYear.id,
        termNumber: 1,
        startDate: new Date("2025-09-01"),
        endDate: new Date("2025-12-20"),
        isCurrent: false,
      },
      {
        name: "Term 2",
        academicYearId: upcomingYear.id,
        termNumber: 2,
        startDate: new Date("2026-01-07"),
        endDate: new Date("2026-03-28"),
        isCurrent: false,
      },
      {
        name: "Term 3",
        academicYearId: upcomingYear.id,
        termNumber: 3,
        startDate: new Date("2026-04-15"),
        endDate: new Date("2026-06-30"),
        isCurrent: false,
      },
    ],
  })

  console.log('✅ Academic years and terms seeded successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding data:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

### Step 4: Run the Seed Script

```bash
npx ts-node prisma/seed-academic-years.ts
```

**Expected output:**
```
🌱 Seeding academic years and terms...
✅ Created academic year: 2024/2025
✅ Created 3 terms
✅ Created upcoming academic year: 2025/2026
✅ Academic years and terms seeded successfully!
```

### Step 5: Verify Data

```bash
npx prisma studio
```

Open in browser and check:
- [x] AcademicYear table has 2 records
- [x] Term table has 6 records (3 per year)
- [x] One academic year has `isCurrent: true`
- [x] One term has `isCurrent: true`

### Step 6: Test the System

```bash
# Start dev server
npm run dev
```

Test these features:
1. **Pending Applications** → Bulk Approve (should use current year automatically)
2. **Attendance** → Take attendance (should link to current term)
3. **Students** → View list (should show current year enrollments)
4. **Results** → View student results (should show all years)

## Troubleshooting

### Error: "No current academic year configured"

**Cause**: Seed script didn't run or failed

**Solution**:
```bash
# Re-run seed script
npx ts-node prisma/seed-academic-years.ts

# Verify in Prisma Studio
npx prisma studio
```

### Error: "Table 'AcademicYear' does not exist"

**Cause**: Migration didn't apply

**Solution**:
```bash
# Check migration status
npx prisma migrate status

# If pending, apply migrations
npx prisma migrate deploy

# Regenerate Prisma client
npx prisma generate
```

### TypeScript Errors After Migration

**Cause**: VS Code using old Prisma client types

**Solution**:
```bash
# Regenerate client
npx prisma generate

# Restart TypeScript server in VS Code
# Press: Ctrl+Shift+P → "TypeScript: Restart TS Server"
```

### Migration Fails with Foreign Key Error

**Cause**: Existing data doesn't have required foreign keys

**Solution**: Check the migration script in `prisma/migrations/` - it should handle data migration automatically. If issues persist:

```bash
# Rollback last migration
npx prisma migrate reset

# Then re-run
npx prisma migrate dev --name add_academic_year_and_term_tables
```

## Post-Migration Checklist

After successful migration and seeding:

- [ ] Academic years table populated
- [ ] Terms table populated
- [ ] Current academic year set (`isCurrent: true`)
- [ ] Current term set (`isCurrent: true`)
- [ ] Bulk approve works without academic year selection
- [ ] Attendance queries filter by current term
- [ ] No TypeScript errors in modified files
- [ ] Dev server starts without errors

## What's Next?

1. **Update Remaining Routes**: See `ACADEMIC_CONTEXT_IMPLEMENTATION.md` for list
2. **Create Admin UI**: For managing academic years/terms
3. **Add Context Indicator**: Show current year/term in navbar
4. **Test All Workflows**: Ensure data filtering works correctly

## Quick Reference

### Get Current Context
```typescript
import { getAcademicContext } from "@/lib/academic-year"

const context = await getAcademicContext()
// { academicYearId, academicYear, termId, termName, termNumber }
```

### Filter by Current Year
```typescript
where: {
  academicYearId: context.academicYearId
}
```

### Filter by Current Term
```typescript
where: {
  academicYearId: context.academicYearId,
  termId: context.termId,
  isArchived: false
}
```

### No Filtering (Historical)
```typescript
// For results - show all years
where: {
  studentId: studentId,
  published: true
  // No academicYearId filter
}
```

## Need Help?

Refer to:
- **Full Documentation**: `ACADEMIC_CONTEXT_SYSTEM.md`
- **Implementation Details**: `ACADEMIC_CONTEXT_IMPLEMENTATION.md`
- **Reference Code**: 
  - `lib/academic-year.ts` - Core functions
  - `app/api/applications/bulk-approve/route.ts` - Enrollment example
  - `app/api/attendance/route.ts` - Operational data example

---

**Ready to proceed?** Run Step 1 (backup) then Step 2 (migration)!
