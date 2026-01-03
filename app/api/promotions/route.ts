import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAuditTrail } from "@/lib/audit"
import { getCurrentAcademicYear, getUpcomingAcademicYear } from "@/lib/academic-year"
import { requirePermission, Permissions } from "@/lib/permissions"

// GET: Fetch classes with enrolled students for promotion preview
export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission(request, Permissions.PROMOTIONS_READ)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const classId = searchParams.get("classId")
    const sectionId = searchParams.get("sectionId")

    const currentAcademicYear = await getCurrentAcademicYear()
    if (!currentAcademicYear) {
      return NextResponse.json(
        { error: "No current academic year configured" },
        { status: 400 }
      )
    }

    const upcomingAcademicYear = await getUpcomingAcademicYear()

    // Get all classes ordered by level
    const classes = await prisma.class.findMany({
      orderBy: { level: "asc" },
      include: {
        sections: {
          orderBy: { name: "asc" },
        },
      },
    })

    // If specific class/section requested, return enrolled students
    if (classId) {
      const enrollments = await prisma.classEnrollment.findMany({
        where: {
          classId,
          ...(sectionId ? { sectionId } : {}),
          academicYearId: currentAcademicYear.id,
          status: "ACTIVE",
        },
        include: {
          student: {
            include: { user: true },
          },
          class: true,
          section: true,
          academicYear: true,
        },
        orderBy: [
          { section: { name: "asc" } },
          { student: { user: { name: "asc" } } },
        ],
      })

      // Find the next level class
      const currentClass = classes.find(c => c.id === classId)
      const nextClass = currentClass
        ? classes.find(c => c.level === currentClass.level + 1)
        : null

      return NextResponse.json({
        enrollments,
        currentClass,
        nextClass,
        classes,
        currentAcademicYear,
        upcomingAcademicYear,
      })
    }

    // Return summary of classes with enrollment counts
    const classesWithCounts = await Promise.all(
      classes.map(async (cls) => {
        const enrollmentCount = await prisma.classEnrollment.count({
          where: {
            classId: cls.id,
            academicYearId: currentAcademicYear.id,
            status: "ACTIVE",
          },
        })

        const nextClass = classes.find(c => c.level === cls.level + 1)

        return {
          ...cls,
          enrollmentCount,
          nextClass: nextClass ? { id: nextClass.id, name: nextClass.name, level: nextClass.level } : null,
        }
      })
    )

    return NextResponse.json({
      classes: classesWithCounts,
      currentAcademicYear,
      upcomingAcademicYear,
    })
  } catch (error) {
    console.error("Failed to fetch promotion data:", error)
    return NextResponse.json(
      { error: "Failed to fetch promotion data" },
      { status: 500 }
    )
  }
}

