import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { 
  getSchoolConfig, 
  getRemarkByPercentage, 
  getCommentByPercentage,
  getUserSignature 
} from "@/lib/report-utils"

/**
 * GET - Retrieve a specific report with all details
 * Includes:
 * - School configuration (logo, ministry header)
 * - Student details
 * - All subject results and marks with auto-remarks
 * - Position in class
 * - Teacher comments (manual and auto-generated)
 * - Progress ratio from last term
 * - Teacher and Principal signatures
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const reportId = params.id

    const report = await prisma.studentReport.findUnique({
      where: { id: reportId },
      include: {
        student: {
          include: {
            user: true,
            classEnrollment: {
              include: { section: { include: { class: true } } }
            }
          }
        },
        section: {
          include: {
            class: true,
            classTeacher: {
              include: { user: true }
            }
          }
        },
        term: true,
        academicYear: true,
        exam: true,
        comments: {
          include: {
            teacher: {
              include: {
                user: true,
                sections: true
              }
            }
          },
          orderBy: { createdAt: "desc" }
        }
      }
    })

    if (!report) {
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
      )
    }

    // Verify access
    const hasAccess =
      session.user.role === "ADMIN" ||
      session.user.role === "PRINCIPAL" ||
      (session.user.role === "TEACHER" &&
        report.section.classTeacher?.userId === session.user.id) ||
      (report.student.userId === session.user.id)

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Unauthorized to view this report" },
        { status: 403 }
      )
    }

    // Get all results for this student in this term
    const results = await prisma.result.findMany({
      where: {
        studentId: report.studentId,
        termId: report.termId,
        academicYearId: report.academicYearId,
        status: "APPROVED",
        ...(report.examId ? { examId: report.examId } : {})
      },
      include: {
        classSubject: {
          include: {
            subject: true,
            teacher: {
              include: { user: true }
            }
          }
        }
      },
      orderBy: {
        classSubject: {
          subject: {
            name: "asc"
          }
        }
      }
    })

    // Calculate statistics
    const totalMarks = results.reduce((sum, r) => sum + r.marksObtained, 0)
    const maxMarks = results.reduce((sum, r) => sum + r.maxMarks, 0)
    const percentage = maxMarks > 0 ? (totalMarks / maxMarks) * 100 : 0

    // Determine grade based on percentage
    let grade = "F"
    if (percentage >= 90) grade = "A+"
    else if (percentage >= 80) grade = "A"
    else if (percentage >= 70) grade = "B"
    else if (percentage >= 60) grade = "C"
    else if (percentage >= 50) grade = "D"

    // Get student progress compared to other students
    const allStudentsInClass = await prisma.result.findMany({
      where: {
        classSubject: {
          sectionId: report.sectionId,
          subject: { type: "CORE" }
        },
        termId: report.termId,
        academicYearId: report.academicYearId,
        status: "APPROVED",
        ...(report.examId ? { examId: report.examId } : {})
      },
      select: {
        studentId: true,
        marksObtained: true
      }
    })

    // Calculate class statistics
    const studentMarks = new Map<string, number>()
    allStudentsInClass.forEach(result => {
      const current = studentMarks.get(result.studentId) || 0
      studentMarks.set(result.studentId, current + result.marksObtained)
    })

    const marksArray = Array.from(studentMarks.values()).sort((a, b) => b - a)
    const classAverage = marksArray.length > 0 
      ? marksArray.reduce((a, b) => a + b, 0) / marksArray.length 
      : 0
    const highestMarks = marksArray[0] || 0
    const lowestMarks = marksArray[marksArray.length - 1] || 0

    // Get comments with signatures
    const commentsByArea = new Map()
    report.comments.forEach(comment => {
      const area = comment.performanceArea || "OVERALL"
      if (!commentsByArea.has(area)) {
        commentsByArea.set(area, [])
      }
      commentsByArea.get(area).push(comment)
    })

    // Get school configuration
    const schoolConfig = await getSchoolConfig()

    // Get auto-generated remarks for each subject result
    const subjectResultsWithRemarks = await Promise.all(
      results.map(async (result) => {
        const subjectPercentage = (result.marksObtained / result.maxMarks) * 100
        const remark = await getRemarkByPercentage(subjectPercentage, "SUBJECT")
        return {
          ...result,
          percentage: Math.round(subjectPercentage * 100) / 100,
          remark
        }
      })
    )

    // Get auto-generated comments based on overall percentage
    const classTeacherAutoComment = await getCommentByPercentage(percentage, "CLASS_TEACHER")
    const principalAutoComment = await getCommentByPercentage(percentage, "PRINCIPAL")

    // Get class teacher signature
    let classTeacherSignature = null
    if (report.section.classTeacher?.userId) {
      classTeacherSignature = await getUserSignature(report.section.classTeacher.userId)
    }

    // Get principal signature from school config or principal user
    const principal = await prisma.staff.findFirst({
      where: { designation: "PRINCIPAL" },
      select: { userId: true, user: { select: { name: true } } }
    })

    let principalSignature = null
    if (principal?.userId) {
      principalSignature = await getUserSignature(principal.userId)
    }

    // Get overall remark based on percentage
    const overallRemark = await getRemarkByPercentage(percentage, "OVERALL")

    return NextResponse.json({
      schoolConfig: {
        ministryHeader: schoolConfig.ministryHeader,
        schoolName: schoolConfig.schoolName,
        schoolLogo: schoolConfig.schoolLogo,
        schoolMotto: schoolConfig.schoolMotto,
        schoolAddress: schoolConfig.schoolAddress,
        schoolPhone: schoolConfig.schoolPhone,
        schoolEmail: schoolConfig.schoolEmail,
        principalName: schoolConfig.principalName,
        principalSignature: schoolConfig.principalSignature
      },
      report: {
        ...report,
        metadata: {
          totalResults: results.length,
          totalMarks,
          maxMarks,
          percentage: Math.round(percentage * 100) / 100,
          grade,
          overallRemark,
          positionInClass: report.positionInClass || 0,
          classSize: report.classSize || 0,
          progressRatio: Math.round((report.progressRatio || 0) * 100) / 100,
          previousTermAverage: Math.round((report.previousTermAverage || 0) * 100) / 100,
          currentTermAverage: Math.round((report.currentTermAverage || 0) * 100) / 100,
          classStatistics: {
            average: Math.round(classAverage * 100) / 100,
            highest: highestMarks,
            lowest: lowestMarks,
            studentCount: studentMarks.size
          }
        }
      },
      subjectResults: subjectResultsWithRemarks,
      commentsByArea: Array.from(commentsByArea.entries()).map(([area, comments]) => ({
        area,
        comments
      })),
      // Auto-generated comments based on performance
      autoComments: {
        classTeacher: classTeacherAutoComment,
        principal: principalAutoComment
      },
      // Signatures for the report
      signatures: {
        classTeacher: {
          name: report.section.classTeacher?.user.name || null,
          signature: classTeacherSignature?.signatureImage || null
        },
        principal: {
          name: principal?.user.name || schoolConfig.principalName || null,
          signature: principalSignature?.signatureImage || schoolConfig.principalSignature || null
        }
      }
    })
  } catch (error) {
    console.error("Fetch report error:", error)
    return NextResponse.json(
      { error: "Failed to fetch report" },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Remove a report (only by admin/principal or class teacher if not approved)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const reportId = params.id

    const report = await prisma.studentReport.findUnique({
      where: { id: reportId },
      include: {
        section: {
          select: {
            classTeacher: { select: { userId: true } }
          }
        }
      }
    })

    if (!report) {
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
      )
    }

    // Only admin/principal or class teacher can delete
    const canDelete =
      session.user.role === "ADMIN" ||
      session.user.role === "PRINCIPAL" ||
      (session.user.role === "TEACHER" &&
        report.section.classTeacher?.userId === session.user.id &&
        (report.status === "DRAFT" || report.status === "PENDING_CLASS_TEACHER"))

    if (!canDelete) {
      return NextResponse.json(
        { error: "Unauthorized to delete this report" },
        { status: 403 }
      )
    }

    await prisma.studentReport.delete({
      where: { id: reportId }
    })

    return NextResponse.json(
      { message: "Report deleted successfully" },
      { status: 200 }
    )
  } catch (error) {
    console.error("Delete report error:", error)
    return NextResponse.json(
      { error: "Failed to delete report" },
      { status: 500 }
    )
  }
}
