import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import ExcelJS from "exceljs"
import { requirePermission, Permissions } from "@/lib/permissions"

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, Permissions.ENROLLMENT_CREATE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Parse Excel file
    const buffer = await file.arrayBuffer()
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    const worksheet = workbook.worksheets[0]

    if (!worksheet) {
      return NextResponse.json({ error: "No worksheet found in file" }, { status: 400 })
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    }

    // Get headers from first row
    const headers: string[] = []
    const headerRow = worksheet.getRow(1)
    headerRow.eachCell((cell, colNumber) => {
      headers[colNumber - 1] = String(cell.value || "").trim().toLowerCase()
    })

    // Process each data row (skip header row)
    const promises: Promise<void>[] = []

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return // Skip header row

      const processRow = async () => {
        try {
          const rowData: Record<string, string> = {}
          row.eachCell((cell, colNumber) => {
            const header = headers[colNumber - 1]
            if (header) {
              rowData[header] = String(cell.value || "").trim()
            }
          })

          const {
            admissionnumber,
            classname,
            sectionname,
            academicyear,
          } = rowData

          if (!admissionnumber || !classname || !sectionname || !academicyear) {
            results.failed++
            results.errors.push(`Row ${rowNumber}: Missing required fields`)
            return
          }

          // Find student
          const student = await prisma.student.findUnique({
            where: { admissionNumber: admissionnumber },
          })

          if (!student) {
            results.failed++
            results.errors.push(`Row ${rowNumber}: Student not found`)
            return
          }

          // Find class
          const classRecord = await prisma.class.findFirst({
            where: { name: classname },
          })

          if (!classRecord) {
            results.failed++
            results.errors.push(`Row ${rowNumber}: Class not found`)
            return
          }

          // Find section
          const section = await prisma.section.findFirst({
            where: {
              name: sectionname,
              classId: classRecord.id,
            },
          })

          if (!section) {
            results.failed++
            results.errors.push(`Row ${rowNumber}: Section not found`)
            return
          }

          const academicYearRecord = await prisma.academicYear.findUnique({
            where: { year: academicyear },
          })

          if (!academicYearRecord) {
            results.failed++
            results.errors.push(`Row ${rowNumber}: Academic year not found`)
            return
          }

          await prisma.classEnrollment.create({
            data: {
              studentId: student.id,
              classId: classRecord.id,
              sectionId: section.id,
              academicYearId: academicYearRecord.id,
            },
          })

          results.success++
        } catch (error: any) {
          results.failed++
          if (error.code === "P2002") {
            results.errors.push(`Row ${rowNumber}: Student already enrolled`)
          } else {
            results.errors.push(`Row ${rowNumber}: ${error.message}`)
          }
        }
      }

      promises.push(processRow())
    })

    // Wait for all rows to be processed
    await Promise.all(promises)

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
    const session = await requirePermission(request, Permissions.ENROLLMENT_CREATE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch all students with their latest enrollment and pending applications
    const students = await prisma.student.findMany({
      include: {
        user: true,
        classEnrollment: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            class: true,
            section: true,
          },
        },
        applications: {
          where: {
            applicationStatus: "PENDING",
          },
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            appliedClass: true,
            appliedSection: true,
          },
        },
      },
      orderBy: { admissionNumber: "asc" },
    })

    // Fetch classes and sections for dropdowns
    const classes = await prisma.class.findMany({
      orderBy: { name: "asc" },
      select: { name: true },
    })
    const sections = await prisma.section.findMany({
      orderBy: { name: "asc" },
      select: { name: true },
    })

    const academicYears = await prisma.academicYear.findMany({
      where: {
        OR: [
          { isCurrent: true },
          { isUpcoming: true }
        ]
      },
      orderBy: { year: "asc" },
      select: {
        id: true,
        year: true,
        isCurrent: true,
        isUpcoming: true
      }
    })

    // Create workbook
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet("Enrollment")

    // Define columns
    worksheet.columns = [
      { header: "AdmissionNumber", key: "admissionNumber", width: 18 },
      { header: "StudentName", key: "studentName", width: 25 },
      { header: "ClassName", key: "className", width: 18 },
      { header: "SectionName", key: "sectionName", width: 18 },
      { header: "AcademicYear", key: "academicYear", width: 15 },
    ]

    // Style header row
    worksheet.getRow(1).font = { bold: true }
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD3D3D3" },
    }

    // Add student data rows
    students.forEach(student => {
      const latestEnrollment = student.classEnrollment[0]
      const pendingApplication = student.applications[0]

      const currentClass = latestEnrollment?.class.name || (pendingApplication?.appliedClass.name || "")
      const currentSection = latestEnrollment?.section.name || (pendingApplication?.appliedSection?.name || "")
      const academicYear = latestEnrollment?.academicYearId || pendingApplication?.academicYearId || ""

      worksheet.addRow({
        admissionNumber: student.admissionNumber,
        studentName: student.user.name,
        className: currentClass,
        sectionName: currentSection,
        academicYear: academicYear,
      })
    })

    // Add data validation for ClassName (starting from row 2)
    if (classes.length > 0) {
      (worksheet as any).dataValidations.add(`C2:C${students.length + 1}`, {
        type: "list",
        allowBlank: false,
        formulae: [`"${classes.map(c => c.name).join(",")}"`],
        showErrorMessage: true,
        errorTitle: "Invalid Class",
        error: "Please select from the dropdown list",
      })
    }

    // Add data validation for SectionName
    if (sections.length > 0) {
      (worksheet as any).dataValidations.add(`D2:D${students.length + 1}`, {
        type: "list",
        allowBlank: false,
        formulae: [`"${Array.from(new Set(sections.map(s => s.name))).join(",")}"`],
        showErrorMessage: true,
        errorTitle: "Invalid Section",
        error: "Please select from the dropdown list",
      })
    }

    // Add data validation for AcademicYear
    if (academicYears.length > 0) {
      const academicYearNames = academicYears.map(y => y.year).join(",")
      ;(worksheet as any).dataValidations.add(`E2:E${students.length + 1}`, {
        type: "list",
        allowBlank: false,
        formulae: [`"${academicYearNames}"`],
        showErrorMessage: true,
        errorTitle: "Invalid Academic Year",
        error: "Please select from the dropdown list",
      })
    }

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer()

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=enrollment_template.xlsx",
      },
    })
  } catch (error) {
    console.error("Failed to generate template:", error)
    return NextResponse.json(
      { error: "Failed to generate template" },
      { status: 500 }
    )
  }
}
