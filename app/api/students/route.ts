import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { logAuditTrail } from "@/lib/audit"
import { requirePermission, Permissions, hasPermission } from "@/lib/permissions"
import { parsePaginationParams, createPaginatedResponse, parseBoundedListLimit } from "@/lib/pagination"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const classId = searchParams.get("classId")
    const sectionId = searchParams.get("sectionId")
    const currentAcademicYear = searchParams.get("currentAcademicYear") === "true"
    const teacherFilter = searchParams.get("teacherFilter") === "true"
    const search = searchParams.get("search")
    const status = searchParams.get("status")
    const noPagination = searchParams.get("noPagination") === "true"
    const compact = searchParams.get("compact") === "true"
    
    // Parse pagination params
    const { page, limit, offset } = parsePaginationParams(searchParams)

    // If filtering by class/section for current academic year
    if (classId && currentAcademicYear) {
      // Get current academic year
      const academicYear = await prisma.academicYear.findFirst({
        where: { isCurrent: true },
      })

      if (!academicYear) {
        return NextResponse.json({ error: "No current academic year found" }, { status: 400 })
      }

      // Build enrollment filter
      const enrollmentWhere: any = {
        classId,
        academicYearId: academicYear.id,
        status: "ACTIVE",
      }

      if (sectionId) {
        enrollmentWhere.sectionId = sectionId
      }

      // Get students enrolled in this class/section
      const listLimit = parseBoundedListLimit(searchParams, 250)
      const enrollments = await prisma.classEnrollment.findMany({
        where: enrollmentWhere,
        include: {
          student: {
            select: {
              id: true,
              admissionNumber: true,
              user: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          student: {
            admissionNumber: "asc",
          },
        },
        take: listLimit,
      })

      // Map to student format expected by frontend
      const students = enrollments.map(e => ({
        id: e.student.id,
        admissionNumber: e.student.admissionNumber,
        user: {
          name: e.student.user.name,
        },
      }))

      return NextResponse.json(students)
    }

    // For teachers, filter students based on their assignments
    let studentIds: string[] | undefined
    if (session.user.role === "TEACHER") {
      const staff = await prisma.staff.findUnique({
        where: { userId: session.user.id },
        include: {
          // Get sections where teacher is class teacher
          sections: {
            include: {
              class: true,
              enrollments: {
                select: { studentId: true, classId: true, sectionId: true },
              },
            },
          },
          // Get class-subjects where teacher teaches
          classSubjects: {
            include: {
              section: true,
              class: {
                include: {
                  enrollments: {
                    select: { studentId: true, classId: true, sectionId: true },
                  },
                },
              },
            },
          },
        },
      })

      if (!staff) {
        // Teacher has no assignments, return empty
        return NextResponse.json([])
      }

      // If teacherFilter is true and classId/sectionId provided, filter specifically
      if (teacherFilter && (classId || sectionId)) {
        // Verify teacher has access to this class/section
        const hasClassTeacherAccess = staff.sections.some(
          (s: { classId: string; id: string }) => 
            (!classId || s.classId === classId) && (!sectionId || s.id === sectionId)
        )
        const hasSubjectTeacherAccess = staff.classSubjects.some(
          (cs: { classId: string; sectionId: string | null }) => 
            (!classId || cs.classId === classId) && (!sectionId || cs.sectionId === sectionId || !cs.sectionId)
        )

        if (!hasClassTeacherAccess && !hasSubjectTeacherAccess) {
          return NextResponse.json({ error: "Access denied to this class/section" }, { status: 403 })
        }

        // Filter students based on the selected class/section
        let filteredStudentIds: string[] = []
        
        // From class teacher sections
        staff.sections.forEach((section: { classId: string; id: string; enrollments: Array<{ studentId: string; classId: string; sectionId: string }> }) => {
          if ((!classId || section.classId === classId) && (!sectionId || section.id === sectionId)) {
            filteredStudentIds.push(...section.enrollments.map(e => e.studentId))
          }
        })

        // From subject teaching assignments
        staff.classSubjects.forEach((cs: { classId: string; sectionId: string | null; class: { enrollments: Array<{ studentId: string; classId: string; sectionId: string }> } }) => {
          if ((!classId || cs.classId === classId) && (!sectionId || cs.sectionId === sectionId || !cs.sectionId)) {
            const enrollments = cs.class.enrollments.filter(
              (e: { classId: string; sectionId: string }) => (!sectionId || e.sectionId === sectionId)
            )
            filteredStudentIds.push(...enrollments.map(e => e.studentId))
          }
        })

        studentIds = Array.from(new Set(filteredStudentIds))
        
        if (studentIds.length === 0) {
          return NextResponse.json([])
        }
      } else {
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
    }

    // Build where clause
    const whereClause: any = {
      ...(studentIds ? { id: { in: studentIds } } : {}),
      ...(status ? { status } : {}),
    }

    // Add search filter
    if (search) {
      whereClause.OR = [
        { admissionNumber: { contains: search, mode: "insensitive" } },
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
      ]
    }

    // Get total count for pagination
    const total = await prisma.student.count({ where: whereClause })

    if (compact) {
      const listLimit = noPagination ? parseBoundedListLimit(searchParams) : limit
      const students = await prisma.student.findMany({
        where: whereClause,
        select: {
          id: true,
          admissionNumber: true,
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: { admissionNumber: "asc" },
        ...(noPagination ? { take: listLimit } : { skip: offset, take: limit }),
      })

      if (noPagination) {
        return NextResponse.json(students)
      }

      return NextResponse.json(createPaginatedResponse(students, total, page, limit))
    }

    const students = await prisma.student.findMany({
      where: whereClause,
      include: {
        user: true,
        classEnrollment: {
          include: {
            class: true,
            section: true,
            academicYear: true,
          },
          orderBy: { enrolledAt: "desc" },
          take: 1,
        },
        applications: {
          include: {
            appliedClass: true,
            appliedSection: true,
            academicYear: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
      ...(noPagination ? { take: parseBoundedListLimit(searchParams) } : { skip: offset, take: limit }),
    })

    // Return without pagination wrapper if noPagination is true (for dropdowns, etc.)
    if (noPagination) {
      return NextResponse.json(students)
    }

    return NextResponse.json(createPaginatedResponse(students, total, page, limit))
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch students" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, Permissions.STUDENTS_CREATE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      email,
      password,
      name,
      phone,
      admissionNumber,
      dateOfBirth,
      gender,
      address,
      emergencyContact,
      appliedClassId,
      appliedSectionId,
      academicYear,
      applicationNotes,
    } = body

    const hashedPassword = await bcrypt.hash(password, 10)

    // Transaction: Create user, student, and application
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          phone,
          role: "STUDENT",
          student: {
            create: {
              admissionNumber,
              dateOfBirth: new Date(dateOfBirth),
              gender,
              address,
              emergencyContact,
            },
          },
        },
        include: {
          student: true,
        },
      })

      // If appliedClassId is provided, create an application
      let application = null
      if (appliedClassId && academicYear) {
        application = await tx.application.create({
          data: {
            studentId: user.student!.id,
            appliedClassId,
            appliedSectionId: appliedSectionId || null,
            academicYearId: academicYear,
            notes: applicationNotes || null,
            createdBy: session.user.id,
          },
          include: {
            appliedClass: true,
            appliedSection: true,
          },
        })
      }

      return { user, application }
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "CREATE",
      "Student",
      request,
      {
        entityId: result.user.student?.id,
        description: result.application 
          ? `Created student: ${name} (${admissionNumber}) with application to ${result.application.appliedClass.name}`
          : `Created student: ${name} (${admissionNumber})`,
      }
    )

    return NextResponse.json(result, { status: 201 })
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Email or admission number already exists" },
        { status: 400 }
      )
    }
    console.error("Failed to create student:", error)
    return NextResponse.json(
      { error: "Failed to create student" },
      { status: 500 }
    )
  }
}

