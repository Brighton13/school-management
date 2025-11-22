import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !["ADMIN", "PRINCIPAL", "TEACHER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File
    const classSubjectId = formData.get("classSubjectId") as string
    const academicTermId = formData.get("academicTermId") as string
    const examIdRaw = formData.get("examId") as string | null
    const examId = examIdRaw && examIdRaw.trim() !== "" ? examIdRaw : null
    const maxMarks = formData.get("maxMarks") as string

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!classSubjectId || !academicTermId || !maxMarks) {
      return NextResponse.json(
        { error: "Class-Subject, Academic Term, and Max Marks are required" },
        { status: 400 }
      )
    }

    // Verify class-subject exists
    const classSubject = await prisma.classSubject.findUnique({
      where: { id: classSubjectId },
      include: {
        class: true,
        subject: true,
      },
    })

    if (!classSubject) {
      return NextResponse.json({ error: "Class-Subject not found" }, { status: 400 })
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

    // Verify exam if provided
    let exam = null
    if (examId && examId.trim() !== "") {
      exam = await prisma.exam.findUnique({
        where: { id: examId },
      })
      if (!exam) {
        return NextResponse.json({ error: "Exam not found" }, { status: 400 })
      }
    }

    // Verify academic term
    const academicTerm = await prisma.academicTerm.findUnique({
      where: { id: academicTermId },
    })

    if (!academicTerm) {
      return NextResponse.json({ error: "Academic term not found" }, { status: 400 })
    }

    const parsedMaxMarks = parseFloat(maxMarks)
    if (isNaN(parsedMaxMarks) || parsedMaxMarks <= 0) {
      return NextResponse.json({ error: "Invalid max marks" }, { status: 400 })
    }

    const text = await file.text()
    const lines = text.split("\n").filter(line => line.trim())
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase())
    
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    }

    // Get all students enrolled in this class
    const enrolledStudents = await prisma.classEnrollment.findMany({
      where: {
        classId: classSubject.classId,
      },
      include: {
        student: {
          include: {
            user: true,
          },
        },
      },
    })

    const enrolledStudentMap = new Map(
      enrolledStudents.map((enrollment) => [enrollment.student.admissionNumber, enrollment.student])
    )

    // Determine status based on role
    let status = "DRAFT"
    let submittedBy = null
    let submittedAt = null
    let publishedValue = false
    let publishedAtValue = null

    if (session.user.role === "TEACHER") {
      // Check if any section in this class has a class teacher
      const sections = await prisma.section.findMany({
        where: { classId: classSubject.classId },
        include: { classTeacher: true },
      })

      const hasClassTeacher = sections.some((s) => s.classTeacher !== null)

      if (hasClassTeacher) {
        status = "PENDING_CLASS_TEACHER"
      } else {
        status = "PENDING_APPROVAL"
      }
      submittedBy = session.user.id
      submittedAt = new Date()
    } else if (["ADMIN", "PRINCIPAL"].includes(session.user.role)) {
      status = "APPROVED"
      publishedValue = true
      publishedAtValue = new Date()
    }

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = lines[i].split(",").map(v => v.trim())
        const row: Record<string, string> = {}
        headers.forEach((header, index) => {
          row[header] = values[index] || ""
        })

        // Support multiple column name variations
        const admissionNumber = row["admissionnumber"] || row["admission_number"] || row["admission no"] || row["admission_no"] || row["admissionnumber"]
        const marksObtained = row["marksobtained"] || row["marks_obtained"] || row["marks obtained"] || row["marks"] || row["score"]
        const grade = row["grade"] || ""
        const remarks = row["remarks"] || row["remark"] || ""

        if (!admissionNumber) {
          results.failed++
          results.errors.push(`Row ${i + 1}: Missing admission number`)
          continue
        }

        if (!marksObtained) {
          results.failed++
          results.errors.push(`Row ${i + 1}: Missing marks obtained`)
          continue
        }

        // Find student
        const student = enrolledStudentMap.get(admissionNumber.trim())

        if (!student) {
          results.failed++
          results.errors.push(`Row ${i + 1}: Student with admission number "${admissionNumber}" is not enrolled in this class`)
          continue
        }

        const parsedMarks = parseFloat(marksObtained)
        if (isNaN(parsedMarks) || parsedMarks < 0) {
          results.failed++
          results.errors.push(`Row ${i + 1}: Invalid marks obtained "${marksObtained}"`)
          continue
        }

        if (parsedMarks > parsedMaxMarks) {
          results.failed++
          results.errors.push(`Row ${i + 1}: Marks obtained (${parsedMarks}) cannot exceed max marks (${parsedMaxMarks})`)
          continue
        }

        // Check if result already exists for this student, class-subject, term, and exam
        const existingResult = await prisma.result.findFirst({
          where: {
            studentId: student.id,
            classSubjectId: classSubjectId,
            academicTermId: academicTermId,
            ...(examId ? { examId } : { examId: null }),
          },
        })

        if (existingResult) {
          results.failed++
          results.errors.push(`Row ${i + 1}: Result already exists for student "${admissionNumber}"`)
          continue
        }

        // Create result
        await prisma.result.create({
          data: {
            studentId: student.id,
            classSubjectId: classSubjectId,
            academicTermId: academicTermId,
            examId: examId || null,
            marksObtained: parsedMarks,
            maxMarks: parsedMaxMarks,
            grade: grade.trim() || null,
            remarks: remarks.trim() || null,
            status,
            submittedBy,
            submittedAt,
            published: publishedValue,
            publishedAt: publishedAtValue,
          },
        })

        results.success++
      } catch (error: any) {
        results.failed++
        if (error.code === "P2002") {
          results.errors.push(`Row ${i + 1}: Duplicate result`)
        } else {
          results.errors.push(`Row ${i + 1}: ${error.message}`)
        }
      }
    }

    // Log audit trail for bulk operation
    await logAuditTrail(
      session.user.id,
      "CREATE",
      "Result",
      request,
      {
        description: `Bulk created ${results.success} results (${results.failed} failed)`,
        metadata: { success: results.success, failed: results.failed, total: results.success + results.failed, classSubjectId, examId, academicTermId },
      }
    )

    return NextResponse.json(results)
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to process bulk upload", details: error.message },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !["ADMIN", "PRINCIPAL", "TEACHER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const template = `AdmissionNumber,MarksObtained,Grade,Remarks
ADM001,85,A,Excellent work
ADM002,72,B,Good performance
ADM003,65,C,Needs improvement`

    return new Response(template, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=bulk_results_template.csv",
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to generate template" },
      { status: 500 }
    )
  }
}

