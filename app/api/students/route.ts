import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { logAuditTrail } from "@/lib/audit"

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
      const enrollments = await prisma.classEnrollment.findMany({
        where: enrollmentWhere,
        include: {
          student: {
            include: {
              user: true,
            },
          },
        },
        orderBy: {
          student: {
            admissionNumber: "asc",
          },
        },
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
              enrollments: {
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
        return NextResponse.json([])
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
        return NextResponse.json([])
      }

      studentIds = allStudentIds
    }

    const students = await prisma.student.findMany({
      where: {
        ...(studentIds ? { id: { in: studentIds } } : {}),
      },
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
    })

    return NextResponse.json(students)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch students" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !["ADMIN", "PRINCIPAL"].includes(session.user.role)) {
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

