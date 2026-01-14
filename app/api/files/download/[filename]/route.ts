import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

const FILESERVER_URL = process.env.FILESERVER_URL || "http://localhost:3012"

export async function GET(
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
    
    // Fetch the file from the fileserver
    const response = await fetch(`${FILESERVER_URL}/uploads/${filename}`)

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: "File not found" },
          { status: 404 }
        )
      }
      throw new Error(`Fileserver responded with status: ${response.status}`)
    }

    // Get the file data
    const fileBuffer = await response.arrayBuffer()
    const contentType = response.headers.get("content-type") || "application/octet-stream"
    
    // Return the file with appropriate headers
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })

  } catch (error) {
    console.error("Error downloading file:", error)
    return NextResponse.json(
      { error: "Failed to download file" },
      { status: 500 }
    )
  }
}