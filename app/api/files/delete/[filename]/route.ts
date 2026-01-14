import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

const FILESERVER_URL = process.env.FILESERVER_URL || "http://localhost:3012"

export async function DELETE(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { filename } = params

    // Forward the delete request to the fileserver
    const response = await fetch(`${FILESERVER_URL}/files/delete/${encodeURIComponent(filename)}`, {
      method: "DELETE",
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || `Fileserver responded with status: ${response.status}`)
    }

    const result = await response.json()

    return NextResponse.json({
      success: true,
      message: result.message,
    })

  } catch (error) {
    console.error("Error deleting file:", error)
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    )
  }
}