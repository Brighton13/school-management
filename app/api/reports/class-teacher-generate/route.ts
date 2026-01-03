import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"
import jsPDF from "jspdf"
import "jspdf-autotable"
import { requirePermission, Permissions } from "@/lib/permissions"

// Extend jsPDF type to include autoTable
declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: any) => jsPDF
  }
}

interface ReportData {
  student: {
    name: string
    admissionNumber: string
  }
  section: {
    id: string
    name: string
    className: string
  }
  term: {
    name: string
    number: number
  }
  academicYear: string
  exam: {
    name: string
    type: string
  }
  results: Array<{
    subject: string
    score: number
    maxMarks: number
    percentage: number
    grade: string
    remark: string
  }>
  totalMarks: number
  maxTotalMarks: number
  position: number
  classSize: number
  nextTermDate: string
  classTeacherComment: string
  headTeacherComment: string
  classTeacherSignature: string | null
  headTeacherSignature: string | null
  schoolName: string
  reportDate: string
}

/**
 * GET - Get students eligible for report generation
 * Returns students with approved results for a specific exam/term
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission(request, Permissions.REPORTS_VIEW)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const examId = searchParams.get("examId")
    const sectionId = searchParams.get("sectionId")

    // For teachers, verify they are class teacher
    if (session.user.role === "TEACHER") {
      const staff = await prisma.staff.findUnique({
        where: { userId: session.user.id },
        include: {
          sections: { select: { id: true } },
        },
      })

      if (!staff || staff.sections.length === 0) {
        return NextResponse.json({ error: "You are not a class teacher" }, { status: 403 })
      }

      // If sectionId provided, verify it's their section
      if (sectionId && !staff.sections.some(s => s.id === sectionId)) {
        return NextResponse.json({ error: "You are not the class teacher for this section" }, { status: 403 })
      }
    }

    // Get students with approved results
    const whereClause: any = {
      status: { in: ["APPROVED", "PUBLISHED"] },
    }

    if (examId) whereClause.examId = examId
    if (sectionId) whereClause.classSubject = { sectionId }

    const results = await prisma.result.findMany({
      where: whereClause,
      include: {
        student: {
          include: {
            user: true,
            classEnrollment: {
              include: {
                section: {
                  include: { class: true },
                },
              },
            },
          },
        },
        exam: {
          include: {
            term: { include: { academicYear: true } },
          },
        },
        classSubject: {
          include: { subject: true },
        },
      },
    })

    // Group by student
    const studentMap = new Map<string, any>()

    results.forEach(result => {
      const studentId = result.studentId
      if (!studentMap.has(studentId)) {
        const enrollment = result.student.classEnrollment[0]
        studentMap.set(studentId, {
          studentId,
          studentName: result.student.user.name,
          admissionNumber: result.student.admissionNumber,
          sectionId: enrollment?.sectionId,
          sectionName: enrollment ? `${enrollment.section.class.name} ${enrollment.section.name}` : "N/A",
          examId: result.examId,
          examName: result.exam?.name || "N/A",
          termName: result.exam?.term.name,
          academicYear: result.exam?.term.academicYear.year,
          subjectsCount: 0,
          totalMarks: 0,
          maxMarks: 0,
          canGenerate: true,
        })
      }

      const student = studentMap.get(studentId)!
      student.subjectsCount++
      student.totalMarks += result.marksObtained
      student.maxMarks += result.maxMarks
    })

    return NextResponse.json(Array.from(studentMap.values()))
  } catch (error) {
    console.error("Error fetching eligible students:", error)
    return NextResponse.json(
      { error: "Failed to fetch eligible students" },
      { status: 500 }
    )
  }
}

/**
 * POST - Generate report PDF for one or more students
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, Permissions.REPORTS_GENERATE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { studentIds, examId, sectionId, returnPdf = false } = body

    if (!examId) {
      return NextResponse.json(
        { error: "Missing required field: examId" },
        { status: 400 }
      )
    }

    // Get exam details
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        term: { include: { academicYear: true } },
      },
    })

    if (!exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 })
    }

    // For teachers, verify they are class teacher
    if (session.user.role === "TEACHER") {
      const staff = await prisma.staff.findUnique({
        where: { userId: session.user.id },
        include: {
          sections: { select: { id: true } },
        },
      })

      if (!staff || staff.sections.length === 0) {
        return NextResponse.json({ error: "You are not a class teacher" }, { status: 403 })
      }

      if (sectionId && !staff.sections.some(s => s.id === sectionId)) {
        return NextResponse.json({ error: "You are not the class teacher for this section" }, { status: 403 })
      }
    }

    // Get the students to generate reports for
    let targetStudentIds = studentIds || []

    if (targetStudentIds.length === 0 && sectionId) {
      // Get all students in the section with approved results
      const enrollments = await prisma.classEnrollment.findMany({
        where: {
          sectionId,
          academicYearId: exam.academicYearId,
          status: "ACTIVE",
        },
        select: { studentId: true },
      })
      targetStudentIds = enrollments.map(e => e.studentId)
    }

    if (targetStudentIds.length === 0) {
      return NextResponse.json(
        { error: "No students specified for report generation" },
        { status: 400 }
      )
    }

    // Get school settings
    const systemSettings = await prisma.systemSettings.findFirst()
    const schoolName = "CHIMWEMWE PRIMARY SCHOOL" // This should come from system settings

    // Get signatures
    const [principalSignature, classTeacherSignature] = await Promise.all([
      prisma.signature.findFirst({
        where: { signatureType: "PRINCIPAL" },
      }),
      session.user.role === "TEACHER" 
        ? prisma.signature.findFirst({
            where: { userId: session.user.id },
          })
        : null,
    ])

    // Generate reports for each student
    const reports: Array<{ studentId: string; studentName: string; pdf: string }> = []
    const errors: Array<{ studentId: string; error: string }> = []

    for (const studentId of targetStudentIds) {
      try {
        const reportData = await generateStudentReportData(
          studentId,
          examId,
          exam,
          schoolName,
          principalSignature?.signatureImage || null,
          classTeacherSignature?.signatureImage || null
        )

        if (!reportData) {
          errors.push({ studentId, error: "Not all core subjects have approved results" })
          continue
        }

        if (returnPdf) {
          const pdfBase64 = await generatePdfReport(reportData)
          reports.push({
            studentId,
            studentName: reportData.student.name,
            pdf: pdfBase64,
          })
        }

        // Create or update StudentReport record
        await prisma.studentReport.upsert({
          where: {
            studentId_termId_examId: {
              studentId,
              termId: exam.termId,
              examId,
            },
          },
          create: {
            studentId,
            sectionId: reportData.section.id,
            termId: exam.termId,
            academicYearId: exam.academicYearId,
            examId,
            totalMarksObtained: reportData.totalMarks,
            maxTotalMarks: reportData.maxTotalMarks,
            positionInClass: reportData.position,
            classSize: reportData.classSize,
            status: "APPROVED",
            generatedBy: session.user.id,
            generatedAt: new Date(),
            approvedBy: session.user.id,
            approvedAt: new Date(),
          },
          update: {
            totalMarksObtained: reportData.totalMarks,
            maxTotalMarks: reportData.maxTotalMarks,
            positionInClass: reportData.position,
            classSize: reportData.classSize,
            generatedAt: new Date(),
          },
        })
      } catch (err: any) {
        errors.push({ studentId, error: err.message || "Failed to generate report" })
      }
    }

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "CREATE",
      "StudentReport",
      request,
      {
        description: `Generated ${reports.length} report(s) for ${exam.name}`,
        metadata: {
          examId,
          studentCount: reports.length,
          errorCount: errors.length,
        },
      }
    )

    return NextResponse.json({
      message: `Generated ${reports.length} report(s)`,
      reports,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error("Error generating reports:", error)
    return NextResponse.json(
      { error: "Failed to generate reports" },
      { status: 500 }
    )
  }
}

async function generateStudentReportData(
  studentId: string,
  examId: string,
  exam: any,
  schoolName: string,
  principalSignature: string | null,
  classTeacherSignature: string | null
): Promise<ReportData | null> {
  // Get student enrollment
  const enrollment = await prisma.classEnrollment.findFirst({
    where: {
      studentId,
      academicYearId: exam.academicYearId,
      status: "ACTIVE",
    },
    include: {
      student: { include: { user: true } },
      section: {
        include: {
          class: true,
          classTeacher: { include: { user: true } },
        },
      },
    },
  })

  if (!enrollment) return null

  // Get all core subjects for this section
  const coreSubjects = await prisma.classSubject.findMany({
    where: {
      sectionId: enrollment.sectionId,
      subject: { type: "CORE" },
    },
    include: { subject: true },
  })

  // Get approved results
  const results = await prisma.result.findMany({
    where: {
      studentId,
      examId,
      status: { in: ["APPROVED", "PUBLISHED"] },
    },
    include: {
      classSubject: { include: { subject: true } },
    },
  })

  // Check if all core subjects have results
  const resultSubjectIds = new Set(results.map(r => r.classSubject.subject.id))
  const allCoreSubjectsHaveResults = coreSubjects.every(cs =>
    resultSubjectIds.has(cs.subject.id)
  )

  if (!allCoreSubjectsHaveResults) return null

  // Calculate totals
  let totalMarks = 0
  let maxTotalMarks = 0
  const reportResults = results.map(r => {
    const percentage = (r.marksObtained / r.maxMarks) * 100
    totalMarks += r.marksObtained
    maxTotalMarks += r.maxMarks

    return {
      subject: r.classSubject.subject.name.toUpperCase(),
      score: r.marksObtained,
      maxMarks: r.maxMarks,
      percentage: Math.round(percentage),
      grade: r.grade || getGrade(percentage),
      remark: getRemark(percentage),
    }
  })

  // Calculate position
  const allStudentTotals = await getAllStudentTotals(examId, enrollment.sectionId)
  const sortedTotals = allStudentTotals.sort((a, b) => b.total - a.total)
  const position = sortedTotals.findIndex(s => s.studentId === studentId) + 1

  // Get next term start date
  const nextTerm = await prisma.term.findFirst({
    where: {
      academicYearId: exam.academicYearId,
      termNumber: exam.term.termNumber + 1,
    },
  })

  // Get comment config or use default
  const classTeacherComment = getPerformanceComment(totalMarks / maxTotalMarks * 100, "class_teacher")
  const headTeacherComment = getPerformanceComment(totalMarks / maxTotalMarks * 100, "head_teacher")

  return {
    student: {
      name: enrollment.student.user.name.toUpperCase(),
      admissionNumber: enrollment.student.admissionNumber,
    },
    section: {
      id: enrollment.sectionId,
      name: enrollment.section.name,
      className: enrollment.section.class.name,
    },
    term: {
      name: exam.term.name,
      number: exam.term.termNumber,
    },
    academicYear: exam.term.academicYear.year,
    exam: {
      name: exam.name,
      type: exam.examType,
    },
    results: reportResults,
    totalMarks,
    maxTotalMarks,
    position,
    classSize: sortedTotals.length,
    nextTermDate: nextTerm ? formatDate(nextTerm.startDate) : "TBA",
    classTeacherComment,
    headTeacherComment,
    classTeacherSignature,
    headTeacherSignature: principalSignature,
    schoolName,
    reportDate: formatDate(new Date()),
  }
}

async function getAllStudentTotals(examId: string, sectionId: string) {
  const results = await prisma.result.findMany({
    where: {
      examId,
      classSubject: { sectionId },
      status: { in: ["APPROVED", "PUBLISHED"] },
    },
    select: {
      studentId: true,
      marksObtained: true,
    },
  })

  const studentTotals = new Map<string, number>()
  results.forEach(r => {
    studentTotals.set(r.studentId, (studentTotals.get(r.studentId) || 0) + r.marksObtained)
  })

  return Array.from(studentTotals.entries()).map(([studentId, total]) => ({
    studentId,
    total,
  }))
}

function getGrade(percentage: number): string {
  if (percentage >= 90) return "A+"
  if (percentage >= 80) return "A"
  if (percentage >= 70) return "B+"
  if (percentage >= 60) return "B"
  if (percentage >= 50) return "C+"
  if (percentage >= 40) return "C"
  if (percentage >= 30) return "D"
  return "F"
}

function getRemark(percentage: number): string {
  if (percentage >= 90) return "Excellent"
  if (percentage >= 80) return "Excellent"
  if (percentage >= 70) return "Very Good"
  if (percentage >= 60) return "Good"
  if (percentage >= 50) return "Satisfactory"
  if (percentage >= 40) return "Pass"
  if (percentage >= 30) return "Below Average"
  return "Needs Improvement"
}

function getPerformanceComment(percentage: number, type: "class_teacher" | "head_teacher"): string {
  if (type === "class_teacher") {
    if (percentage >= 80) return "Exceptional performance across all subjects. Shows outstanding understanding."
    if (percentage >= 60) return "Good performance. Keep up the effort and continue to improve."
    if (percentage >= 40) return "Satisfactory performance. More effort needed in some areas."
    return "Needs significant improvement. Please encourage more study time at home."
  } else {
    if (percentage >= 80) return "An exemplary student with outstanding academic results."
    if (percentage >= 60) return "A good student with commendable results."
    if (percentage >= 40) return "An average student who needs to put in more effort."
    return "Requires immediate attention and support to improve performance."
  }
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

async function generatePdfReport(data: ReportData): Promise<string> {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.width
  const margin = 15

  // Header - Ministry of Education
  doc.setFillColor(0, 51, 102)
  doc.rect(0, 0, pageWidth, 35, "F")

  // School coat of arms placeholder (in real implementation, add actual image)
  doc.setFillColor(255, 255, 255)
  doc.circle(pageWidth / 2, 12, 8, "F")

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.text("MINISTRY OF EDUCATION", pageWidth / 2, 24, { align: "center" })

  // School Name
  doc.setFontSize(16)
  doc.text(data.schoolName, pageWidth / 2, 32, { align: "center" })

  // Report Form Title
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(10)
  doc.text(`REPORT FORM - TERM ${data.term.number} ${data.academicYear.split("-")[1] || data.academicYear}`, pageWidth / 2, 42, { align: "center" })

  // Student Information Section
  const infoY = 52
  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")

  // Left column
  doc.text("STUDENT NAME:", margin, infoY)
  doc.text("No. PUPILS:", margin, infoY + 8)
  doc.text("MARKS OBTAINED:", margin, infoY + 16)

  doc.setFont("helvetica", "normal")
  doc.text(data.student.name, margin + 35, infoY)
  doc.text(String(data.classSize), margin + 35, infoY + 8)
  doc.text(`${data.totalMarks} out of ${data.maxTotalMarks}`, margin + 40, infoY + 16)

  // Right column
  const rightCol = pageWidth / 2 + 10
  doc.setFont("helvetica", "bold")
  doc.text("GRADE:", rightCol, infoY)
  doc.text("NEXT TERM:", rightCol, infoY + 8)
  doc.text("POSITION:", rightCol, infoY + 16)

  doc.setFont("helvetica", "normal")
  doc.text(`${data.section.className}${data.section.name}`, rightCol + 30, infoY)
  doc.text(data.nextTermDate, rightCol + 30, infoY + 8)
  doc.text(String(data.position), rightCol + 30, infoY + 16)

  // Results Table
  const tableY = 78
  doc.setFillColor(0, 51, 102)
  doc.rect(margin, tableY, pageWidth - 2 * margin, 8, "F")

  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8)
  doc.text("SUBJECT", margin + 5, tableY + 5)
  doc.text("SCORE", margin + 60, tableY + 5)
  doc.text("%", margin + 85, tableY + 5)
  doc.text("REMARK", margin + 110, tableY + 5)

  // Table rows
  doc.setTextColor(0, 0, 0)
  doc.setFont("helvetica", "normal")
  let rowY = tableY + 8

  data.results.forEach((result, index) => {
    const fillColor = index % 2 === 0 ? [240, 240, 240] : [255, 255, 255]
    doc.setFillColor(fillColor[0], fillColor[1], fillColor[2])
    doc.rect(margin, rowY, pageWidth - 2 * margin, 8, "F")

    doc.text(result.subject, margin + 5, rowY + 5)
    doc.text(String(result.score), margin + 60, rowY + 5)
    doc.text(`${result.percentage}%`, margin + 85, rowY + 5)
    doc.text(result.remark, margin + 110, rowY + 5)

    rowY += 8
  })

  // Draw table border
  doc.setDrawColor(0, 51, 102)
  doc.rect(margin, tableY, pageWidth - 2 * margin, rowY - tableY, "S")

  // Comments Section
  const commentsY = rowY + 10
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.text("CLASS TEACHER COMMENTS:", margin, commentsY)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  const classTeacherLines = doc.splitTextToSize(data.classTeacherComment, pageWidth - 2 * margin - 10)
  doc.rect(margin, commentsY + 2, pageWidth - 2 * margin, 15, "S")
  doc.text(classTeacherLines, margin + 3, commentsY + 8)

  const headCommentsY = commentsY + 22
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.text("HEAD TEACHER COMMENTS:", margin, headCommentsY)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  const headTeacherLines = doc.splitTextToSize(data.headTeacherComment, pageWidth - 2 * margin - 10)
  doc.rect(margin, headCommentsY + 2, pageWidth - 2 * margin, 15, "S")
  doc.text(headTeacherLines, margin + 3, headCommentsY + 8)

  // Signatures Section
  const sigY = headCommentsY + 30

  // Class Teacher Signature
  if (data.classTeacherSignature) {
    try {
      const sigData = data.classTeacherSignature.replace(/^data:image\/\w+;base64,/, "")
      doc.addImage(sigData, "PNG", margin, sigY, 40, 20)
    } catch (e) {
      console.error("Error adding class teacher signature:", e)
    }
  }
  doc.setFontSize(8)
  doc.text("Class Teacher", margin + 5, sigY + 25)

  // Head Teacher Signature
  if (data.headTeacherSignature) {
    try {
      const sigData = data.headTeacherSignature.replace(/^data:image\/\w+;base64,/, "")
      doc.addImage(sigData, "PNG", pageWidth - margin - 50, sigY, 40, 20)
    } catch (e) {
      console.error("Error adding head teacher signature:", e)
    }
  }
  doc.text("Head Teacher", pageWidth - margin - 40, sigY + 25)

  // Date
  doc.text(`Date: ${data.reportDate}`, margin, sigY + 35)

  // Return as base64
  return doc.output("datauristring")
}
