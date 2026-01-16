import { prisma } from "./prisma"

/**
 * Academic Context - Single source of truth for current year and term
 * Use this in all queries to ensure data is filtered by current academic context
 */
export async function getAcademicContext() {
  const academicYear = await prisma.academicYear.findFirst({
    where: { isCurrent: true, status: "ACTIVE" },
    include: {
      terms: {
        where: { isCurrent: true },
        orderBy: { termNumber: "asc" },
      },
    },
  })

  if (!academicYear) {
    throw new Error("No current academic year configured. Please set a current academic year in system settings.")
  }

  if (!academicYear.terms || academicYear.terms.length === 0) {
    throw new Error("No current term configured for the current academic year. Please set a current term.")
  }

  return {
    academicYearId: academicYear.id,
    academicYear: academicYear.year,
    termId: academicYear.terms[0].id,
    termName: academicYear.terms[0].name,
    termNumber: academicYear.terms[0].termNumber,
    fullContext: academicYear,
  }
}

/**
 * Get the current academic year
 */
export async function getCurrentAcademicYear() {
  return await prisma.academicYear.findFirst({
    where: { isCurrent: true, status: "ACTIVE" },
    include: {
      terms: {
        orderBy: { termNumber: "asc" },
      },
    },
  })
}

/**
 * Get the upcoming academic year
 */
export async function getUpcomingAcademicYear() {
  return await prisma.academicYear.findFirst({
    where: { isUpcoming: true, status: "ACTIVE" },
    include: {
      terms: {
        orderBy: { termNumber: "asc" },
      },
    },
  })
}

/**
 * Get all active and upcoming academic years
 */
export async function getActiveAcademicYears() {
  return await prisma.academicYear.findMany({
    where: {
      OR: [
        { isCurrent: true },
        { isUpcoming: true },
      ],
      status: "ACTIVE",
    },
    orderBy: { startDate: "asc" },
    include: {
      terms: {
        orderBy: { termNumber: "asc" },
      },
    },
  })
}

/**
 * Validate if enrollment is allowed for the given academic year
 * Students can only be enrolled in current or upcoming academic years
 */
export async function validateEnrollmentAcademicYear(academicYearId: string): Promise<{
  valid: boolean
  message?: string
  academicYear?: any
}> {
  const academicYear = await prisma.academicYear.findUnique({
    where: { id: academicYearId },
  })

  if (!academicYear) {
    return {
      valid: false,
      message: "Academic year not found",
    }
  }

  // Check if academic year is in the past
  const now = new Date()
  if (academicYear.endDate < now && !academicYear.isCurrent) {
    return {
      valid: false,
      message: `Cannot enroll students in past academic year (${academicYear.year}). Please select current or upcoming academic year.`,
      academicYear,
    }
  }

  // Check if academic year is active
  if (academicYear.status !== "ACTIVE") {
    return {
      valid: false,
      message: `Cannot enroll students in ${academicYear.status.toLowerCase()} academic year. Please select an active academic year.`,
      academicYear,
    }
  }

  // Only allow current or upcoming academic years
  if (!academicYear.isCurrent && !academicYear.isUpcoming) {
    return {
      valid: false,
      message: `Cannot enroll students in ${academicYear.year}. Only current or upcoming academic years are allowed.`,
      academicYear,
    }
  }

  return {
    valid: true,
    academicYear,
  }
}

/**
 * Get the current term
 */
export async function getCurrentTerm() {
  const context = await getAcademicContext()
  return await prisma.term.findUnique({
    where: { id: context.termId },
    include: { academicYear: true },
  })
}

/**
 * Archive data from a completed term
 * Automatically archives attendance and other operational data
 */
export async function archiveTermData(termId: string) {
  const term = await prisma.term.findUnique({
    where: { id: termId },
    include: { academicYear: true },
  })

  if (!term) {
    throw new Error("Term not found")
  }

  if (term.isCurrent) {
    throw new Error("Cannot archive current term. Please set a new current term first.")
  }

  // Archive attendance records
  const archivedAttendance = await prisma.attendance.updateMany({
    where: {
      termId: termId,
      isArchived: false,
    },
    data: {
      isArchived: true,
    },
  })

  return {
    termId,
    termName: term.name,
    academicYear: term.academicYear.year,
    archivedAttendance: archivedAttendance.count,
  }
}

/**
 * Get student's active enrollment for current academic year
 * This is the single source of truth for which class a student is in
 */
export async function getStudentCurrentEnrollment(studentId: string) {
  const context = await getAcademicContext()
  
  return await prisma.classEnrollment.findFirst({
    where: {
      studentId,
      academicYearId: context.academicYearId,
      status: "ACTIVE",
    },
    include: {
      class: true,
      section: true,
      academicYear: true,
    },
  })
}

/**
 * Get attendance for current term (default view for teachers/students)
 */
export async function getCurrentTermAttendance(
  studentId: string,
  options?: { includeArchived?: boolean }
) {
  const context = await getAcademicContext()
  
  return await prisma.attendance.findMany({
    where: {
      studentId,
      academicYearId: context.academicYearId,
      termId: context.termId,
      isArchived: options?.includeArchived ? undefined : false,
    },
    orderBy: { date: "desc" },
    include: {
      section: {
        include: {
          class: true,
        },
      },
    },
  })
}

/**
 * Get all historical attendance (for admin/reports)
 */
export async function getHistoricalAttendance(
  studentId: string,
  filters?: {
    academicYearId?: string
    termId?: string
    startDate?: Date
    endDate?: Date
  }
) {
  return await prisma.attendance.findMany({
    where: {
      studentId,
      academicYearId: filters?.academicYearId,
      termId: filters?.termId,
      date: {
        gte: filters?.startDate,
        lte: filters?.endDate,
      },
    },
    orderBy: [
      { academicYear: { year: "desc" } },
      { term: { termNumber: "desc" } },
      { date: "desc" },
    ],
    include: {
      section: {
        include: {
          class: true,
        },
      },
      academicYear: true,
      term: true,
    },
  })
}

/**
 * Get all results for a student (historical view - never filtered)
 * Students can always see their past results for tracking progress
 */
export async function getStudentResults(
  studentId: string,
  options?: {
    publishedOnly?: boolean
    academicYearId?: string
    termId?: string
  }
) {
  return await prisma.result.findMany({
    where: {
      studentId,
      published: options?.publishedOnly ? true : undefined,
      academicYearId: options?.academicYearId,
      termId: options?.termId,
    },
    orderBy: [
      { academicYear: { year: "desc" } },
      { term: { termNumber: "asc" } },
      { classSubject: { subject: { name: "asc" } } },
    ],
    include: {
      classSubject: {
        include: {
          subject: true,
        },
      },
      academicYear: true,
      term: true,
      exam: true,
    },
  })
}
