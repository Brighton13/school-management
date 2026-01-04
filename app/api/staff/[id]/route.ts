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
      gender,
      dateOfBirth,
      address,
    } = body

    const staff = await prisma.staff.findUnique({
      where: { id: params.id },
      include: { user: true },
    })

    if (!staff) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 })
    }

    const updateData: any = {}

    // Only update user fields if provided
    if (name !== undefined) updateData.name = name
    if (phone !== undefined) updateData.phone = phone || null
    if (email && email !== staff.user.email) {
      updateData.email = email
    }
    if (password) {
      updateData.password = await bcrypt.hash(password, 10)
    }

    // Only update role if designation is changing
    let newRoleName: string | null = null
    if (designation && designation !== staff.designation) {
      newRoleName = designation === "PRINCIPAL" ? "PRINCIPAL" :
                    designation === "ACCOUNTANT" ? "ACCOUNTANT" :
                    designation === "LIBRARIAN" ? "LIBRARIAN" : "TEACHER"
      updateData.role = newRoleName
    }

    // Build staff update data - only include fields that are provided
    const staffUpdateData: any = {}
    if (employeeId !== undefined) staffUpdateData.employeeId = employeeId
    if (designation !== undefined) staffUpdateData.designation = designation
    if (department !== undefined) staffUpdateData.department = department
    if (qualification !== undefined) staffUpdateData.qualification = qualification
    if (experience !== undefined) staffUpdateData.experience = experience ? parseInt(experience) : null
    if (salary !== undefined) staffUpdateData.salary = salary ? parseFloat(salary) : null
    if (joiningDate !== undefined) staffUpdateData.joiningDate = joiningDate ? new Date(joiningDate) : null
    if (gender !== undefined) staffUpdateData.gender = gender || null
    if (dateOfBirth !== undefined) staffUpdateData.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null
    if (address !== undefined) staffUpdateData.address = address || null

    // Use a transaction to update user, staff, and role assignment
    const updatedStaff = await prisma.$transaction(async (tx) => {
      // Only update user if there are changes
      if (Object.keys(updateData).length > 0) {
        await tx.user.update({
          where: { id: staff.userId },
          data: updateData,
        })
      }

      // If role is changing, update UserRole table
      if (newRoleName) {
        const newRole = await tx.role.findUnique({
          where: { name: newRoleName },
        })

        if (newRole) {
          // Remove existing role assignments and add new one
          await tx.userRole.deleteMany({
            where: { userId: staff.userId },
          })

          await tx.userRole.create({
            data: {
              userId: staff.userId,
              roleId: newRole.id,
            },
          })
        }
      }

      return tx.staff.update({
        where: { id: params.id },
        data: staffUpdateData,
        include: {
          user: true,
        },
      })
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

