import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"
import { getCurrentAcademicYear } from "@/lib/academic-year"
import { requirePermission, Permissions } from "@/lib/permissions"
import { parsePaginationParams, createPaginatedResponse, parseBoundedListLimit } from "@/lib/pagination"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")
    const allYears = searchParams.get("allYears") === "true" // Optional flag to get all years
    const classId = searchParams.get("classId")
    const sectionId = searchParams.get("sectionId")
    const status = searchParams.get("status")
    const search = searchParams.get("search")
    const noPagination = searchParams.get("noPagination") === "true"
    
    // Parse pagination params
    const { page, limit, offset } = parsePaginationParams(searchParams)

    // Get current academic year
    const currentAcademicYear = await getCurrentAcademicYear()
    if (!currentAcademicYear && !allYears) {
      return NextResponse.json(
        { error: "No current academic year configured" },
        { status: 400 }
      )
    }

    // For teachers, filter enrollments based on their assignments
    let studentIds: string[] | undefined
    if (session.user.role === "TEACHER") {
      const staff = await prisma.staff.findUnique({
        where: { userId: session.user.id },
        include: {
          // Get sections where teacher is class teacher
          sections: {
            include: {
              enrollments: {
                where: currentAcademicYear ? { academicYearId: currentAcademicYear.id } : {},
                select: { studentId: true },
              },
            },
          },
          // Get class-subjects where teacher teaches
          classSubjects: {
            include: {
              class: {
                include: {
                  enrollments: {
                    where: currentAcademicYear ? { academicYearId: currentAcademicYear.id } : {},
                    select: { studentId: true },
                  },
                },
              },
            },
          },
        },
      })

      if (!staff) {
        // Teacher has no assignments, return empty
        return NextResponse.json(noPagination ? [] : createPaginatedResponse([], 0, page, limit))
      }

      // Collect student IDs from:
      // 1. Sections where teacher is class teacher
      const classTeacherStudentIds = staff.sections.flatMap((section: { enrollments: Array<{ studentId: string }> }) =>
        section.enrollments.map((enrollment: { studentId: string }) => enrollment.studentId)
      )

      // 2. Classes where teacher teaches subjects
      const subjectTeacherStudentIds = staff.classSubjects.flatMap((cs: { class: { enrollments: Array<{ studentId: string }> } }) =>
        cs.class.enrollments.map((enrollment: { studentId: string }) => enrollment.studentId)
      )

      // Combine and deduplicate
      const allStudentIds = Array.from(new Set([...classTeacherStudentIds, ...subjectTeacherStudentIds]))
      
      if (allStudentIds.length === 0) {
        return NextResponse.json(noPagination ? [] : createPaginatedResponse([], 0, page, limit))
      }

      studentIds = allStudentIds
    }

    const whereClause: any = {
      ...(studentId ? { studentId } : {}),
      ...(studentIds ? { studentId: { in: studentIds } } : {}),
      // Filter by current academic year unless allYears flag is set
      ...(!allYears && currentAcademicYear ? { academicYearId: currentAcademicYear.id } : {}),
      ...(classId ? { classId } : {}),
      ...(sectionId ? { sectionId } : {}),
      ...(status ? { status } : {}),
    }

    // Add search filter
    if (search) {
      whereClause.OR = [
        { student: { user: { name: { contains: search, mode: "insensitive" } } } },
        { student: { admissionNumber: { contains: search, mode: "insensitive" } } },
      ]
    }

    // Get total count
    const total = await prisma.classEnrollment.count({ where: whereClause })

    const enrollments = await prisma.classEnrollment.findMany({
      where: whereClause,
      include: {
        student: {
          include: { user: true },
        },
        class: true,
        section: true,
        academicYear: true,
      },
      orderBy: { enrolledAt: "desc" },
      ...(noPagination ? { take: parseBoundedListLimit(searchParams) } : { skip: offset, take: limit }),
    })

    if (noPagination) {
      return NextResponse.json(enrollments)
    }

    return NextResponse.json(createPaginatedResponse(enrollments, total, page, limit))
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch enrollments" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, Permissions.ENROLLMENT_CREATE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { studentId, classId, sectionId, academicYear } = body

    // Find the academic year by year string
    const academicYearRecord = await prisma.academicYear.findUnique({
      where: { year: academicYear },
    })

    if (!academicYearRecord) {
      return NextResponse.json(
        { error: "Academic year not found" },
        { status: 400 }
      )
    }

    const enrollment = await prisma.classEnrollment.create({
      data: {
        studentId,
        classId,
        sectionId,
        academicYearId: academicYearRecord.id,
      },
      include: {
        student: {
          include: { user: true },
        },
        class: true,
        section: true,
        academicYear: true,
      },
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "CREATE",
      "Enrollment",
      request,
      {
        entityId: enrollment.id,
        description: `Enrolled ${enrollment.student.user.name} in ${enrollment.class.name} - ${enrollment.section.name} (${academicYear})`,
      }
    )

    return NextResponse.json(enrollment, { status: 201 })
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Student already enrolled in this class and section" },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Failed to create enrollment" },
      { status: 500 }
    )
  }
}

