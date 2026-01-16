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
      skipped: 0,
      errors: [] as string[],
    }

    // Find the header row (look for "AdmissionNumber" in first column)
    let headerRowNumber = 1
    let headers: string[] = []
    
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const firstCell = String(row.getCell(1).value || "").trim().toLowerCase()
      if (firstCell === "admissionnumber") {
        headerRowNumber = rowNumber
        row.eachCell((cell, colNumber) => {
          headers[colNumber - 1] = String(cell.value || "").trim().toLowerCase()
        })
      }
    })

    if (headers.length === 0) {
      return NextResponse.json(
        { error: "Invalid template: Could not find header row with 'AdmissionNumber'" },
        { status: 400 }
      )
    }

    // Process each data row (skip rows before and including header row)
    const promises: Promise<void>[] = []

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber <= headerRowNumber) return // Skip instructions and header rows

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
            results.errors.push(`Row ${rowNumber}: Missing required fields (need AdmissionNumber, ClassName, SectionName, AcademicYear)`)
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

    // Get the target academic year (current or upcoming)
    const targetAcademicYear = await prisma.academicYear.findFirst({
      where: {
        OR: [{ isCurrent: true }, { isUpcoming: true }]
      },
      orderBy: { startDate: "desc" },
    })

    if (!targetAcademicYear) {
      return NextResponse.json(
        { error: "No current or upcoming academic year found" },
        { status: 400 }
      )
    }

    // Fetch all students with their enrollments
    // Show their LAST enrollment as reference for where to enroll them next
    const students = await prisma.student.findMany({
      include: {
        user: true,
        classEnrollment: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            class: true,
            section: true,
            academicYear: true,
          },
        },
      },
      orderBy: { admissionNumber: "asc" },
    })

    // Fetch classes and sections for dropdowns
    const classes = await prisma.class.findMany({
      orderBy: { level: "asc" },
      select: { id: true, name: true, level: true },
    })
    const sections = await prisma.section.findMany({
      orderBy: { name: "asc" },
      select: { name: true },
    })

    const academicYears = await prisma.academicYear.findMany({
      where: {
        OR: [{ isCurrent: true }, { isUpcoming: true }]
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

    // Define columns - show previous enrollment as reference
    worksheet.columns = [
      { header: "AdmissionNumber", key: "admissionNumber", width: 18 },
      { header: "StudentName", key: "studentName", width: 25 },
      { header: "PreviousClass", key: "previousClass", width: 15 },
      { header: "PreviousSection", key: "previousSection", width: 15 },
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

    // Add instructions row
    worksheet.insertRow(1, [
      "Instructions: Fill ClassName, SectionName, and AcademicYear columns. PreviousClass/Section are for reference only.",
    ])
    worksheet.mergeCells("A1:G1")
    worksheet.getRow(1).font = { italic: true, color: { argb: "FF666666" } }

    // Add student data rows
    students.forEach(student => {
      const lastEnrollment = student.classEnrollment[0]
      
      // Suggest next class level if they have a previous enrollment
      let suggestedClass = ""
      if (lastEnrollment) {
        // Find next class by level
        const currentClassLevel = classes.find(c => c.name === lastEnrollment.class.name)?.level || 0
        const nextClass = classes.find(c => c.level === currentClassLevel + 1)
        suggestedClass = nextClass?.name || lastEnrollment.class.name
      }

      worksheet.addRow({
        admissionNumber: student.admissionNumber,
        studentName: student.user.name,
        previousClass: lastEnrollment?.class.name || "NEW STUDENT",
        previousSection: lastEnrollment?.section.name || "-",
        className: suggestedClass, // Pre-fill with suggested next class
        sectionName: lastEnrollment?.section.name || "", // Keep same section as suggestion
        academicYear: targetAcademicYear.year, // Pre-fill with target academic year
      })
    })

    // Add data validation for ClassName (starting from row 3 due to instructions row)
    const dataStartRow = 3
    const dataEndRow = students.length + 2
    
    if (classes.length > 0) {
      (worksheet as any).dataValidations.add(`E${dataStartRow}:E${dataEndRow}`, {
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
      (worksheet as any).dataValidations.add(`F${dataStartRow}:F${dataEndRow}`, {
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
      ;(worksheet as any).dataValidations.add(`G${dataStartRow}:G${dataEndRow}`, {
        type: "list",
        allowBlank: false,
        formulae: [`"${academicYearNames}"`],
        showErrorMessage: true,
        errorTitle: "Invalid Academic Year",
        error: "Please select from the dropdown list",
      })
    }

    // Style the previous class/section columns as read-only (gray background)
    for (let i = dataStartRow; i <= dataEndRow; i++) {
      worksheet.getCell(`C${i}`).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF0F0F0" },
      }
      worksheet.getCell(`D${i}`).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF0F0F0" },
      }
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
