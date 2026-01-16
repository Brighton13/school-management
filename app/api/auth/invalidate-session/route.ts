import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Create response with cache-busting headers
    const response = NextResponse.json({ success: true })
    
    // Set headers to prevent caching and ensure logout
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, private')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    response.headers.set('Clear-Site-Data', '"cache", "storage"')
    
    return response
    
  } catch (error) {
    console.error('Error invalidating session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}