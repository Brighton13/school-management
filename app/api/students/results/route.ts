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
          include: {
            classSubject: {
              include: {
                subject: true,
                class: true,
              },
            },
            academicTerm: true,
            exam: true,
          },
          where: {
            status: { in: ["APPROVED", "PUBLISHED"] },
          },
          orderBy: [
            { academicTerm: { academicYear: "desc" } },
            { academicTerm: { name: "asc" } },
            { exam: { examType: "asc" } },
            { classSubject: { subject: { name: "asc" } } },
          ],
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

    // Group results by academic year and term
    const resultsByYear = new Map<string, Map<string, {
      termInfo: {
        id: string
        name: string
        academicYear: string
      }
      continuousAssessments: Array<{
        id: string
        subjectName: string
        subjectCode: string
        examName: string | null
        examType: string
        marksObtained: number
        maxMarks: number
        percentage: number
        grade: string | null
        submittedAt: string | null
        approvedAt: string | null
      }>
      endOfTermResults: Array<{
        id: string
        subjectName: string
        subjectCode: string
        examName: string | null
        examType: string
        marksObtained: number
        maxMarks: number
        percentage: number
        grade: string | null
        submittedAt: string | null
        approvedAt: string | null
      }>
      termAverage: number
      termGrade: string | null
    }>>()

    student.results.forEach((result) => {
      const year = result.academicTerm.academicYear
      const termName = result.academicTerm.name
      const percentage = (result.marksObtained / result.maxMarks) * 100
      
      if (!resultsByYear.has(year)) {
        resultsByYear.set(year, new Map())
      }
      
      const yearMap = resultsByYear.get(year)!
      if (!yearMap.has(termName)) {
        yearMap.set(termName, {
          termInfo: {
            id: result.academicTerm.id,
            name: result.academicTerm.name,
            academicYear: result.academicTerm.academicYear,
          },
          continuousAssessments: [],
          endOfTermResults: [],
          termAverage: 0,
          termGrade: null,
        })
      }
      
      const termData = yearMap.get(termName)!
      const resultData = {
        id: result.id,
        subjectName: result.classSubject.subject.name,
        subjectCode: result.classSubject.subject.code || "",
        examName: result.exam?.name || null,
        examType: result.exam?.examType || "UNKNOWN",
        marksObtained: result.marksObtained,
        maxMarks: result.maxMarks,
        percentage,
        grade: result.grade,
        submittedAt: result.submittedAt?.toISOString() || null,
        approvedAt: result.approvedAt?.toISOString() || null,
      }

      // Categorize by exam type
      if (result.exam?.examType === "CONTINUOUS_ASSESSMENT" || 
          result.exam?.examType === "QUIZ" || 
          result.exam?.examType === "ASSIGNMENT") {
        termData.continuousAssessments.push(resultData)
      } else if (result.exam?.examType === "FINAL" || 
                 result.exam?.examType === "MID_TERM" ||
                 result.exam?.isFinal) {
        termData.endOfTermResults.push(resultData)
      } else {
        // Default to continuous assessments for unknown types
        termData.continuousAssessments.push(resultData)
      }
    })

    // Calculate term averages
    resultsByYear.forEach((yearMap) => {
      yearMap.forEach((termData) => {
        const allResults = [...termData.continuousAssessments, ...termData.endOfTermResults]
        if (allResults.length > 0) {
          termData.termAverage = allResults.reduce((sum, r) => sum + r.percentage, 0) / allResults.length
          
          // Calculate grade based on average
          if (termData.termAverage >= 80) termData.termGrade = "A"
          else if (termData.termAverage >= 70) termData.termGrade = "B"
          else if (termData.termAverage >= 60) termData.termGrade = "C"
          else if (termData.termAverage >= 50) termData.termGrade = "D"
          else if (termData.termAverage >= 40) termData.termGrade = "E"
          else termData.termGrade = "F"
        }
      })
    })

    // Convert Map structure to array format for JSON response
    const resultsData = Array.from(resultsByYear.entries()).map(([year, yearMap]) => ({
      academicYear: year,
      terms: Array.from(yearMap.entries()).map(([termName, termData]) => ({
        termName,
        termInfo: termData.termInfo,
        continuousAssessments: termData.continuousAssessments,
        endOfTermResults: termData.endOfTermResults,
        termAverage: termData.termAverage,
        termGrade: termData.termGrade,
        totalAssessments: termData.continuousAssessments.length + termData.endOfTermResults.length,
      })),
    })).sort((a, b) => b.academicYear.localeCompare(a.academicYear))

    // Calculate overall statistics
    const allResults = student.results.map(r => (r.marksObtained / r.maxMarks) * 100)
    const overallAverage = allResults.length > 0 
      ? allResults.reduce((sum, percentage) => sum + percentage, 0) / allResults.length 
      : 0

    return NextResponse.json({
      student: {
        name: student.user.name,
        admissionNumber: student.admissionNumber,
        className,
      },
      overallAverage,
      totalResults: student.results.length,
      academicYears: resultsData,
      summary: {
        totalContinuousAssessments: student.results.filter(r => 
          r.exam?.examType === "CONTINUOUS_ASSESSMENT" || 
          r.exam?.examType === "QUIZ" || 
          r.exam?.examType === "ASSIGNMENT"
        ).length,
        totalEndOfTermExams: student.results.filter(r => 
          r.exam?.examType === "FINAL" || 
          r.exam?.examType === "MID_TERM" || 
          r.exam?.isFinal
        ).length,
        yearsWithResults: resultsByYear.size,
      },
    })
  } catch (error) {
    console.error("Student results error:", error)
    return NextResponse.json(
      { error: "Failed to fetch student results" },
      { status: 500 }
    )
  }
}