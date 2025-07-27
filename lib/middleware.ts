import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, extractTokenFromHeaders, JWTPayload } from './auth'
import { rateLimit, logSecurityEvent, securityHeaders } from './security'

export interface AuthenticatedRequest extends NextRequest {
  user?: JWTPayload
}

// Authentication middleware
export async function authenticateRequest(request: NextRequest): Promise<{ success: boolean; user?: JWTPayload; response?: NextResponse }> {
  try {
    const token = extractTokenFromHeaders(request.headers)
    
    if (!token) {
      logSecurityEvent('MISSING_AUTH_TOKEN', {}, request)
      return {
        success: false,
        response: NextResponse.json(
          { error: 'Authentication token required' },
          { status: 401 }
        )
      }
    }
    
    const payload = await verifyToken(token)
    
    if (!payload) {
      logSecurityEvent('INVALID_AUTH_TOKEN', { token: token.substring(0, 10) + '...' }, request)
      return {
        success: false,
        response: NextResponse.json(
          { error: 'Invalid authentication token' },
          { status: 401 }
        )
      }
    }
    
    return { success: true, user: payload }
  } catch (error) {
    logSecurityEvent('AUTH_ERROR', { error: error instanceof Error ? error.message : 'Unknown error' }, request)
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      )
    }
  }
}

// Authorization middleware
export function authorizeRequest(user: JWTPayload, requiredPermissions: string[]): { success: boolean; response?: NextResponse } {
  const userPermissions = getUserPermissions(user.role)
  
  const hasPermission = requiredPermissions.every(permission => 
    userPermissions.includes(permission)
  )
  
  if (!hasPermission) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }
  }
  
  return { success: true }
}

// Get user permissions based on role
function getUserPermissions(role: string): string[] {
  const permissions = {
    normal: ["VIEW_MAP", "VIEW_SERVICE_LIST", "VIEW_FILTERS"],
    editor: [
      "VIEW_MAP",
      "VIEW_SERVICE_LIST",
      "VIEW_FILTERS",
      "ADD_ADDRESS",
      "EDIT_ADDRESS",
      "VIEW_CATEGORY_MANAGEMENT",
      "MANAGE_API_KEYS",
      "VIEW_LOGS"
      // Editor artık DELETE_ADDRESS ve MANAGE_CATEGORIES yetkilerine sahip değil
    ],
    admin: [
      "VIEW_MAP",
      "VIEW_SERVICE_LIST", 
      "VIEW_FILTERS",
      "ADD_ADDRESS",
      "EDIT_ADDRESS",
      "DELETE_ADDRESS",
      "MANAGE_CATEGORIES",
      "VIEW_CATEGORY_MANAGEMENT",
      "MANAGE_API_KEYS",
      "VIEW_LOGS",
      "MANAGE_USERS",
      "SYSTEM_CONTROL"
    ]
  }

  return permissions[role as keyof typeof permissions] || []
}

// Rate limiting middleware
export function applyRateLimit(request: NextRequest): { success: boolean; response?: NextResponse } {
  const rateLimiter = rateLimit({ windowMs: 60000, maxRequests: 100 }) // 100 requests per minute
  const result = rateLimiter(request)
  
  if (!result.success) {
    logSecurityEvent('RATE_LIMIT_EXCEEDED', {
      resetTime: new Date(result.resetTime).toISOString()
    }, request)
    
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { 
          status: 429,
          headers: {
            'Retry-After': Math.ceil((result.resetTime - Date.now()) / 1000).toString(),
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(result.resetTime).toISOString()
          }
        }
      )
    }
  }
  
  return { success: true }
}

// Security headers middleware
export function applySecurityHeaders(response: NextResponse): NextResponse {
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  
  return response
}

// Combined security middleware
export async function applySecurityMiddleware(
  request: NextRequest, 
  options: {
    requireAuth?: boolean
    requiredPermissions?: string[]
    applyRateLimit?: boolean
  } = {}
): Promise<{ success: boolean; user?: JWTPayload; response?: NextResponse }> {
  
  // Apply rate limiting
  if (options.applyRateLimit !== false) {
    const rateLimitResult = applyRateLimit(request)
    if (!rateLimitResult.success) {
      return rateLimitResult
    }
  }
  
  // Apply authentication
  if (options.requireAuth) {
    const authResult = await authenticateRequest(request)
    if (!authResult.success) {
      return authResult
    }
    
    // Apply authorization
    if (options.requiredPermissions && authResult.user) {
      const authzResult = authorizeRequest(authResult.user, options.requiredPermissions)
      if (!authzResult.success) {
        return authzResult
      }
    }
    
    return { success: true, user: authResult.user }
  }
  
  return { success: true }
} 