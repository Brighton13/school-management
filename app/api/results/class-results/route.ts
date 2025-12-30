import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "TEACHER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const classId = searchParams.get("classId")
    const sectionId = searchParams.get("sectionId")
    const termId = searchParams.get("termId")
    const academicYearId = searchParams.get("academicYearId")
    const examId = searchParams.get("examId")

    // Get staff member
    const staff = await prisma.staff.findUnique({
      where: { userId: session.user.id },
      include: {
        sections: {
          include: {
            class: true,
            enrollments: {
              include: {
                student: {
                  include: { user: true },
                },
              },
            },
          },
        },
      },
    })

    if (!staff) {
      return NextResponse.json({ error: "Staff record not found" }, { status: 404 })
    }

    // Get all sections where this teacher is class teacher
    const classTeacherSections = staff.sections
    if (classTeacherSections.length === 0) {
      return NextResponse.json({ sections: [], students: [], totalResults: 0 })
    }

    // If no sectionId provided, return sections only
    if (!sectionId) {
      return NextResponse.json({
        sections: classTeacherSections,
        students: [],
        totalResults: 0,
      })
    }

    const sectionIds = [sectionId]

    // Verify the section belongs to this teacher
    const validSection = classTeacherSections.find(s => s.id === sectionId)
    if (!validSection) {
      return NextResponse.json(
        { error: "You are not the class teacher for this section" },
        { status: 403 }
      )
    }

    // Get all enrollments for these sections
    const enrollments = await prisma.classEnrollment.findMany({
      where: {
        sectionId: { in: sectionIds },
        ...(academicYearId && academicYearId !== "all" ? { academicYearId } : {}),
      },
      include: {
        student: {
          include: { user: true },
        },
        section: {
          include: {
            class: true,
          },
        },
      },
    })

    const studentIds = enrollments.map(e => e.studentId)

    // Get all results for these students
    const results = await prisma.result.findMany({
      where: {
        studentId: { in: studentIds },
        ...(termId && termId !== "all" ? { termId } : {}),
        ...(academicYearId && academicYearId !== "all" ? { academicYearId } : {}),
        ...(examId && examId !== "all" ? { examId } : {}),
        status: { not: "DRAFT" }, // Only show submitted results
      },
      include: {
        student: {
          include: { user: true },
        },
        classSubject: {
          include: {
            subject: true,
            class: true,
            teacher: {
              include: { user: true },
            },
          },
        },
        term: true,
        academicYear: true,
        exam: true,
      },
      orderBy: [
        { student: { user: { name: "asc" } } },
        { classSubject: { subject: { name: "asc" } } },
      ],
    })

    // Group results by student
    const resultsByStudent = results.reduce((acc, result) => {
      const studentId = result.studentId
      if (!acc[studentId]) {
        acc[studentId] = {
          student: result.student,
          enrollment: enrollments.find(e => e.studentId === studentId),
          results: [],
        }
      }
      acc[studentId].results.push(result)
      return acc
    }, {} as Record<string, any>)

    return NextResponse.json({
      sections: classTeacherSections,
      students: Object.values(resultsByStudent),
      totalResults: results.length,
    })
  } catch (error: any) {
    console.error("Error fetching class results:", error)
    return NextResponse.json(
      { error: "Failed to fetch class results", details: error.message },
      { status: 500 }
    )
  }
}

