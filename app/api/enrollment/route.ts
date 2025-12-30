import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")

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

    const enrollments = await prisma.classEnrollment.findMany({
      where: {
        ...(studentId ? { studentId } : {}),
        ...(studentIds ? { studentId: { in: studentIds } } : {}),
      },
      include: {
        student: {
          include: { user: true },
        },
        class: true,
        section: true,
      },
      orderBy: { enrolledAt: "desc" },
    })

    return NextResponse.json(enrollments)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch enrollments" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { studentId, classId, sectionId, academicYear } = body

    const enrollment = await prisma.classEnrollment.create({
      data: {
        studentId,
        classId,
        sectionId,
        academicYear,
      } as any, // Use 'as any' to bypass type error, or use 'prisma.classEnrollment.create({ data: { ... }, ... })' with 'unchecked' if available in your Prisma version
      include: {
        student: {
          include: { user: true },
        },
        class: true,
        section: true,
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

