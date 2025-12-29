import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"
import { createBulkNotifications, createNotification } from "@/lib/notifications"

/**
 * Principal bulk approval of reports for a specific class section
 * - Only PENDING_CLASS_TEACHER or PENDING_PRINCIPAL reports can be approved
 * - Principal can approve multiple reports at once for a specific section
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "PRINCIPAL") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { sectionId, academicTermId, reportIds, approvalNote } = body

    if (!sectionId || !academicTermId) {
      return NextResponse.json(
        { error: "Missing required fields: sectionId, academicTermId" },
        { status: 400 }
      )
    }

    // Get reports to approve
    const whereClause: any = {
      sectionId,
      academicTermId,
      status: { in: ["PENDING_CLASS_TEACHER", "PENDING_PRINCIPAL"] }
    }

    if (reportIds && reportIds.length > 0) {
      whereClause.id = { in: reportIds }
    }

    const reportsToApprove = await prisma.studentReport.findMany({
      where: whereClause,
      include: {
        student: { include: { user: true } },
        section: { 
          include: { 
            class: true,
            classTeacher: { include: { user: true } }
          } 
        }
      }
    })

    if (reportsToApprove.length === 0) {
      return NextResponse.json(
        { error: "No pending reports found for approval" },
        { status: 404 }
      )
    }

    // Approve all reports
    const approvedReports = await Promise.all(
      reportsToApprove.map(report =>
        prisma.studentReport.update({
          where: { id: report.id },
          data: {
            status: "APPROVED",
            approvedBy: session.user.id,
            approvedAt: new Date()
          },
          include: {
            student: { include: { user: true } },
            section: { 
              include: { 
                class: true,
                classTeacher: { include: { user: true } }
              } 
            }
          }
        })
      )
    )

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "UPDATE",
      "StudentReport",
      request,
      {
        entityId: approvedReports.map(r => r.id).join(","),
        description: `Approved ${approvedReports.length} reports for ${approvedReports[0].section.class.name} - ${approvedReports[0].section.name}`
      }
    )

    // Create notifications for students and teachers
    const notificationPromises = approvedReports.map(report => 
      Promise.all([
        createNotification({
          userId: report.student.userId,
          title: "Report Approved",
          message: `Your report card for ${report.section.class.name} has been approved by the principal`,
          type: "SUCCESS",
          category: "RESULT",
          link: `/dashboard/reports/${report.id}`,
          metadata: { reportId: report.id }
        }),
        report.section.classTeacher 
          ? createNotification({
              userId: report.section.classTeacher.userId,
              title: "Report Approved",
              message: `Report for ${report.student.user.name} has been approved`,
              type: "SUCCESS",
              category: "RESULT",
              link: `/dashboard/reports/${report.id}`,
              metadata: { reportId: report.id }
            })
          : Promise.resolve()
      ])
    )

    await Promise.all(notificationPromises)

    return NextResponse.json({
      message: "Reports approved successfully",
      approvedCount: approvedReports.length,
      reports: approvedReports
    }, { status: 200 })
  } catch (error) {
    console.error("Bulk approval error:", error)
    return NextResponse.json(
      { error: "Failed to approve reports" },
      { status: 500 }
    )
  }
}

/**
 * GET - List pending reports for principal approval
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "PRINCIPAL") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sectionId = searchParams.get("sectionId")
    const academicTermId = searchParams.get("academicTermId")

    const whereClause: any = {
      status: { in: ["PENDING_CLASS_TEACHER", "PENDING_PRINCIPAL"] }
    }

    if (sectionId) whereClause.sectionId = sectionId
    if (academicTermId) whereClause.academicTermId = academicTermId

    const pendingReports = await prisma.studentReport.findMany({
      where: whereClause,
      include: {
        student: { include: { user: true } },
        section: { 
          include: { 
            class: true,
            classTeacher: { include: { user: true } }
          } 
        },
        academicTerm: true,
        exam: true,
        comments: {
          include: { teacher: { include: { user: true } } }
        }
      },
      orderBy: [{ sectionId: "asc" }, { createdAt: "desc" }]
    })

    // Group by section for easier display
    const groupedReports = new Map()
    pendingReports.forEach(report => {
      const key = `${report.sectionId}-${report.academicTermId}`
      if (!groupedReports.has(key)) {
        groupedReports.set(key, [])
      }
      groupedReports.get(key).push(report)
    })

    const grouped = Array.from(groupedReports.entries()).map(([key, reports]) => ({
      key,
      sectionId: reports[0].sectionId,
      academicTermId: reports[0].academicTermId,
      section: reports[0].section,
      academicTerm: reports[0].academicTerm,
      count: reports.length,
      reports
    }))

    return NextResponse.json(grouped)
  } catch (error) {
    console.error("Fetch pending reports error:", error)
    return NextResponse.json(
      { error: "Failed to fetch pending reports" },
      { status: 500 }
    )
  }
}
