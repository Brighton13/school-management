import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * POST - Sync/update exam submission progress after results are entered
 * Called after result creation to update tracking
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { examId, sectionId, classSubjectId } = body

    if (!examId || !sectionId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Get or create submission tracking
    let submission = await prisma.examResultSubmission.findUnique({
      where: { examId_sectionId: { examId, sectionId } },
      include: {
        subjectSubmissions: true,
        exam: true,
      },
    })

    if (!submission) {
      // Get exam details
      const exam = await prisma.exam.findUnique({
        where: { id: examId },
      })

      if (!exam) {
        return NextResponse.json({ error: "Exam not found" }, { status: 404 })
      }

      // Get all core subjects for this section
      const coreSubjects = await prisma.classSubject.findMany({
        where: {
          sectionId,
          subject: { type: "CORE" },
        },
      })

      // Get total students in this section
      const enrollmentCount = await prisma.classEnrollment.count({
        where: {
          sectionId,
          academicYearId: exam.academicYearId,
          status: "ACTIVE",
        },
      })

      // Create new submission tracking
      submission = await prisma.examResultSubmission.create({
        data: {
          examId,
          sectionId,
          academicYearId: exam.academicYearId,
          termId: exam.termId,
          totalSubjects: coreSubjects.length,
          submittedSubjects: 0,
          totalStudents: enrollmentCount,
          status: "PENDING_SUBJECTS",
          subjectSubmissions: {
            create: coreSubjects.map(cs => ({
              classSubjectId: cs.id,
              totalStudents: enrollmentCount,
              resultsEntered: 0,
              isComplete: false,
            })),
          },
        },
        include: {
          subjectSubmissions: true,
          exam: true,
        },
      })
    }

    // Update subject submission if classSubjectId provided
    if (classSubjectId) {
      const subjectSub = await prisma.examSubjectSubmission.findFirst({
        where: {
          examResultSubmissionId: submission.id,
          classSubjectId,
        },
      })

      if (subjectSub) {
        // Count results for this subject
        const resultCount = await prisma.result.count({
          where: {
            examId,
            classSubjectId,
          },
        })

        const isComplete = resultCount >= subjectSub.totalStudents

        await prisma.examSubjectSubmission.update({
          where: { id: subjectSub.id },
          data: {
            resultsEntered: resultCount,
            isComplete,
            submittedBy: isComplete ? session.user.id : null,
            submittedAt: isComplete ? new Date() : null,
          },
        })
      }
    }

    // Recalculate overall progress
    const subjectSubs = await prisma.examSubjectSubmission.findMany({
      where: { examResultSubmissionId: submission.id },
    })

    const completedCount = subjectSubs.filter(s => s.isComplete).length
    const allComplete = completedCount >= submission.totalSubjects

    // Calculate aggregate stats
    const results = await prisma.result.findMany({
      where: {
        examId,
        classSubject: { sectionId },
      },
      select: {
        marksObtained: true,
        maxMarks: true,
        classSubject: {
          select: { passMarks: true },
        },
      },
    })

    let totalMarks = 0
    let passCount = 0

    results.forEach(r => {
      totalMarks += r.marksObtained
      const passMarks = r.classSubject.passMarks || (r.maxMarks * 0.4)
      if (r.marksObtained >= passMarks) passCount++
    })

    const avgMarks = results.length > 0 ? totalMarks / results.length : 0
    const passRate = results.length > 0 ? (passCount / results.length) * 100 : 0

    const marksList = results.map(r => r.marksObtained)
    const highestMarks = marksList.length > 0 ? Math.max(...marksList) : 0
    const lowestMarks = marksList.length > 0 ? Math.min(...marksList) : 0

    // Update submission status
    const newStatus = allComplete ? "PENDING_CLASS_TEACHER" : "PENDING_SUBJECTS"
    
    const updatedSubmission = await prisma.examResultSubmission.update({
      where: { id: submission.id },
      data: {
        submittedSubjects: completedCount,
        averageMarks: avgMarks,
        highestMarks,
        lowestMarks,
        passRate,
        status: submission.status === "PENDING_SUBJECTS" ? newStatus : submission.status,
      },
      include: {
        exam: { include: { term: true } },
        section: { include: { class: true } },
        subjectSubmissions: {
          include: {
            classSubject: {
              include: { subject: true },
            },
          },
        },
      },
    })

    return NextResponse.json({
      submission: updatedSubmission,
      progress: {
        totalSubjects: submission.totalSubjects,
        completedSubjects: completedCount,
        isReadyForSubmission: allComplete,
      },
    })
  } catch (error) {
    console.error("Error syncing submission:", error)
    return NextResponse.json(
      { error: "Failed to sync submission progress" },
      { status: 500 }
    )
  }
}
