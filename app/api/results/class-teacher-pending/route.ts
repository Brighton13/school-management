import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "TEACHER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get staff member
    const staff = await prisma.staff.findUnique({
      where: { userId: session.user.id },
      include: {
        sections: {
          include: {
            enrollments: {
              include: {
                student: true,
              },
            },
          },
        },
      },
    })

    if (!staff) {
      return NextResponse.json([])
    }

    // Get all sections where this teacher is class teacher
    const sectionIds = staff.sections.map(s => s.id)

    // Get enrollments for these sections
    const enrollments = await prisma.classEnrollment.findMany({
      where: {
        sectionId: { in: sectionIds },
      },
      include: {
        student: true,
      },
    })

    const studentIds = enrollments.map(e => e.studentId)

    // Get results pending class teacher review for these students
    const results = await prisma.result.findMany({
      where: {
        studentId: { in: studentIds },
        status: "PENDING_CLASS_TEACHER",
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
        academicTerm: true,
        exam: true,
      },
      orderBy: { submittedAt: "desc" },
    })

    return NextResponse.json(results)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch pending results" },
      { status: 500 }
    )
  }
}

