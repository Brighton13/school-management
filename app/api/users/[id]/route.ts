import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { logAuditTrail } from "@/lib/audit"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !["ADMIN", "PRINCIPAL"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        student: {
          select: {
            admissionNumber: true,
          },
        },
        staff: {
          select: {
            employeeId: true,
            designation: true,
          },
        },
        parent: {
          select: {
            id: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const { password, ...userWithoutPassword } = user
    return NextResponse.json(userWithoutPassword)
  } catch (error) {
    console.error("Error fetching user:", error)
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { email, password, name, phone, role, isActive, permissions } = body

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: params.id },
    })
    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Validate role if provided
    if (role) {
      const validRoles = [
        "ADMIN",
        "PRINCIPAL",
        "TEACHER",
        "ACCOUNTANT",
        "LIBRARIAN",
        "STUDENT",
        "PARENT",
      ]
      if (!validRoles.includes(role)) {
        return NextResponse.json(
          { error: `Invalid role. Must be one of: ${validRoles.join(", ")}` },
          { status: 400 }
        )
      }
    }

    // Check email uniqueness if email is being changed
    if (email && email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email },
      })
      if (emailExists) {
        return NextResponse.json(
          { error: "User with this email already exists" },
          { status: 400 }
        )
      }
    }

    // Prepare update data
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (email !== undefined) updateData.email = email
    if (phone !== undefined) updateData.phone = phone || null
    if (role !== undefined) updateData.role = role
    if (isActive !== undefined) updateData.isActive = isActive
    if (password) {
      updateData.password = await bcrypt.hash(password, 10)
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
    })

    // Update permissions if provided
    if (permissions !== undefined && Array.isArray(permissions)) {
      // Get all existing permissions
      const existingPermissions = await prisma.userPermission.findMany({
        where: { userId: params.id },
      })

      const existingPermissionIds = new Set(
        existingPermissions.map((p) => p.permissionId)
      )
      const newPermissionIds = new Set(permissions)

      // Remove permissions that are no longer in the list
      const toRemove = existingPermissions.filter(
        (p) => !newPermissionIds.has(p.permissionId)
      )
      await Promise.all(
        toRemove.map((p) =>
          prisma.userPermission.delete({
            where: { id: p.id },
          })
        )
      )

      // Add new permissions
      const toAdd = permissions.filter(
        (permissionId: string) => !existingPermissionIds.has(permissionId)
      )
      await Promise.all(
        toAdd.map((permissionId: string) =>
          prisma.userPermission.create({
            data: {
              userId: params.id,
              permissionId,
              granted: true,
            },
          })
        )
      )
    }

    // Fetch updated user with permissions
    const userWithPermissions = await prisma.user.findUnique({
      where: { id: params.id },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    })

    const { password: _, ...userWithoutPassword } = userWithPermissions!

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "UPDATE",
      "User",
      request,
      {
        entityId: params.id,
        description: `Updated user: ${userWithoutPassword.name} (${userWithoutPassword.email})`,
        metadata: { role: userWithoutPassword.role, isActive: userWithoutPassword.isActive },
      }
    )

    return NextResponse.json(userWithoutPassword)
  } catch (error: any) {
    console.error("Error updating user:", error)
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: error.message || "Failed to update user" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Prevent deleting yourself
    if (params.id === session.user.id) {
      return NextResponse.json(
        { error: "You cannot delete your own account" },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: params.id },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Log audit trail before deletion
    await logAuditTrail(
      session.user.id,
      "DELETE",
      "User",
      request,
      {
        entityId: params.id,
        description: `Deleted user: ${user.name} (${user.email})`,
      }
    )

    await prisma.user.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting user:", error)
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    )
  }
}

