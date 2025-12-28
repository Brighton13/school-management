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

    if (session.user.role !== "STUDENT") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get student record
    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
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
          select: {
            marksObtained: true,
            maxMarks: true,
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
        fees: {
          include: {
            academicTerm: true,
          },
        },
      },
    })

    if (!student) {
      return NextResponse.json({ error: "Student record not found" }, { status: 404 })
    }

    const currentEnrollment = student.classEnrollment[0]
    const className = currentEnrollment
      ? `${currentEnrollment.class.name} - ${currentEnrollment.section.name}`
      : "Not Enrolled"

    // Get enrolled subjects count
    const enrolledSubjects = await prisma.studentSubjectSelection.count({
      where: {
        studentId: student.id,
        status: "ACTIVE",
      },
    })

    // Get upcoming exams
    const upcomingExams = await prisma.exam.findMany({
      where: {
        status: "ACTIVE",
        startDate: {
          gte: new Date(),
        },
      },
      include: {
        academicTerm: true,
      },
      orderBy: {
        startDate: "asc",
      },
      take: 5,
    })

    // Get student-relevant announcements
    const announcements = await prisma.announcement.findMany({
      where: {
        published: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: new Date() } },
        ],
        AND: [
          {
            OR: [
              { targetAudience: "ALL" },
              { targetAudience: "STUDENTS" },
              {
                AND: [
                  { targetAudience: "CLASS" },
                  { targetClassId: currentEnrollment?.classId || "" },
                ],
              },
            ],
          },
        ],
      },
      include: {
        creator: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
    })

    // Calculate overall average from results
    const averageScore = student.results.length > 0
      ? student.results.reduce((sum, r) => sum + (r.marksObtained / r.maxMarks * 100), 0) / student.results.length
      : 0

    // Calculate attendance
    const attendance = {
      present: student.attendance.filter((a) => a.status === "PRESENT").length,
      absent: student.attendance.filter((a) => a.status === "ABSENT").length,
      late: student.attendance.filter((a) => a.status === "LATE").length,
      total: student.attendance.length,
      rate:
        student.attendance.length > 0
          ? (student.attendance.filter((a) => a.status === "PRESENT").length /
              student.attendance.length) *
            100
          : 0,
    }

    // Calculate fees
    const fees = {
      total: student.fees.reduce((sum, f) => sum + f.amount, 0),
      paid: student.fees.reduce((sum, f) => sum + f.paidAmount, 0),
      pending: student.fees.filter((f) => f.status === "PENDING").length,
      overdue: student.fees.filter((f) => f.status === "OVERDUE").length,
    }

    return NextResponse.json({
      student: {
        name: student.user.name,
        admissionNumber: student.admissionNumber,
        className,
      },
      totalSubjects: enrolledSubjects,
      averageScore,
      attendance,
      fees,
      upcomingExams: upcomingExams.map((exam) => ({
        examName: exam.name,
        subjectName: "Multiple Subjects", // Since exams can be for multiple subjects
        date: exam.startDate?.toISOString() || "",
        examType: exam.examType,
      })),
      announcements: announcements.map((announcement) => ({
        id: announcement.id,
        title: announcement.title,
        content: announcement.content,
        type: announcement.type,
        targetAudience: announcement.targetAudience,
        createdBy: announcement.creator.name,
        createdAt: announcement.createdAt.toISOString(),
        publishedAt: announcement.publishedAt?.toISOString() || null,
        expiresAt: announcement.expiresAt?.toISOString() || null,
      })),
    })
  } catch (error) {
    console.error("Student analytics error:", error)
    return NextResponse.json(
      { error: "Failed to fetch student analytics" },
      { status: 500 }
    )
  }
}

