import { prisma } from "./prisma"

/**
 * Get remark based on percentage from templates
 */
export async function getRemarkByPercentage(percentage: number, category: string = "SUBJECT"): Promise<string> {
  const template = await prisma.remarkTemplate.findFirst({
    where: {
      category,
      isActive: true,
      minPercentage: { lte: percentage },
      maxPercentage: { gte: percentage },
    },
  })

  if (template) {
    return template.remark
  }

  // Fallback remarks
  if (percentage >= 90) return "Excellent"
  if (percentage >= 80) return "Very Good"
  if (percentage >= 70) return "Good"
  if (percentage >= 60) return "Satisfactory"
  if (percentage >= 50) return "Fair"
  if (percentage >= 40) return "Pass"
  return "Fail"
}

/**
 * Get comment based on percentage from templates
 */
export async function getCommentByPercentage(
  percentage: number, 
  commentType: "CLASS_TEACHER" | "PRINCIPAL"
): Promise<string> {
  const template = await prisma.commentTemplate.findFirst({
    where: {
      commentType,
      isActive: true,
      minPercentage: { lte: percentage },
      maxPercentage: { gte: percentage },
    },
  })

  if (template) {
    return template.comment
  }

  // Fallback comments
  const fallbackComments = {
    CLASS_TEACHER: {
      90: "Excellent work. Keep it up!",
      80: "Very good performance. Well done!",
      70: "Good work. Continue improving.",
      60: "Satisfactory. More effort needed.",
      50: "Fair performance. Work harder.",
      40: "Needs improvement. Seek help.",
      0: "Poor performance. Requires attention.",
    },
    PRINCIPAL: {
      90: "Outstanding achievement. The school is proud of you!",
      80: "Very good academic performance. Maintain high standards.",
      70: "Good progress. Continue working hard.",
      60: "Satisfactory results. More dedication required.",
      50: "Fair performance. Improvement expected.",
      40: "Below expectations. Extra effort needed.",
      0: "Unsatisfactory. Parent consultation recommended.",
    },
  }

  const thresholds = [90, 80, 70, 60, 50, 40, 0]
  for (const threshold of thresholds) {
    if (percentage >= threshold) {
      return fallbackComments[commentType][threshold as keyof typeof fallbackComments.CLASS_TEACHER]
    }
  }

  return fallbackComments[commentType][0]
}

/**
 * Get school configuration
 */
export async function getSchoolConfig() {
  let config = await prisma.schoolConfig.findFirst()
  
  if (!config) {
    config = await prisma.schoolConfig.create({
      data: {
        schoolName: "School Name",
        ministryHeader: "MINISTRY OF EDUCATION",
      },
    })
  }

  return config
}

/**
 * Get user's signature
 */
export async function getUserSignature(userId: string) {
  return await prisma.signature.findUnique({
    where: { userId },
  })
}

/**
 * Calculate student position in class based on total marks
 * Returns the position and total students
 */
export async function calculateStudentPosition(
  studentId: string,
  examId: string,
  sectionId: string
): Promise<{ position: number; totalStudents: number }> {
  // Get all results for this exam and section
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

  // Group by student and calculate totals
  const studentTotals = new Map<string, number>()
  for (const result of results) {
    const current = studentTotals.get(result.studentId) || 0
    studentTotals.set(result.studentId, current + result.marksObtained)
  }

  // Convert to array and sort by total marks (descending)
  const sortedStudents = Array.from(studentTotals.entries())
    .sort((a, b) => b[1] - a[1])

  // Find position of the target student
  const position = sortedStudents.findIndex(([id]) => id === studentId) + 1
  const totalStudents = sortedStudents.length

  return { position: position || totalStudents, totalStudents }
}

/**
 * Calculate positions for all students in a section for an exam
 * Returns a map of studentId -> { position, totalStudents, totalMarks }
 */
export async function calculateAllPositions(
  examId: string,
  sectionId: string
): Promise<Map<string, { position: number; totalStudents: number; totalMarks: number }>> {
  // Get all results for this exam and section
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

  // Group by student and calculate totals
  const studentTotals = new Map<string, number>()
  for (const result of results) {
    const current = studentTotals.get(result.studentId) || 0
    studentTotals.set(result.studentId, current + result.marksObtained)
  }

  // Convert to array and sort by total marks (descending)
  const sortedStudents = Array.from(studentTotals.entries())
    .sort((a, b) => b[1] - a[1])

  const totalStudents = sortedStudents.length
  const positionsMap = new Map<string, { position: number; totalStudents: number; totalMarks: number }>()

  // Handle ties - students with same marks get same position
  let currentPosition = 1
  let previousMarks = -1
  let sameMarksCount = 0

  for (let i = 0; i < sortedStudents.length; i++) {
    const [studentId, totalMarks] = sortedStudents[i]
    
    if (totalMarks === previousMarks) {
      // Same marks as previous student - same position
      sameMarksCount++
    } else {
      // Different marks - update position
      currentPosition = i + 1
      sameMarksCount = 0
    }
    
    positionsMap.set(studentId, {
      position: currentPosition,
      totalStudents,
      totalMarks,
    })
    
    previousMarks = totalMarks
  }

  return positionsMap
}
