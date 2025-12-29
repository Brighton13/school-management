import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"
import { createNotification } from "@/lib/notifications"

/**
 * Generate student report for a specific term/exam
 * Rules:
 * - All CORE subjects must have APPROVED results
 * - Teacher can only generate reports for their class
 * - Reports must calculate: total marks, position in class, progress ratio
 * - Report goes to principal for bulk approval
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !["TEACHER", "ADMIN", "PRINCIPAL"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { studentId, sectionId, academicTermId, examId } = body

    if (!studentId || !sectionId || !academicTermId) {
      return NextResponse.json(
        { error: "Missing required fields: studentId, sectionId, academicTermId" },
        { status: 400 }
      )
    }

    // Verify enrollment
    const enrollment = await prisma.classEnrollment.findFirst({
      where: {
        studentId,
        sectionId
      },
      include: {
        section: {
          include: {
            classTeacher: true,
            class: true,
          }
        },
        student: {
          include: { user: true }
        }
      }
    })

    if (!enrollment) {
      return NextResponse.json(
        { error: "Student not enrolled in this section/term" },
        { status: 404 }
      )
    }

    // For teachers, verify they are the class teacher
    if (session.user.role === "TEACHER") {
      if (!enrollment.section.classTeacher || enrollment.section.classTeacher.userId !== session.user.id) {
        return NextResponse.json(
          { error: "You are not the class teacher for this section" },
          { status: 403 }
        )
      }
    }

    // Check if report already exists
    const existingReport = await prisma.studentReport.findUnique({
      where: {
        studentId_academicTermId_examId: {
          studentId,
          academicTermId,
          examId: examId || null,
        }
      }
    })

    if (existingReport) {
      return NextResponse.json(
        { error: "Report already exists for this student, term, and exam combination" },
        { status: 400 }
      )
    }

    // Get all CORE subjects for this class section
    const coreSubjects = await prisma.classSubject.findMany({
      where: {
        classId: enrollment.classId,
        sectionId,
        subject: {
          type: "CORE"
        }
      },
      include: {
        subject: true,
      }
    })

    if (coreSubjects.length === 0) {
      return NextResponse.json(
        { error: "No core subjects found for this class section" },
        { status: 404 }
      )
    }

    // Verify all CORE subjects have APPROVED results
    const results = await prisma.result.findMany({
      where: {
        studentId,
        academicTermId,
        classSubjectId: {
          in: coreSubjects.map(cs => cs.id)
        },
        status: "APPROVED"
      },
      include: {
        classSubject: {
          include: { subject: true }
        }
      }
    })

    // Check if exam filter is provided
    let filteredResults = results
    if (examId) {
      filteredResults = results.filter(r => r.examId === examId)
    }

    const approvedSubjectsCount = new Set(filteredResults.map(r => r.classSubjectId)).size

    if (approvedSubjectsCount < coreSubjects.length) {
      const missingSubjects = coreSubjects
        .filter(cs => !filteredResults.some(r => r.classSubjectId === cs.id))
        .map(cs => cs.subject.name)
      
      return NextResponse.json(
        { 
          error: "Not all core subjects have approved results",
          missingSubjects,
          approvedCount: approvedSubjectsCount,
          totalRequired: coreSubjects.length
        },
        { status: 400 }
      )
    }

    // Calculate total marks and max marks
    let totalMarksObtained = 0
    let maxTotalMarks = 0

    filteredResults.forEach(result => {
      totalMarksObtained += result.marksObtained
      maxTotalMarks += result.maxMarks
    })

    // Get all students in the same section and term to calculate position
    const allStudentsResults = await prisma.result.findMany({
      where: {
        classSubject: {
          sectionId,
          subject: { type: "CORE" }
        },
        academicTermId,
        status: "APPROVED",
        ...(examId ? { examId } : {})
      },
      include: {
        student: {
          select: { id: true }
        }
      }
    })

    // Group by student and calculate total marks
    const studentTotals = new Map<string, number>()
    allStudentsResults.forEach(result => {
      const current = studentTotals.get(result.studentId) || 0
      studentTotals.set(result.studentId, current + result.marksObtained)
    })

    // Sort and find position
    const sortedStudents = Array.from(studentTotals.entries())
      .sort((a, b) => b[1] - a[1])

    const positionInClass = sortedStudents.findIndex(([id]) => id === studentId) + 1
    const classSize = studentTotals.size

    // Get previous term's results for progress ratio calculation
    let previousTermAverage = 0
    let progressRatio = 0

    const previousTerm = await prisma.academicTerm.findFirst({
      where: {
        endDate: { lt: await prisma.academicTerm.findUnique({
          where: { id: academicTermId },
          select: { startDate: true }
        }).then(t => t?.startDate || new Date()) }
      },
      orderBy: { endDate: "desc" },
      take: 1
    })

    if (previousTerm) {
      const previousResults = await prisma.result.findMany({
        where: {
          studentId,
          academicTermId: previousTerm.id,
          classSubject: {
            subject: { type: "CORE" }
          },
          status: "APPROVED"
        }
      })

      if (previousResults.length > 0) {
        const previousTotal = previousResults.reduce((sum, r) => sum + r.marksObtained, 0)
        const previousMax = previousResults.reduce((sum, r) => sum + r.maxMarks, 0)
        previousTermAverage = (previousTotal / previousMax) * 100

        const currentTermAverage = (totalMarksObtained / maxTotalMarks) * 100
        progressRatio = currentTermAverage - previousTermAverage
      }
    }

    const currentTermAverage = (totalMarksObtained / maxTotalMarks) * 100

    // Create the report
    const report = await prisma.studentReport.create({
      data: {
        studentId,
        sectionId,
        academicTermId,
        examId: examId || null,
        totalMarksObtained,
        maxTotalMarks,
        positionInClass,
        classSize,
        progressRatio,
        previousTermAverage,
        currentTermAverage,
        status: "PENDING_CLASS_TEACHER", // Class teacher submits, then goes to principal
        submittedBy: session.user.id,
        submittedAt: new Date(),
        generatedAt: new Date(),
        generatedBy: session.user.id,
      },
      include: {
        student: {
          include: { user: true }
        },
        section: {
          include: { 
            class: true,
            classTeacher: {
              include: { user: true }
            }
          }
        },
        academicTerm: true,
        exam: true,
      }
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "CREATE",
      "StudentReport",
      request,
      {
        entityId: report.id,
        description: `Generated report for ${report.student.user.name} - ${report.section.name} (Position: ${report.positionInClass}/${report.classSize})`
      }
    )

    // Create notification for principal
    const principal = await prisma.staff.findFirst({
      where: { designation: "PRINCIPAL" }
    })

    if (principal) {
      await createNotification({
        userId: principal.userId,
        title: "Report Submitted for Approval",
        message: `Report for ${report.student.user.name} in ${report.section.name} is pending approval`,
        type: "INFO",
        category: "RESULT",
        link: `/dashboard/reports/pending`,
        metadata: { reportId: report.id, sectionId: report.sectionId }
      })
    }

    return NextResponse.json(report, { status: 201 })
  } catch (error) {
    console.error("Report generation error:", error)
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    )
  }
}

/**
 * GET - Retrieve reports based on role
 * Teachers: Reports for their class
 * Principal: All pending and approved reports
 * Admin: All reports
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")
    const sectionId = searchParams.get("sectionId")
    const academicTermId = searchParams.get("academicTermId")
    const status = searchParams.get("status")

    let whereClause: any = {}

    if (session.user.role === "TEACHER") {
      // Get teacher's sections
      const staff = await prisma.staff.findUnique({
        where: { userId: session.user.id },
        select: { sections: { select: { id: true } } }
      })

      if (!staff || staff.sections.length === 0) {
        return NextResponse.json([])
      }

      whereClause.sectionId = { in: staff.sections.map(s => s.id) }
    } else if (session.user.role !== "ADMIN" && session.user.role !== "PRINCIPAL") {
      // Non-admin, non-principal, non-teacher users can only see their own reports
      const studentEnrollment = await prisma.student.findUnique({
        where: { userId: session.user.id },
        select: { id: true }
      })
      
      if (!studentEnrollment) {
        return NextResponse.json([])
      }

      whereClause.studentId = studentEnrollment.id
    }

    // Apply filters
    if (studentId) whereClause.studentId = studentId
    if (sectionId) whereClause.sectionId = sectionId
    if (academicTermId) whereClause.academicTermId = academicTermId
    if (status) whereClause.status = status

    const reports = await prisma.studentReport.findMany({
      where: whereClause,
      include: {
        student: { include: { user: true } },
        section: { include: { class: true, classTeacher: { include: { user: true } } } },
        academicTerm: true,
        exam: true,
        comments: {
          include: { teacher: { include: { user: true } } }
        }
      },
      orderBy: { createdAt: "desc" }
    })

    return NextResponse.json(reports)
  } catch (error) {
    console.error("Fetch reports error:", error)
    return NextResponse.json(
      { error: "Failed to fetch reports" },
      { status: 500 }
    )
  }
}
