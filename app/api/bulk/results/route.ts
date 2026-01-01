import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"

// Function to calculate grade based on percentage
function calculateGrade(marks: number, maxMarks: number): string {
  if (maxMarks <= 0) return ""
  const percentage = (marks / maxMarks) * 100
  if (percentage >= 90) return "A+"
  if (percentage >= 80) return "A"
  if (percentage >= 70) return "B+"
  if (percentage >= 60) return "B"
  if (percentage >= 50) return "C+"
  if (percentage >= 40) return "C"
  if (percentage >= 30) return "D"
  return "F"
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !["ADMIN", "PRINCIPAL", "TEACHER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File
    const classSubjectId = formData.get("classSubjectId") as string
    const termId = formData.get("termId") as string
    const examIdRaw = formData.get("examId") as string | null
    const examId = examIdRaw && examIdRaw.trim() !== "" ? examIdRaw : null
    const maxMarks = formData.get("maxMarks") as string

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!classSubjectId || !termId || !maxMarks) {
      return NextResponse.json(
        { error: "Class-Subject, Term, and Max Marks are required" },
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

    // Verify term
    const term = await prisma.term.findUnique({
      where: { id: termId },
      include: { academicYear: true },
    })

    if (!term) {
      return NextResponse.json({ error: "Term not found" }, { status: 400 })
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
            termId: termId,
            ...(examId ? { examId } : { examId: null }),
          },
        })

        if (existingResult) {
          results.failed++
          results.errors.push(`Row ${i + 1}: Result already exists for student "${admissionNumber}"`)
          continue
        }

        // Auto-calculate grade based on marks
        const calculatedGrade = calculateGrade(parsedMarks, parsedMaxMarks)

        // Create result
        await prisma.result.create({
          data: {
            studentId: student.id,
            classSubjectId: classSubjectId,
            termId: termId,
            academicYearId: term.academicYearId,
            examId: examId || null,
            marksObtained: parsedMarks,
            maxMarks: parsedMaxMarks,
            grade: calculatedGrade,
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
        metadata: { success: results.success, failed: results.failed, total: results.success + results.failed, classSubjectId, examId, termId },
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

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !["ADMIN", "PRINCIPAL", "TEACHER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const classSubjectId = searchParams.get("classSubjectId")
    const termId = searchParams.get("termId")

    // If no class-subject selected, return a basic template
    if (!classSubjectId) {
      const template = `AdmissionNumber,MarksObtained,Remarks
ADM001,85,Excellent work
ADM002,72,Good performance
ADM003,65,Needs improvement
# Note: Grade is auto-calculated based on marks`

      return new Response(template, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": "attachment; filename=bulk_results_template.csv",
        },
      })
    }

    // Get class-subject details
    const classSubject = await prisma.classSubject.findUnique({
      where: { id: classSubjectId },
      include: {
        class: true,
        subject: true,
        section: true,
      },
    })

    if (!classSubject) {
      return NextResponse.json({ error: "Class-Subject not found" }, { status: 404 })
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

    // Always get the current academic year for enrollment lookup
    const currentAcademicYear = await prisma.academicYear.findFirst({
      where: { isCurrent: true },
    })

    if (!currentAcademicYear) {
      return NextResponse.json(
        { error: "No current academic year found. Please set an active academic year." },
        { status: 400 }
      )
    }

    // Get enrolled students for this class in the current academic year
    const whereClause: any = {
      status: "ACTIVE",
      classId: classSubject.classId,
      academicYearId: currentAcademicYear.id,
    }

    // If classSubject has a section, also filter by section
    if (classSubject.sectionId) {
      whereClause.sectionId = classSubject.sectionId
    }

    const enrolledStudents = await prisma.classEnrollment.findMany({
      where: whereClause,
      include: {
        student: {
          include: {
            user: true,
          },
        },
      },
      orderBy: {
        student: {
          admissionNumber: "asc",
        },
      },
    })

    // Generate CSV with student details
    const className = classSubject.section 
      ? `${classSubject.class.name} ${classSubject.section.name}`
      : classSubject.class.name
    const subjectName = classSubject.subject.name

    let template = `AdmissionNumber,StudentName,MarksObtained,Remarks\n`
    template += `# Grade is auto-calculated based on marks\n`
    
    if (enrolledStudents.length === 0) {
      // No students enrolled, provide empty template with example
      template += `# No students enrolled in ${className} for ${subjectName}\n`
      template += `# Example format:\n`
      template += `ADM001,John Doe,85,Excellent work\n`
    } else {
      // Add each enrolled student
      for (const enrollment of enrolledStudents) {
        const student = enrollment.student
        const studentName = `${student.user.name}`.replace(/,/g, " ")
        template += `${student.admissionNumber},${studentName},,\n`
      }
    }

    const filename = `results_${className.replace(/\s+/g, "_")}_${subjectName.replace(/\s+/g, "_")}.csv`

    return new Response(template, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename=${filename}`,
      },
    })
  } catch (error) {
    console.error("Error generating template:", error)
    return NextResponse.json(
      { error: "Failed to generate template" },
      { status: 500 }
    )
  }
}

