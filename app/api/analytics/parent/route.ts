import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "PARENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get parent record
    const parent = await prisma.parent.findUnique({
      where: { userId: session.user.id },
      include: {
        students: {
          include: {
            student: {
              include: {
                user: true,
                classEnrollment: {
                  include: {
                    class: true,
                    section: true,
                  },
                  where: {
                    status: "ACTIVE",
                  },
                  take: 1,
                },
                results: {
                  include: {
                    classSubject: {
                      include: {
                        subject: true,
                      },
                    },
                  },
                  where: {
                    status: { in: ["APPROVED", "PUBLISHED"] },
                  },
                },
                attendance: {
                  where: {
                    date: {
                      gte: new Date(new Date().setDate(new Date().getDate() - 30)),
                    },
                  },
                },
                fees: true,
              },
            },
          },
        },
      },
    })

    if (!parent) {
      return NextResponse.json({ error: "Parent record not found" }, { status: 404 })
    }

    const children = parent.students.map((sp) => {
      const student = sp.student
      const enrollment = student.classEnrollment[0]
      const className = enrollment
        ? `${enrollment.class.name} - ${enrollment.section.name}`
        : "Not Enrolled"

      // Calculate average score
      const averageScore =
        student.results.length > 0
          ? student.results.reduce(
              (sum, r) => sum + (r.marksObtained / r.maxMarks) * 100,
              0
            ) / student.results.length
          : 0

      // Calculate attendance rate
      const attendanceRate =
        student.attendance.length > 0
          ? (student.attendance.filter((a) => a.status === "PRESENT").length /
              student.attendance.length) *
            100
          : 0

      // Calculate pending fees
      const pendingFees = student.fees
        .filter((f) => f.status === "PENDING" || f.status === "OVERDUE")
        .reduce((sum, f) => sum + (f.amount - f.paidAmount), 0)

      return {
        id: student.id,
        name: student.user.name,
        admissionNumber: student.admissionNumber,
        className,
        averageScore,
        attendanceRate,
        pendingFees,
      }
    })

    // Calculate total fees
    const allFees = parent.students.flatMap((sp) => sp.student.fees)
    const totalFees = {
      total: allFees.reduce((sum, f) => sum + f.amount, 0),
      paid: allFees.reduce((sum, f) => sum + f.paidAmount, 0),
      pending: allFees
        .filter((f) => f.status === "PENDING" || f.status === "OVERDUE")
        .reduce((sum, f) => sum + (f.amount - f.paidAmount), 0),
    }

    return NextResponse.json({
      children,
      totalFees,
    })
  } catch (error) {
    console.error("Parent analytics error:", error)
    return NextResponse.json(
      { error: "Failed to fetch parent analytics" },
      { status: 500 }
    )
  }
}

