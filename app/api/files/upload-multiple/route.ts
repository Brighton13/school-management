import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

const FILESERVER_URL = process.env.FILESERVER_URL || "http://localhost:3012"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Get the form data from the request
    const formData = await request.formData()
    
    // Forward the form data to the fileserver
    const response = await fetch(`${FILESERVER_URL}/files/upload-multiple`, {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`Fileserver responded with status: ${response.status}`)
    }

    const result = await response.json()
    
    return NextResponse.json({
      success: true,
      files: result.files,
    })

  } catch (error) {
    console.error("Error uploading files:", error)
    return NextResponse.json(
      { error: "Failed to upload files" },
      { status: 500 }
    )
  }
}