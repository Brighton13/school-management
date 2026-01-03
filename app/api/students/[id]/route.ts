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

    const student = await prisma.student.findUnique({
      where: { id: params.id },
      include: {
        user: true,
        classEnrollment: {
          include: {
            class: true,
            section: true,
          },
        },
      },
    })

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    return NextResponse.json(student)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch student" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requirePermission(request, Permissions.STUDENTS_UPDATE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      email,
      password,
      name,
      phone,
      admissionNumber,
      dateOfBirth,
      gender,
      address,
      emergencyContact,
    } = body

    const student = await prisma.student.findUnique({
      where: { id: params.id },
      include: { user: true },
    })

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const updateData: any = {
      name,
      phone: phone || null,
    }

    if (email && email !== student.user.email) {
      updateData.email = email
    }

    if (password) {
      updateData.password = await bcrypt.hash(password, 10)
    }

    const updatedUser = await prisma.user.update({
      where: { id: student.userId },
      data: updateData,
    })

    const updatedStudent = await prisma.student.update({
      where: { id: params.id },
      data: {
        admissionNumber: admissionNumber || student.admissionNumber,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : student.dateOfBirth,
        gender: gender || student.gender,
        address: address !== undefined ? address : student.address,
        emergencyContact: emergencyContact !== undefined ? emergencyContact : student.emergencyContact,
      },
      include: {
        user: true,
        classEnrollment: {
          include: {
            class: true,
            section: true,
          },
        },
      },
    })

    // Log audit trail
    await logAuditTrail(
      session.user.id,
      "UPDATE",
      "Student",
      request,
      {
        entityId: params.id,
        description: `Updated student: ${updatedStudent.user.name} (${updatedStudent.admissionNumber})`,
      }
    )

    return NextResponse.json(updatedStudent)
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Email or admission number already exists" },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: "Failed to update student" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requirePermission(request, Permissions.STUDENTS_DELETE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const student = await prisma.student.findUnique({
      where: { id: params.id },
      include: { user: true },
    })

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    // Log audit trail before deletion
    await logAuditTrail(
      session.user.id,
      "DELETE",
      "Student",
      request,
      {
        entityId: params.id,
        description: `Deleted student: ${student.user.name} (${student.admissionNumber})`,
      }
    )

    await prisma.user.delete({
      where: { id: student.userId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete student" },
      { status: 500 }
    )
  }
}

