import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcrypt'
import { generateToken } from '@/lib/auth'
import { applySecurityHeaders } from '@/lib/middleware'
import { loginRateLimit, logSecurityEvent, sanitizeString } from '@/lib/security'
import type { Database } from '@/types/supabase'

// Server-side Supabase client (with secret credentials)
function createServerSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase server environment variables')
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// Enhanced XSS detection for credentials
function validateCredentials(username: string, password: string): { isValid: boolean; error?: string } {
  // Check data types
  if (typeof username !== 'string' || typeof password !== 'string') {
    return { isValid: false, error: 'Invalid credential format' }
  }

  // Check for empty values
  if (!username.trim() || !password.trim()) {
    return { isValid: false, error: 'Username and password are required' }
  }

  // Enhanced XSS patterns check
  const XSS_PATTERNS = [
    /<script[^>]*>.*?<\/script>/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /on\w+\s*=/gi, // onload=, onclick=, etc.
    /<[^>]*>/g, // Any HTML tags
    /&\w+;/g // HTML entities
  ]

  const testString = username + password
  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(testString)) {
      return { isValid: false, error: 'Invalid characters detected' }
    }
  }

  return { isValid: true }
}

export async function POST(request: NextRequest) {
  try {
    // Apply login-specific rate limiting (5 attempts per minute)
    const rateLimitResult = loginRateLimit(request)
    if (!rateLimitResult.success) {
      logSecurityEvent('LOGIN_RATE_LIMIT_EXCEEDED', {
        remaining: rateLimitResult.remaining,
        resetTime: new Date(rateLimitResult.resetTime).toISOString()
      }, request)
      
      const response = NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        { 
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
            'X-RateLimit-Limit': '5',
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString()
          }
        }
      )
      return applySecurityHeaders(response)
    }

    // Parse and validate JSON
    let requestData
    try {
      requestData = await request.json()
    } catch (error) {
      logSecurityEvent('INVALID_LOGIN_JSON', {}, request)
      const response = NextResponse.json(
        { error: 'Invalid request format' }, 
        { status: 400 }
      )
      return applySecurityHeaders(response)
    }

    const { username, password } = requestData

    // Validate credentials format and detect XSS
    const validation = validateCredentials(username, password)
    if (!validation.isValid) {
      logSecurityEvent('INVALID_LOGIN_CREDENTIALS', { 
        error: validation.error,
        username: typeof username === 'string' ? username.substring(0, 10) : 'invalid-type'
      }, request)
      
      const response = NextResponse.json(
        { error: validation.error || 'Invalid credentials' }, 
        { status: 400 }
      )
      return applySecurityHeaders(response)
    }

    // Sanitize inputs (but keep password as is for bcrypt comparison)
    const sanitizedUsername = sanitizeString(username)
    // Don't sanitize password - bcrypt needs the original password
    
    const supabase = createServerSupabaseClient()
    
    // Query user from database
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, password, role, full_name')
      .eq('username', sanitizedUsername)
      .single()

    if (error || !user) {
      // Log failed login attempt
      logSecurityEvent('FAILED_LOGIN_ATTEMPT', { 
        username: sanitizedUsername,
        reason: 'user_not_found'
      }, request)
      
      const response = NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      )
      return applySecurityHeaders(response)
    }

    // Verify password (use original password, not sanitized)
    const isValidPassword = await bcrypt.compare(password, user.password)
    
    if (!isValidPassword) {
      // Log failed login attempt
      logSecurityEvent('FAILED_LOGIN_ATTEMPT', { 
        username: sanitizedUsername,
        reason: 'invalid_password'
      }, request)
      
      const response = NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      )
      return applySecurityHeaders(response)
    }

    // Generate JWT token
    const token = await generateToken({
      userId: user.id,
      username: user.username,
      role: user.role
    })

    // Log successful login
    logSecurityEvent('SUCCESSFUL_LOGIN', { 
      userId: user.id,
      username: user.username,
      role: user.role
    }, request)

    const response = NextResponse.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.full_name || user.username
      }
    })
    
    return applySecurityHeaders(response)

  } catch (error) {
    logSecurityEvent('LOGIN_ERROR', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, request)
    
    const response = NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
    return applySecurityHeaders(response)
  }
} 