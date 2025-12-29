import { prisma } from "./prisma"


export async function generateAdmissionNumber(): Promise<string> {
  const now = new Date()

  const year = now.getFullYear().toString().slice(-2) // YY
  const month = (now.getMonth() + 1).toString().padStart(2, '0') // MM
  const prefix = `${year}${month}` // YYMM

  // Find the latest student for the current month
  const lastStudent = await prisma.student.findFirst({
    where: {
      admissionNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      admissionNumber: 'desc',
    },
  })

  let sequence = 1

  if (lastStudent?.admissionNumber) {
    const lastSequence = parseInt(
      lastStudent.admissionNumber.slice(4),
      10
    )
    sequence = lastSequence + 1
  }

  return `${prefix}${sequence.toString().padStart(4, '0')}`
}