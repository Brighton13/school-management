import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sectionId = searchParams.get("sectionId")

    // Check if user is a class teacher
    const staff = await prisma.staff.findUnique({
      where: { userId: session.user.id },
      include: {
        sections: {
          include: {
            class: true,
          },
        },
      },
    })

    if (!staff) {
      return NextResponse.json(
        { error: "Staff record not found" },
        { status: 404 }
      )
    }

    // If user is a class teacher, they can only download their own class students
    if (session.user.role === "TEACHER") {
      if (staff.sections.length === 0) {
        return NextResponse.json(
          { error: "You are not assigned as a class teacher" },
          { status: 403 }
        )
      }

      // If section ID is provided, verify they are class teacher of that section
      if (sectionId) {
        const isClassTeacherOfSection = staff.sections.some(
          (section) => section.id === sectionId
        )

        if (!isClassTeacherOfSection) {
          return NextResponse.json(
            { error: "You are not the class teacher of this section" },
            { status: 403 }
          )
        }
      }
    }

    // Get current academic year
    const currentAcademicYear = await prisma.academicYear.findFirst({
      where: { isCurrent: true },
    })

    if (!currentAcademicYear) {
      return NextResponse.json(
        { error: "No current academic year found" },
        { status: 400 }
      )
    }

    // Build query for students based on user role
    let sectionsToQuery: string[] = []

    if (session.user.role === "TEACHER") {
      // For class teachers, get only their sections
      if (sectionId) {
        sectionsToQuery = [sectionId]
      } else {
        sectionsToQuery = staff.sections.map((s) => s.id)
      }
    } else if (session.user.role === "ADMIN" || session.user.role === "PRINCIPAL") {
      // Admins and principals can download any section
      if (sectionId) {
        sectionsToQuery = [sectionId]
      } else {
        // If no section specified, return error for admins to specify
        return NextResponse.json(
          { error: "Please specify a section ID" },
          { status: 400 }
        )
      }
    } else {
      return NextResponse.json(
        { error: "You do not have permission to download student lists" },
        { status: 403 }
      )
    }

    if (sectionsToQuery.length === 0) {
      return NextResponse.json(
        { error: "No sections found" },
        { status: 404 }
      )
    }

    // Get students enrolled in the specified sections for current academic year
    const enrollments = await prisma.classEnrollment.findMany({
      where: {
        sectionId: { in: sectionsToQuery },
        academicYearId: currentAcademicYear.id,
        status: "ACTIVE",
      },
      include: {
        student: {
          include: {
            user: true,
          },
        },
        class: true,
        section: true,
      },
      orderBy: [
        { section: { name: "asc" } },
        { student: { admissionNumber: "asc" } },
      ],
    })

    if (enrollments.length === 0) {
      return NextResponse.json(
        { error: "No students found in the specified section(s)" },
        { status: 404 }
      )
    }

    // Generate CSV
    let csv = "Admission Number,Student Name,Class,Section,Email,Phone,Gender,Date of Birth,Address,Emergency Contact\n"

    for (const enrollment of enrollments) {
      const student = enrollment.student
      const user = student.user

      // Format date of birth
      const dob = student.dateOfBirth
        ? new Date(student.dateOfBirth).toLocaleDateString()
        : ""

      // Escape commas and quotes in text fields
      const escapeCsv = (text: string | null) => {
        if (!text) return ""
        const escaped = text.replace(/"/g, '""')
        return escaped.includes(",") || escaped.includes('"') || escaped.includes("\n")
          ? `"${escaped}"`
          : escaped
      }

      csv += [
        student.admissionNumber,
        escapeCsv(user.name),
        enrollment.class.name,
        enrollment.section?.name || "",
        escapeCsv(user.email || ""),
        escapeCsv(user.phone || ""),
        student.gender || "",
        dob,
        escapeCsv(student.address || ""),
        escapeCsv(student.emergencyContact || ""),
      ].join(",") + "\n"
    }

    // Determine filename
    let filename = "class_students.csv"
    if (sectionsToQuery.length === 1) {
      const sectionInfo = enrollments[0]
      filename = `${sectionInfo.class.name}_${sectionInfo.section?.name}_students.csv`
        .replace(/\s+/g, "_")
        .toLowerCase()
    } else {
      filename = "my_class_students.csv"
    }

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "EXPORT",
      "Student",
      request,
      {
        description: `Downloaded class student list`,
        metadata: { 
          sectionIds: sectionsToQuery, 
          studentCount: enrollments.length,
          academicYearId: currentAcademicYear.id 
        },
      }
    )

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename=${filename}`,
      },
    })
  } catch (error) {
    console.error("Error downloading class students:", error)
    return NextResponse.json(
      { error: "Failed to download student list" },
      { status: 500 }
    )
  }
}
