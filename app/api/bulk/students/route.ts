import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { generateAdmissionNumber } from "@/lib/admission_number_gen"
import ExcelJS from "exceljs"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !["ADMIN", "PRINCIPAL"].includes(session.user.role)) {
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

    // Process each data row sequentially to avoid admission number race conditions
    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber)
      
      // Skip empty rows
      if (!row.hasValues) continue
      
      try {
        const rowData: Record<string, string> = {}
        row.eachCell((cell, colNumber) => {
          const header = headers[colNumber - 1]
          if (header) {
            // Handle hyperlink cells (Excel stores emails as hyperlinks)
            let cellValue = cell.value
            if (cellValue && typeof cellValue === 'object' && 'text' in cellValue) {
              // This is a hyperlink object, extract the text
              cellValue = cellValue.text
            }
            rowData[header] = String(cellValue || "").trim()
          }
        })

        const {
          email,
          name,
          phone,
          dateofbirth,
          gender,
          address,
          emergencycontact,
          intendedclass,
          intendedsection,
          academicyear,
          remarks,
        } = rowData

        // Validate required fields
        const missingFields = []
        if (!email) missingFields.push("Email")
        if (!name) missingFields.push("Name")
        if (!dateofbirth) missingFields.push("DateOfBirth")
        if (!gender) missingFields.push("Gender")

        if (missingFields.length > 0) {
          results.failed++
          results.errors.push(`Row ${rowNumber}: Missing required fields: ${missingFields.join(", ")}`)
          continue
        }

        // Parse date - support multiple formats
        let parsedDate: Date
        try {
          // Try parsing M/D/YYYY format first (e.g., 2/21/2010)
          if (dateofbirth.includes("/")) {
            const [month, day, year] = dateofbirth.split("/")
            parsedDate = new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`)
          } else {
            // ISO format (2010-02-21)
            parsedDate = new Date(dateofbirth)
          }
          
          if (isNaN(parsedDate.getTime())) {
            throw new Error("Invalid date")
          }
        } catch (dateError) {
          results.failed++
          results.errors.push(`Row ${rowNumber}: Invalid date format. Use MM/DD/YYYY or YYYY-MM-DD`)
          continue
        }

        // Resolve class and section names to IDs if provided
        let appliedClassId = null
        let appliedSectionId = null
        
        if (intendedclass) {
          const foundClass = await prisma.class.findFirst({
            where: { name: intendedclass }
          })
          
          if (!foundClass) {
            results.failed++
            results.errors.push(`Row ${rowNumber}: Class "${intendedclass}" not found`)
            continue
          }
          
          appliedClassId = foundClass.id
          
          // If section is provided, resolve it
          if (intendedsection) {
            const foundSection = await prisma.section.findFirst({
              where: { 
                name: intendedsection,
                classId: appliedClassId 
              }
            })
            
            if (!foundSection) {
              results.failed++
              results.errors.push(`Row ${rowNumber}: Section "${intendedsection}" not found in class "${intendedclass}"`)
              continue
            }
            
            appliedSectionId = foundSection.id
          }
        }

        const admissionnumber = await generateAdmissionNumber();
        const password = "Test1234"
        const hashedPassword = await bcrypt.hash(password, 10)

        // Create user with student, and optionally create application
        const userData: any = {
          email,
          password: hashedPassword,
          name,
          phone: phone || null,
          role: "STUDENT",
          student: {
            create: {
              admissionNumber: admissionnumber,
              dateOfBirth: parsedDate,
              gender: gender.toUpperCase() || "OTHER",
              address: address || null,
              emergencyContact: emergencycontact || null,
            },
          },
        }

        // If class is provided, create application
        if (appliedClassId) {
          userData.student.create.applications = {
            create: {
              appliedClassId,
              appliedSectionId,
              academicYear: academicyear || new Date().getFullYear().toString(),
              applicationStatus: "PENDING",
              notes: remarks || null,
              createdBy: session.user.id,
            }
          }
        }

        await prisma.user.create({ data: userData })

        results.success++
      } catch (error: any) {
        results.failed++
        if (error.code === "P2002") {
          results.errors.push(`Row ${rowNumber}: Email or admission number already exists`)
        } else {
          results.errors.push(`Row ${rowNumber}: ${error.message}`)
        }
      }
    }

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
    if (!session || !["ADMIN", "PRINCIPAL"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch classes and sections for dropdowns
    const classes = await prisma.class.findMany({
      orderBy: { name: "asc" },
      select: { name: true },
    })
    const sections = await prisma.section.findMany({
      orderBy: { name: "asc" },
      select: { name: true },
    })

    // Create workbook
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet("Students")

    // Define columns
    worksheet.columns = [
      { header: "Email", key: "email", width: 25 },
      { header: "Name", key: "name", width: 25 },
      { header: "Phone", key: "phone", width: 15 },
      { header: "DateOfBirth", key: "dateOfBirth", width: 15 },
      { header: "Gender", key: "gender", width: 12 },
      { header: "Address", key: "address", width: 30 },
      { header: "EmergencyContact", key: "emergencyContact", width: 18 },
      { header: "IntendedClass", key: "intendedClass", width: 18 },
      { header: "IntendedSection", key: "intendedSection", width: 18 },
      { header: "AcademicYear", key: "academicYear", width: 15 },
      { header: "Remarks", key: "remarks", width: 40 },
    ]

    // Style header row
    worksheet.getRow(1).font = { bold: true }
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD3D3D3" },
    }

    // Add sample data
    worksheet.addRow({
      email: "student1@example.com",
      name: "John Doe",
      phone: "1234567890",
      dateOfBirth: "1/15/2010",
      gender: "Male",
      address: "123 Main St",
      emergencyContact: "9876543210",
      intendedClass: classes[0]?.name || "Class 1",
      intendedSection: sections[0]?.name || "Section A",
      academicYear: "2024-2025",
      remarks: "New student from transfer",
    })

    worksheet.addRow({
      email: "student2@example.com",
      name: "Jane Smith",
      phone: "1234567891",
      dateOfBirth: "2/20/2010",
      gender: "Female",
      address: "456 Oak Ave",
      emergencyContact: "9876543211",
      intendedClass: classes[1]?.name || "Class 2",
      intendedSection: sections[1]?.name || "Section B",
      academicYear: "2024-2025",
      remarks: "High achiever",
    }) as any

    // Add data validation for Gender (rows 2-1000)
    (worksheet as any).dataValidations.add("E2:E1000", {
      type: "list",
      allowBlank: true,
      formulae: ['"Male,Female,Other"'],
      showErrorMessage: true,
      errorTitle: "Invalid Gender",
      error: "Please select from the dropdown list",
    })

    // Add data validation for IntendedClass
    if (classes.length > 0) {
      const classList = classes
      const classNames = classList.map(c => c.name).join(",") as any
      (worksheet as any).dataValidations.add("H2:H1000", {
        type: "list",
        allowBlank: true,
        formulae: [`"${classNames}"`],
        showErrorMessage: true,
        errorTitle: "Invalid Class",
        error: "Please select from the dropdown list",
      })
    }

    // Add data validation for IntendedSection
    if (sections.length > 0) {
      const sectionList = sections
      const sectionNames = Array.from(new Set(sectionList.map(s => s.name))).join(",") as any
      (worksheet as any).dataValidations.add("I2:I1000", {
        type: "list",
        allowBlank: true,
        formulae: [`"${sectionNames}"`],
        showErrorMessage: true,
        errorTitle: "Invalid Section",
        error: "Please select from the dropdown list",
      })
    }

    // Add data validation for AcademicYear
    const currentYear = new Date().getFullYear()
    const academicYears = [
      `${currentYear - 1}-${currentYear}`,
      `${currentYear}-${currentYear + 1}`,
      `${currentYear + 1}-${currentYear + 2}`,
      `${currentYear + 2}-${currentYear + 3}`,
    ].join(",") as any
    (worksheet as any).dataValidations.add("J2:J1000", {
      type: "list",
      allowBlank: true,
      formulae: [`"${academicYears}"`],
      showErrorMessage: true,
      errorTitle: "Invalid Academic Year",
      error: "Please select from the dropdown list",
    })

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer()

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=students_template.xlsx",
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



