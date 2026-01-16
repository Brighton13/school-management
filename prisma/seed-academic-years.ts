import { prisma } from "../lib/prisma"

async function seedAcademicYearsAndTerms() {
  console.log("Seeding academic years and terms...")

  // Create current academic year (2024-2025)
  const currentYear = await prisma.academicYear.upsert({
    where: { year: "2024-2025" },
    update: {},
    create: {
      year: "2024-2025",
      startDate: new Date("2024-09-01"),
      endDate: new Date("2025-07-31"),
      isCurrent: true,
      isUpcoming: false,
      status: "ACTIVE",
    },
  })

  // Create terms for current year
  await prisma.term.upsert({
    where: {
      academicYearId_termNumber: {
        academicYearId: currentYear.id,
        termNumber: 1,
      },
    },
    update: {},
    create: {
      name: "First Term",
      academicYearId: currentYear.id,
      termNumber: 1,
      startDate: new Date("2024-09-01"),
      endDate: new Date("2024-12-20"),
      isCurrent: false, // First term is over
    },
  })

  await prisma.term.upsert({
    where: {
      academicYearId_termNumber: {
        academicYearId: currentYear.id,
        termNumber: 2,
      },
    },
    update: {},
    create: {
      name: "Second Term",
      academicYearId: currentYear.id,
      termNumber: 2,
      startDate: new Date("2025-01-06"),
      endDate: new Date("2025-04-10"),
      isCurrent: true, // Current term
    },
  })

  await prisma.term.upsert({
    where: {
      academicYearId_termNumber: {
        academicYearId: currentYear.id,
        termNumber: 3,
      },
    },
    update: {},
    create: {
      name: "Third Term",
      academicYearId: currentYear.id,
      termNumber: 3,
      startDate: new Date("2025-04-21"),
      endDate: new Date("2025-07-31"),
      isCurrent: false, // Upcoming term
    },
  })

  // Create upcoming academic year (2025-2026)
  const upcomingYear = await prisma.academicYear.upsert({
    where: { year: "2025-2026" },
    update: {},
    create: {
      year: "2025-2026",
      startDate: new Date("2025-09-01"),
      endDate: new Date("2026-07-31"),
      isCurrent: false,
      isUpcoming: true,
      status: "ACTIVE",
    },
  })

  // Create terms for upcoming year
  await prisma.term.upsert({
    where: {
      academicYearId_termNumber: {
        academicYearId: upcomingYear.id,
        termNumber: 1,
      },
    },
    update: {},
    create: {
      name: "First Term",
      academicYearId: upcomingYear.id,
      termNumber: 1,
      startDate: new Date("2025-09-01"),
      endDate: new Date("2025-12-20"),
      isCurrent: false,
    },
  })

  await prisma.term.upsert({
    where: {
      academicYearId_termNumber: {
        academicYearId: upcomingYear.id,
        termNumber: 2,
      },
    },
    update: {},
    create: {
      name: "Second Term",
      academicYearId: upcomingYear.id,
      termNumber: 2,
      startDate: new Date("2026-01-06"),
      endDate: new Date("2026-04-10"),
      isCurrent: false,
    },
  })

  await prisma.term.upsert({
    where: {
      academicYearId_termNumber: {
        academicYearId: upcomingYear.id,
        termNumber: 3,
      },
    },
    update: {},
    create: {
      name: "Third Term",
      academicYearId: upcomingYear.id,
      termNumber: 3,
      startDate: new Date("2026-04-21"),
      endDate: new Date("2026-07-31"),
      isCurrent: false,
    },
  })

  // Create past academic year for reference (2023-2024) - COMPLETED
  const pastYear = await prisma.academicYear.upsert({
    where: { year: "2023-2024" },
    update: {},
    create: {
      year: "2023-2024",
      startDate: new Date("2023-09-01"),
      endDate: new Date("2024-07-31"),
      isCurrent: false,
      isUpcoming: false,
      status: "COMPLETED", // Past year is completed
    },
  })

  console.log("✅ Academic years and terms seeded successfully!")
  console.log(`  - Current: ${currentYear.year}`)
  console.log(`  - Upcoming: ${upcomingYear.year}`)
  console.log(`  - Past (Completed): ${pastYear.year}`)
}

seedAcademicYearsAndTerms()
  .catch((e) => {
    console.error("Error seeding academic years:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
