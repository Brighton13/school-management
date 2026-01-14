import { NextResponse } from "next/server"

export async function GET() {
  try {
    // Basic health check
    const health = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      service: "school-management-system",
      version: "1.0.0"
    }

    return NextResponse.json(health)
  } catch (error) {
    return NextResponse.json(
      { 
        status: "unhealthy", 
        timestamp: new Date().toISOString(),
        error: "Service unavailable" 
      },
      { status: 503 }
    )
  }
}