// POST: Promote students from one class to the next (or graduate final level)
export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, Permissions.PROMOTIONS_CREATE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { classId, sectionId, studentIds, targetAcademicYearId, action } = body

    if (!classId) {
      return NextResponse.json(
        { error: "Class ID is required" },
        { status: 400 }
      )
    }

    const currentAcademicYear = await getCurrentAcademicYear()
    if (!currentAcademicYear) {
      return NextResponse.json(
        { error: "No current academic year configured" },
        { status: 400 }
      )
    }

    // Get the current class
    const currentClass = await prisma.class.findUnique({
      where: { id: classId },
      include: { sections: true },
    })

    if (!currentClass) {
      return NextResponse.json(
        { error: "Class not found" },
        { status: 404 }
      )
    }

    // Find the next level class
    const nextClass = await prisma.class.findFirst({
      where: { level: currentClass.level + 1 },
      include: { sections: true },
    })

    // If action is "graduate" or no next class exists, graduate the students
    const isGraduation = action === "graduate" || !nextClass

    // For promotion (not graduation), we need target year and next class
    let targetYear = null
    if (!isGraduation) {
      if (targetAcademicYearId) {
        targetYear = await prisma.academicYear.findUnique({
          where: { id: targetAcademicYearId },
        })
      } else {
        targetYear = await getUpcomingAcademicYear()
      }

      if (!targetYear) {
        return NextResponse.json(
          { error: "No upcoming academic year configured. Please create an upcoming academic year first." },
          { status: 400 }
        )
      }
    }

    // Get enrollments to process
    const enrollmentsToProcess = await prisma.classEnrollment.findMany({
      where: {
        classId,
        ...(sectionId ? { sectionId } : {}),
        ...(studentIds && studentIds.length > 0 ? { studentId: { in: studentIds } } : {}),
        academicYearId: currentAcademicYear.id,
        status: "ACTIVE",
      },
      include: {
        student: {
          include: { user: true },
        },
        section: true,
      },
    })

    if (enrollmentsToProcess.length === 0) {
      return NextResponse.json(
        { error: "No eligible students found" },
        { status: 400 }
      )
    }

    const results = {
      promoted: 0,
      graduated: 0,
      failed: 0,
      errors: [] as string[],
    }

    // Process each enrollment
    for (const enrollment of enrollmentsToProcess) {
      try {
        if (isGraduation) {
          // Graduate the student
          await prisma.classEnrollment.update({
            where: { id: enrollment.id },
            data: { status: "GRADUATED" },
          })
          results.graduated++
        } else {
          // Promote to next class
          // Find matching section in next class (same name)
          let targetSection = nextClass!.sections.find(
            s => s.name.toLowerCase() === enrollment.section.name.toLowerCase()
          )

          // If no matching section, use first section
          if (!targetSection && nextClass!.sections.length > 0) {
            targetSection = nextClass!.sections[0]
          }

          if (!targetSection) {
            results.failed++
            results.errors.push(
              `No section available in ${nextClass!.name} for student ${enrollment.student.user.name}`
            )
            continue
          }

          // Check if student already enrolled in target
          const existingEnrollment = await prisma.classEnrollment.findFirst({
            where: {
              studentId: enrollment.studentId,
              academicYearId: targetYear!.id,
            },
          })

          if (existingEnrollment) {
            results.failed++
            results.errors.push(
              `${enrollment.student.user.name} is already enrolled in ${targetYear!.year}`
            )
            continue
          }

          // Create new enrollment in next class
          await prisma.$transaction(async (tx) => {
            // Mark old enrollment as PROMOTED
            await tx.classEnrollment.update({
              where: { id: enrollment.id },
              data: { status: "PROMOTED" },
            })

            // Create new enrollment
            await tx.classEnrollment.create({
              data: {
                studentId: enrollment.studentId,
                classId: nextClass!.id,
                sectionId: targetSection!.id,
                academicYearId: targetYear!.id,
                status: "ACTIVE",
              },
            })
          })

          results.promoted++
        }
      } catch (error: any) {
        results.failed++
        results.errors.push(
          `Failed to process ${enrollment.student.user.name}: ${error.message}`
        )
      }
    }

    // Log audit trail
    const actionDescription = isGraduation
      ? `Graduated ${results.graduated} students from ${currentClass.name}`
      : `Promoted ${results.promoted} students from ${currentClass.name} to ${nextClass!.name} for ${targetYear!.year}`

    await logAuditTrail(
      session.user.id,
      isGraduation ? "GRADUATE" : "PROMOTE",
      "ClassEnrollment",
      request,
      {
        description: actionDescription,
        metadata: {
          fromClass: currentClass.name,
          toClass: isGraduation ? "GRADUATED" : nextClass!.name,
          targetYear: isGraduation ? null : targetYear!.year,
          promoted: results.promoted,
          graduated: results.graduated,
          failed: results.failed,
        },
      }
    )

    return NextResponse.json({
      message: isGraduation
        ? `Graduation complete. ${results.graduated} students graduated, ${results.failed} failed.`
        : `Promotion complete. ${results.promoted} students promoted, ${results.failed} failed.`,
      results,
      fromClass: currentClass.name,
      toClass: isGraduation ? "GRADUATED" : nextClass!.name,
      targetYear: isGraduation ? null : targetYear!.year,
      isGraduation,
    })
  } catch (error) {
    console.error("Failed to process students:", error)
    return NextResponse.json(
      { error: "Failed to process students" },
      { status: 500 }
    )
  }
}
