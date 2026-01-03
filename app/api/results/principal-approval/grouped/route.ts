import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requirePermission, Permissions } from "@/lib/permissions"

/**
 * GET - Get grouped results for principal approval
 * Groups results by exam -> class -> section -> student
 * Provides overview stats for each grouping level
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission(request, Permissions.RESULTS_APPROVE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const examId = searchParams.get("examId")
    const status = searchParams.get("status") || "PENDING_APPROVAL"

    // Build exam filter
    const examWhere: any = {}
    if (examId) {
      examWhere.id = examId
    }
    // Only show active or completed exams
    examWhere.status = { in: ["ACTIVE", "COMPLETED"] }

    // Get exams that have results pending approval
    const exams = await prisma.exam.findMany({
      where: {
        ...examWhere,
        results: {
          some: status === "ALL" 
            ? { status: { in: ["PENDING_APPROVAL", "APPROVED", "PUBLISHED"] } }
            : { status: "PENDING_APPROVAL" }
        }
      },
      include: {
        term: { include: { academicYear: true } },
        academicYear: true,
        examResultSubmissions: {
          include: {
            section: {
              include: {
                class: true,
                classTeacher: { include: { user: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    // For each exam, get detailed grouped results
    const examData = await Promise.all(
      exams.map(async (exam) => {
        // Get all results for this exam that are pending approval
        const results = await prisma.result.findMany({
          where: {
            examId: exam.id,
            status: status === "ALL" ? { in: ["PENDING_APPROVAL", "APPROVED", "PUBLISHED"] } : "PENDING_APPROVAL",
          },
          include: {
            student: {
              include: {
                user: true,
                classEnrollment: {
                  where: {
                    academicYearId: exam.academicYearId,
                    status: "ACTIVE",
                  },
                  include: {
                    class: true,
                    section: true,
                  },
                  take: 1,
                },
              },
            },
            classSubject: {
              include: {
                subject: true,
                class: true,
                section: true,
              },
            },
          },
        })

        // Group results by class -> section -> student
        const classMap = new Map<string, {
          classId: string
          className: string
          sections: Map<string, {
            sectionId: string
            sectionName: string
            classTeacher: string | null
            submissionId: string | null
            submissionStatus: string | null
            students: Map<string, {
              studentId: string
              studentName: string
              admissionNumber: string
              results: Array<{
                id: string
                subjectName: string
                subjectCode: string
                marksObtained: number
                maxMarks: number
                percentage: number
                grade: string | null
                status: string
              }>
              totalMarks: number
              totalMaxMarks: number
              averagePercentage: number
              passed: boolean
              overallGrade: string
            }>
            stats: {
              totalStudents: number
              totalPassed: number
              totalFailed: number
              averagePercentage: number
              highestPercentage: number
              lowestPercentage: number
            }
          }>
        }>()

        // Process results
        for (const result of results) {
          const enrollment = result.student.classEnrollment[0]
          if (!enrollment) continue

          const classId = enrollment.classId
          const className = enrollment.class.name
          const sectionId = enrollment.sectionId
          const sectionName = enrollment.section.name
          const studentId = result.studentId

          // Get or create class entry
          if (!classMap.has(classId)) {
            classMap.set(classId, {
              classId,
              className,
              sections: new Map(),
            })
          }
          const classEntry = classMap.get(classId)!

          // Get or create section entry
          if (!classEntry.sections.has(sectionId)) {
            // Find submission for this section
            const submission = exam.examResultSubmissions.find(
              s => s.sectionId === sectionId
            )

            classEntry.sections.set(sectionId, {
              sectionId,
              sectionName,
              classTeacher: submission?.section.classTeacher?.user.name 
                ? `${submission.section.classTeacher.user.name} ${submission.section.classTeacher.user.name}`
                : null,
              submissionId: submission?.id || null,
              submissionStatus: submission?.status || null,
              students: new Map(),
              stats: {
                totalStudents: 0,
                totalPassed: 0,
                totalFailed: 0,
                averagePercentage: 0,
                highestPercentage: 0,
                lowestPercentage: 100,
              },
            })
          }
          const sectionEntry = classEntry.sections.get(sectionId)!

          // Get or create student entry
          if (!sectionEntry.students.has(studentId)) {
            sectionEntry.students.set(studentId, {
              studentId,
              studentName: `${result.student.user.name} ${result.student.user.name}`,
              admissionNumber: result.student.admissionNumber,
              results: [],
              totalMarks: 0,
              totalMaxMarks: 0,
              averagePercentage: 0,
              passed: true,
              overallGrade: "",
            })
          }
          const studentEntry = sectionEntry.students.get(studentId)!

          // Add result to student
          const percentage = (result.marksObtained / result.maxMarks) * 100
          studentEntry.results.push({
            id: result.id,
            subjectName: result.classSubject.subject.name,
            subjectCode: result.classSubject.subject.code,
            marksObtained: result.marksObtained,
            maxMarks: result.maxMarks,
            percentage,
            grade: result.grade,
            status: result.status,
          })

          studentEntry.totalMarks += result.marksObtained
          studentEntry.totalMaxMarks += result.maxMarks

          // Check if failed this subject (less than 40%)
          if (percentage < 40) {
            studentEntry.passed = false
          }
        }

        // Calculate stats for each level
        for (const classEntry of Array.from(classMap.values())) {
          for (const sectionEntry of Array.from(classEntry.sections.values())) {
            const studentsList = Array.from(sectionEntry.students.values())

            // Calculate student averages and grades
            for (const student of studentsList) {
              if (student.totalMaxMarks > 0) {
                student.averagePercentage = (student.totalMarks / student.totalMaxMarks) * 100
                student.overallGrade = calculateGrade(student.averagePercentage)
              }
            }

            // Calculate section stats
            sectionEntry.stats.totalStudents = studentsList.length
            sectionEntry.stats.totalPassed = studentsList.filter(s => s.passed).length
            sectionEntry.stats.totalFailed = studentsList.filter(s => !s.passed).length

            if (studentsList.length > 0) {
              const percentages = studentsList.map(s => s.averagePercentage)
              sectionEntry.stats.averagePercentage = 
                percentages.reduce((a, b) => a + b, 0) / percentages.length
              sectionEntry.stats.highestPercentage = Math.max(...percentages)
              sectionEntry.stats.lowestPercentage = Math.min(...percentages)
            }
          }
        }

        // Convert maps to arrays for JSON serialization
        const groupedResults = Array.from(classMap.values()).map(classEntry => ({
          ...classEntry,
          sections: Array.from(classEntry.sections.values()).map(sectionEntry => ({
            ...sectionEntry,
            students: Array.from(sectionEntry.students.values()).sort((a, b) => 
              a.admissionNumber.localeCompare(b.admissionNumber)
            ),
          })).sort((a, b) => a.sectionName.localeCompare(b.sectionName)),
        })).sort((a, b) => a.className.localeCompare(b.className))

        // Calculate overall exam stats based on actual results, not submissions
        const allSections = groupedResults.flatMap(c => c.sections)
        // Count sections that have pending results
        const totalPendingSections = allSections.filter(s => s.students.length > 0).length
        const totalApprovedSections = allSections.filter(
          s => s.submissionStatus === "APPROVED" || s.submissionStatus === "PUBLISHED"
        ).length

        // Get total sections that should have results
        const totalExpectedSections = await prisma.section.count({
          where: {
            enrollments: {
              some: {
                academicYearId: exam.academicYearId,
                status: "ACTIVE",
              },
            },
          },
        })

        return {
          exam: {
            id: exam.id,
            name: exam.name,
            examType: exam.examType,
            status: exam.status,
            term: {
              name: exam.term.name,
              academicYear: exam.term.academicYear.year,
            },
          },
          stats: {
            totalExpectedSections,
            totalPendingSections,
            totalApprovedSections,
            allSectionsSubmitted: (totalPendingSections + totalApprovedSections) >= totalExpectedSections,
            canApprove: totalPendingSections > 0,
          },
          groupedResults,
        }
      })
    )

    // Filter out exams with no results to show
    const filteredExams = status === "PENDING_APPROVAL" 
      ? examData.filter(e => e.groupedResults.length > 0)
      : examData

    return NextResponse.json(filteredExams)
  } catch (error) {
    console.error("Error fetching grouped results:", error)
    return NextResponse.json(
      { error: "Failed to fetch grouped results" },
      { status: 500 }
    )
  }
}

// Helper function to calculate grade
function calculateGrade(percentage: number): string {
  if (percentage >= 90) return "A+"
  if (percentage >= 80) return "A"
  if (percentage >= 70) return "B+"
  if (percentage >= 60) return "B"
  if (percentage >= 50) return "C+"
  if (percentage >= 40) return "C"
  if (percentage >= 30) return "D"
  return "F"
}
