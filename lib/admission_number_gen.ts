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

export async function generateEmployeeId(designation: string): Promise<string> {
  const now = new Date()
  const year = now.getFullYear().toString().slice(-2) // YY

  // Create prefix based on designation
  const designationPrefixes: Record<string, string> = {
    TEACHER: "TCH",
    PRINCIPAL: "PRI",
    ACCOUNTANT: "ACC",
    LIBRARIAN: "LIB",
    ADMIN: "ADM",
  }

  const prefix = designationPrefixes[designation] || "STF"
  const fullPrefix = `${prefix}${year}` // e.g., TCH25

  // Find the latest staff with this prefix
  const lastStaff = await prisma.staff.findFirst({
    where: {
      employeeId: {
        startsWith: fullPrefix,
      },
    },
    orderBy: {
      employeeId: 'desc',
    },
  })

  let sequence = 1

  if (lastStaff?.employeeId) {
    // Extract the sequence number from the end
    const lastSequence = parseInt(
      lastStaff.employeeId.slice(fullPrefix.length),
      10
    )
    if (!isNaN(lastSequence)) {
      sequence = lastSequence + 1
    }
  }

  return `${fullPrefix}${sequence.toString().padStart(4, '0')}`
}