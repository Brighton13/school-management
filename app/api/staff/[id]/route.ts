import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { logAuditTrail } from "@/lib/audit"
import { requirePermission, Permissions } from "@/lib/permissions"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const staff = await prisma.staff.findUnique({
      where: { id: params.id },
      include: {
        user: true,
      },
    })

    if (!staff) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 })
    }

    return NextResponse.json(staff)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch staff" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requirePermission(request, Permissions.STAFF_UPDATE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      email,
      password,
      name,
      phone,
      employeeId,
      designation,
      department,
      qualification,
      experience,
      salary,
      joiningDate,
    } = body

    const staff = await prisma.staff.findUnique({
      where: { id: params.id },
      include: { user: true },
    })

    if (!staff) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 })
    }

    const updateData: any = {
      name,
      phone: phone || null,
    }

    if (email && email !== staff.user.email) {
      updateData.email = email
    }

    if (password) {
      updateData.password = await bcrypt.hash(password, 10)
    }

    const role = designation === "PRINCIPAL" ? "PRINCIPAL" :
                 designation === "ACCOUNTANT" ? "ACCOUNTANT" :
                 designation === "LIBRARIAN" ? "LIBRARIAN" : "TEACHER"

    if (designation) {
      updateData.role = role
    }

    await prisma.user.update({
      where: { id: staff.userId },
      data: updateData,
    })

    const updatedStaff = await prisma.staff.update({
      where: { id: params.id },
      data: {
        employeeId: employeeId || staff.employeeId,
        designation: designation || staff.designation,
        department: department !== undefined ? department : staff.department,
        qualification: qualification !== undefined ? qualification : staff.qualification,
        experience: experience ? parseInt(experience) : staff.experience,
        salary: salary ? parseFloat(salary) : staff.salary,
        joiningDate: joiningDate ? new Date(joiningDate) : staff.joiningDate,
      },
      include: {
        user: true,
      },
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "UPDATE",
      "Staff",
      request,
      {
        entityId: params.id,
        description: `Updated staff member: ${updatedStaff.user.name} (${updatedStaff.employeeId})`,
      }
    )

    return NextResponse.json(updatedStaff)
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Email or employee ID already exists" },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Failed to update staff" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requirePermission(request, Permissions.STAFF_DELETE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const staff = await prisma.staff.findUnique({
      where: { id: params.id },
      include: { user: true },
    })

    if (!staff) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 })
    }

    // Log audit trail before deletion
    await logAuditTrail(
      session.user.id,
      "DELETE",
      "Staff",
      request,
      {
        entityId: params.id,
        description: `Deleted staff member: ${staff.user.name} (${staff.employeeId})`,
      }
    )

    await prisma.user.delete({
      where: { id: staff.userId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete staff" },
      { status: 500 }
    )
  }
}

