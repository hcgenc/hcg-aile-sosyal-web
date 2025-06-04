// APP CONTROL API ENDPOINT
// Admin'in uygulamayı kontrol etmesi için güvenli endpoint

import { NextRequest, NextResponse } from 'next/server'
import { checkAppStatus, updateAppStatus } from '@/lib/app-control'
import { verifyToken } from '@/lib/auth'
import { rateLimit, getClientIP } from '@/lib/security'

export async function GET(request: NextRequest) {
  try {
    // Rate limiting kontrol
    const rateLimitResult = rateLimit({ windowMs: 60000, maxRequests: 10 })(request) // 10 requests per minute
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded for app control API',
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
        },
        { status: 429 }
      )
    }

    // JWT token kontrolü
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const tokenData = await verifyToken(token)
    
    if (!tokenData) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    // Admin kontrolü
    if (tokenData.role !== 'editor') {
      return NextResponse.json(
        { error: 'Access denied: Editor role required' },
        { status: 403 }
      )
    }

    // App status bilgisini döndür
    const status = await checkAppStatus()
    
    return NextResponse.json({
      success: true,
      status: {
        isActive: status.isActive,
        reason: status.reason,
        updatedAt: status.updatedAt,
        updatedBy: status.updatedBy
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('App control GET error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to get app status'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting kontrol (POST için daha sıkı)
    const rateLimitResult = rateLimit({ windowMs: 60000, maxRequests: 5 })(request) // 5 requests per minute
    
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded for app control updates',
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
        },
        { status: 429 }
      )
    }

    // JWT token kontrolü
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const tokenData = await verifyToken(token)
    
    if (!tokenData) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    // Admin kontrolü
    if (tokenData.role !== 'editor') {
      return NextResponse.json(
        { error: 'Access denied: Editor role required' },
        { status: 403 }
      )
    }

    // Request body kontrolü
    const body = await request.json()
    
    if (typeof body.active !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid request: active field must be boolean' },
        { status: 400 }
      )
    }

    // XSS ve injection koruması
    const reason = typeof body.reason === 'string' ? body.reason.slice(0, 500) : ''
    if (reason && (reason.includes('<script') || reason.includes('javascript:'))) {
      return NextResponse.json(
        { error: 'Malicious content detected in reason field' },
        { status: 400 }
      )
    }

    // App status güncelle
    const result = await updateAppStatus(
      body.active,
      reason,
      tokenData.username
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      )
    }

    // Başarılı yanıt
    return NextResponse.json({
      success: true,
      message: result.message,
      status: {
        isActive: body.active,
        reason: reason || `Status changed by ${tokenData.username}`,
        updatedBy: tokenData.username,
        updatedAt: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('App control POST error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to update app status'
      },
      { status: 500 }
    )
  }
}

// OPTIONS method for CORS
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    }
  )
} 