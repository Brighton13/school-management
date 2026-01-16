import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"
import { getAcademicContext } from "@/lib/academic-year"

// Get attendance records for a section/date (current term only by default)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const sectionId = searchParams.get("sectionId")
    const date = searchParams.get("date")
    const includeArchived = searchParams.get("includeArchived") === "true"

    if (!sectionId || !date) {
      return NextResponse.json(
        { error: "sectionId and date are required" },
        { status: 400 }
      )
    }

    // Get current academic context
    const context = await getAcademicContext()

    // Validate that the requested date is within the current term
    const currentTerm = await prisma.term.findUnique({
      where: { id: context.termId },
    })

    if (!currentTerm) {
      return NextResponse.json(
        { error: "No active term found" },
        { status: 400 }
      )
    }

    const requestedDate = new Date(date)
    requestedDate.setHours(0, 0, 0, 0)
    const termStartDate = new Date(currentTerm.startDate)
    termStartDate.setHours(0, 0, 0, 0)
    const termEndDate = new Date(currentTerm.endDate)
    termEndDate.setHours(23, 59, 59, 999)

    if (requestedDate < termStartDate || requestedDate > termEndDate) {
      return NextResponse.json(
        { 
          error: `Date is outside the current term period (${termStartDate.toLocaleDateString()} - ${termEndDate.toLocaleDateString()})` 
        },
        { status: 400 }
      )
    }

    // Get user's staff record
    const staff = await prisma.staff.findUnique({
      where: { userId: session.user.id },
    })

    if (!staff) {
      return NextResponse.json(
        { error: "User is not a staff member" },
        { status: 403 }
      )
    }

    // Check if user is class teacher for this section
    const section = await prisma.section.findUnique({
      where: { id: sectionId },
      include: {
        class: true,
        enrollments: {
          // Filter enrollments by current academic year
          where: {
            academicYearId: context.academicYearId,
            status: "ACTIVE",
          },
          include: { student: { include: { user: true } } },
        },
      },
    })

    if (!section) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 })
    }

    // Verify the user is the class teacher
    if (section.classTeacherId !== staff.id) {
      return NextResponse.json(
        { error: "You are not the class teacher for this section" },
        { status: 403 }
      )
    }

    // Get attendance records for this date (filtered by current term and archive status)
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)

    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        sectionId: sectionId,
        academicYearId: context.academicYearId,
        termId: context.termId,
        isArchived: includeArchived ? undefined : false,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    })

    // Map enrollments with attendance data
    const studentAttendance = section.enrollments.map((enrollment) => {
      const attendance = attendanceRecords.find(
        (a) => a.studentId === enrollment.studentId
      )
      return {
        studentId: enrollment.studentId,
        studentName: enrollment.student.user.name,
        admissionNumber: enrollment.student.admissionNumber,
        attendance: attendance || null,
      }
    })

    return NextResponse.json({
      sectionId,
      sectionName: section.name,
      className: section.class.name,
      date,
      academicYear: context.academicYear,
      term: context.termName,
      students: studentAttendance,
    })
  } catch (error: any) {
    console.error("Error fetching attendance:", error)
    return NextResponse.json(
      { error: "Failed to fetch attendance", details: error.message },
      { status: 500 }
    )
  }
}

// Create or update attendance records
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { sectionId, date, attendance } = await request.json()

    if (!sectionId || !date || !attendance || !Array.isArray(attendance)) {
      return NextResponse.json(
        { error: "sectionId, date, and attendance array are required" },
        { status: 400 }
      )
    }

    // Get current academic context
    const context = await getAcademicContext()

    // Get user's staff record
    const staff = await prisma.staff.findUnique({
      where: { userId: session.user.id },
    })

    if (!staff) {
      return NextResponse.json(
        { error: "User is not a staff member" },
        { status: 403 }
      )
    }

    // Verify the user is the class teacher
    const section = await prisma.section.findUnique({
      where: { id: sectionId },
    })

    if (!section) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 })
    }

    if (section.classTeacherId !== staff.id) {
      return NextResponse.json(
        { error: "You are not the class teacher for this section" },
        { status: 403 }
      )
    }

    // Parse date
    const attendanceDate = new Date(date)
    attendanceDate.setHours(0, 0, 0, 0)

    // Validate that the date is within the current term's configured dates
    const currentTerm = await prisma.term.findUnique({
      where: { id: context.termId },
    })

    if (!currentTerm) {
      return NextResponse.json(
        { error: "No active term found" },
        { status: 400 }
      )
    }

    const termStartDate = new Date(currentTerm.startDate)
    termStartDate.setHours(0, 0, 0, 0)
    const termEndDate = new Date(currentTerm.endDate)
    termEndDate.setHours(23, 59, 59, 999)

    if (attendanceDate < termStartDate || attendanceDate > termEndDate) {
      return NextResponse.json(
        { 
          error: `Attendance can only be recorded for dates within the current term (${termStartDate.toLocaleDateString()} - ${termEndDate.toLocaleDateString()})` 
        },
        { status: 400 }
      )
    }

    // Update or create attendance records (always linked to current academic context)
    const results = await Promise.all(
      attendance.map(async (record: any) => {
        const { studentId, status, remarks } = record

        if (!studentId || !status) {
          return { success: false, error: "studentId and status are required" }
        }

        // Upsert attendance with academic context
        const result = await prisma.attendance.upsert({
          where: {
            studentId_sectionId_date: {
              studentId,
              sectionId,
              date: attendanceDate,
            },
          },
          update: {
            status,
            remarks: remarks || null,
            // Archive status is preserved on updates
          },
          create: {
            studentId,
            sectionId,
            date: attendanceDate,
            status,
            remarks: remarks || null,
            academicYearId: context.academicYearId,
            termId: context.termId,
            isArchived: false,
          },
        })

        // Audit log
        await logAuditTrail(
          session.user!.id,
          "UPDATE",
          "Attendance",
          request,
          {
            entityId: result.id,
            description: `Marked attendance: ${status} for ${context.academicYear} - ${context.termName}`,
          }
        )

        return { success: true, data: result }
      })
    )

    const successCount = results.filter((r) => r.success).length
    const failureCount = results.filter((r) => !r.success).length

    return NextResponse.json({
      message: "Attendance updated successfully",
      successCount,
      failureCount,
      errors: results.filter((r) => !r.success),
    })
  } catch (error: any) {
    console.error("Error saving attendance:", error)
    return NextResponse.json(
      { error: "Failed to save attendance", details: error.message },
      { status: 500 }
    )
  }
}
