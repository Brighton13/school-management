import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"
import { createNotification, createBulkNotifications } from "@/lib/notifications"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")
    const termId = searchParams.get("termId")
    const academicYearId = searchParams.get("academicYearId")
    const status = searchParams.get("status")

    // For teachers, only show results for their assigned subjects
    let teacherClassSubjectIds: string[] | undefined
    if (session.user.role === "TEACHER") {
      const staff = await prisma.staff.findUnique({
        where: { userId: session.user.id },
        include: {
          classSubjects: {
            select: { id: true },
          },
        },
      })
      if (staff) {
        teacherClassSubjectIds = staff.classSubjects.map((cs: { id: any }) => cs.id)
      } else {
        // Teacher has no assignments, return empty
        return NextResponse.json([])
      }
    }

    // For teachers on "Enter Results" page, only show DRAFT results
    // Submitted results should only appear on "Class Results" page
    const whereClause: any = {
      ...(studentId ? { studentId } : {}),
      ...(termId ? { termId } : {}),
      ...(academicYearId ? { academicYearId } : {}),
      ...(status ? { status } : {}),
      ...(teacherClassSubjectIds ? { classSubjectId: { in: teacherClassSubjectIds } } : {}),
    }

    // If teacher and no specific status filter, only show DRAFT results
    if (session.user.role === "TEACHER" && !status) {
      whereClause.status = "DRAFT"
    }

    const results = await prisma.result.findMany({
      where: whereClause,
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
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(results)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch results" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !["ADMIN", "PRINCIPAL", "TEACHER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      studentId,
      classSubjectId,
      termId,
      academicYearId,
      examId,
      marksObtained,
      maxMarks,
      grade,
      remarks,
    } = body

    // Get exam details if provided
    let exam = null
    if (examId) {
      exam = await prisma.exam.findUnique({
        where: { id: examId },
      })
      if (!exam) {
        return NextResponse.json({ error: "Exam not found" }, { status: 404 })
      }
    }

    // For teachers, verify they are assigned to this class-subject
    if (session.user.role === "TEACHER") {
      const staff = await prisma.staff.findUnique({
        where: { userId: session.user.id },
        include: {
          classSubjects: {
            where: { id: classSubjectId },
          },
        },
      })

      if (!staff || staff.classSubjects.length === 0) {
        return NextResponse.json(
          { error: "You are not assigned to this class-subject" },
          { status: 403 }
        )
      }
    }

    // Determine status based on role and exam settings
    let status = "DRAFT"
    let submittedBy = null
    let submittedAt = null
    let publishedValue = false
    let publishedAtValue = null

    // Check for duplicate result: same student, class-subject, term, and exam
    const existingResult = await prisma.result.findFirst({
      where: {
        studentId,
        classSubjectId,
        termId: termId,
        academicYearId,
        examId: examId || null,
      },
    })

    if (existingResult) {
      return NextResponse.json(
        {
          error: "A result already exists for this student, subject, term, and exam combination. Please update the existing result instead."
        },
        { status: 400 }
      )
    }

    if (session.user.role === "TEACHER") {
      // Teachers always submit results - they go to class teacher automatically
      // Check if student's section has a class teacher
      const studentEnrollment = await prisma.classEnrollment.findFirst({
        where: { studentId },
        include: {
          section: {
            include: {
              classTeacher: true,
            },
          },
        },
      })

      if (studentEnrollment?.section?.classTeacher) {
        // Submit to class teacher first (always)
        status = "PENDING_CLASS_TEACHER"
      } else {
        // No class teacher, submit directly to principal
        status = "PENDING_APPROVAL"
      }
      submittedBy = session.user.id
      submittedAt = new Date()
    } else if (["ADMIN", "PRINCIPAL"].includes(session.user.role)) {
      // Admins/Principals can directly approve and publish
      status = "APPROVED"
      publishedValue = true
      publishedAtValue = new Date()
    }

    const result = await prisma.result.create({
      data: {
        studentId,
        classSubjectId,
        termId,
        academicYearId,
        examId: examId || null,
        marksObtained: parseFloat(marksObtained),
        maxMarks: parseFloat(maxMarks),
        grade,
        remarks,
        status,
        submittedBy,
        submittedAt,
        published: publishedValue,
        publishedAt: publishedAtValue,
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
      },
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "CREATE",
      "Result",
      request,
      {
        entityId: result.id,
        description: `Created result for ${result.student.user.name} - ${result.classSubject.subject.name} (${result.marksObtained}/${result.maxMarks})`,
      }
    )

    // Create notification for student
    await createNotification({
      userId: result.student.userId,
      title: "New Result Available",
      message: `Your result for ${result.classSubject.subject.name} has been recorded: ${result.marksObtained}/${result.maxMarks}`,
      type: "SUCCESS",
      category: "RESULT",
      link: `/dashboard/results`,
      metadata: { resultId: result.id },
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create result" },
      { status: 500 }
    )
  }
}

