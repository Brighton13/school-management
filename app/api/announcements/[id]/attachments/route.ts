import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requirePermission, Permissions } from "@/lib/permissions"
import { writeFile } from "fs/promises"
import { join } from "path"
import { mkdir } from "fs/promises"

const UPLOADS_DIR = join(process.cwd(), "public", "uploads", "announcements")

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requirePermission(request, Permissions.ANNOUNCEMENTS_UPDATE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File
    
    if (!file || file.size === 0) {
      return NextResponse.json({ 
        message: "No file selected for upload" 
      }, { status: 200 })
    }

    // Check if announcement exists
    const announcement = await prisma.announcement.findUnique({
      where: { id: params.id },
    })

    if (!announcement) {
      return NextResponse.json(
        { error: "Announcement not found" },
        { status: 404 }
      )
    }

    // Create uploads directory if it doesn't exist
    try {
      await mkdir(UPLOADS_DIR, { recursive: true })
    } catch (error) {
      // Directory might already exist, ignore error
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Generate unique filename
    const timestamp = Date.now()
    const extension = file.name.split('.').pop()
    const fileName = `${timestamp}-${Math.random().toString(36).substring(2)}.${extension}`
    const filePath = join(UPLOADS_DIR, fileName)

    await writeFile(filePath, buffer)

    // Save attachment info to database
    const attachment = await prisma.announcementAttachment.create({
      data: {
        announcementId: params.id,
        fileName,
        originalName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        filePath: `/uploads/announcements/${fileName}`,
      },
    })

    return NextResponse.json(attachment)
  } catch (error: any) {
    console.error("File upload error:", error)
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requirePermission(request, Permissions.ANNOUNCEMENTS_UPDATE)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const attachmentId = searchParams.get("attachmentId")

    if (!attachmentId) {
      return NextResponse.json(
        { error: "Attachment ID required" },
        { status: 400 }
      )
    }

    // Get attachment info before deletion
    const attachment = await prisma.announcementAttachment.findUnique({
      where: { id: attachmentId },
    })

    if (!attachment) {
      return NextResponse.json(
        { error: "Attachment not found" },
        { status: 404 }
      )
    }

    // Delete from database
    await prisma.announcementAttachment.delete({
      where: { id: attachmentId },
    })

    return NextResponse.json({ message: "Attachment deleted successfully" })
  } catch (error: any) {
    console.error("File deletion error:", error)
    return NextResponse.json(
      { error: "Failed to delete attachment" },
      { status: 500 }
    )
  }
}