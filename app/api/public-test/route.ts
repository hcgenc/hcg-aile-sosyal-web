import { NextRequest, NextResponse } from 'next/server'
import { applySecurityHeaders } from '@/lib/middleware'

// Public test endpoint - no authentication required
export async function GET(request: NextRequest) {
  try {
    const response = NextResponse.json({ 
      message: 'Public test endpoint',
      timestamp: new Date().toISOString(),
      status: 'ok'
    })
    
    return applySecurityHeaders(response)
    
  } catch (error) {
    const response = NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
    return applySecurityHeaders(response)
  }
} 