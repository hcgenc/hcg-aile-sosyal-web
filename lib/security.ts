import { NextRequest } from 'next/server'

// Rate limiting in-memory store (in production, use Redis)
const requestCounts = new Map<string, { count: number; resetTime: number }>()
const loginAttempts = new Map<string, { count: number; resetTime: number }>()

export interface RateLimitOptions {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Maximum requests per window
}

// Rate limiting function
export function rateLimit(options: RateLimitOptions = { windowMs: 60000, maxRequests: 100 }) {
  return (request: NextRequest): { success: boolean; remaining: number; resetTime: number } => {
    const clientIP = getClientIP(request)
    const now = Date.now()
    const windowStart = Math.floor(now / options.windowMs) * options.windowMs
    const key = `${clientIP}-${windowStart}`
    
    const record = requestCounts.get(key)
    
    if (!record) {
      requestCounts.set(key, { count: 1, resetTime: windowStart + options.windowMs })
      // Clean up old records
      cleanupRateLimit()
      return { success: true, remaining: options.maxRequests - 1, resetTime: windowStart + options.windowMs }
    }
    
    if (record.count >= options.maxRequests) {
      return { success: false, remaining: 0, resetTime: record.resetTime }
    }
    
    record.count++
    requestCounts.set(key, record)
    
    return { success: true, remaining: options.maxRequests - record.count, resetTime: record.resetTime }
  }
}

// Specific rate limiting for login attempts (more strict)
export function loginRateLimit(request: NextRequest): { success: boolean; remaining: number; resetTime: number } {
  const clientIP = getClientIP(request)
  const now = Date.now()
  const windowMs = 60000 // 1 minute window
  const maxAttempts = 5 // Only 5 login attempts per minute
  const windowStart = Math.floor(now / windowMs) * windowMs
  const key = `login-${clientIP}-${windowStart}`
  
  const record = loginAttempts.get(key)
  
  if (!record) {
    loginAttempts.set(key, { count: 1, resetTime: windowStart + windowMs })
    // Clean up old login attempt records
    cleanupLoginAttempts()
    return { success: true, remaining: maxAttempts - 1, resetTime: windowStart + windowMs }
  }
  
  if (record.count >= maxAttempts) {
    return { success: false, remaining: 0, resetTime: record.resetTime }
  }
  
  record.count++
  loginAttempts.set(key, record)
  
  return { success: true, remaining: maxAttempts - record.count, resetTime: record.resetTime }
}

// Clean up old rate limit records (call periodically)
export function cleanupRateLimit() {
  const now = Date.now()
  for (const [key, record] of requestCounts.entries()) {
    if (record.resetTime < now) {
      requestCounts.delete(key)
    }
  }
}

// Clean up old login attempt records
export function cleanupLoginAttempts() {
  const now = Date.now()
  for (const [key, record] of loginAttempts.entries()) {
    if (record.resetTime < now) {
      loginAttempts.delete(key)
    }
  }
}

// Get client IP address
export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const remoteAddr = request.headers.get('remote-addr')
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  if (realIP) {
    return realIP
  }
  
  if (remoteAddr) {
    return remoteAddr
  }
  
  // For localhost development
  return '127.0.0.1'
}

// Enhanced XSS detection patterns
const XSS_PATTERNS = [
  /<script[^>]*>.*?<\/script>/gi,
  /<iframe[^>]*>.*?<\/iframe>/gi,
  /javascript:/gi,
  /vbscript:/gi,
  /on\w+\s*=/gi, // onload=, onclick=, etc.
  /<embed[^>]*>/gi,
  /<object[^>]*>/gi,
  /<link[^>]*>/gi,
  /<meta[^>]*>/gi,
  /expression\s*\(/gi,
  /url\s*\(/gi,
  /@import/gi,
  /&\w+;/g // HTML entities
]

// Enhanced input sanitization with XSS detection
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return ''
  
  // Check for XSS patterns
  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(input)) {
      throw new Error('Potentially malicious input detected')
    }
  }
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove < and > to prevent basic XSS
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .slice(0, 1000) // Limit length
}

// Enhanced SQL injection prevention
export function sanitizeSQL(input: string): string {
  if (typeof input !== 'string') return ''
  
  // Common SQL injection patterns
  const SQL_INJECTION_PATTERNS = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|OR|AND)\b)/gi,
    /[';]/g, // Semicolons and quotes
    /--/g, // SQL comments
    /\/\*/g, // Multi-line comments start
    /\*\//g, // Multi-line comments end
    /\bxp_/gi, // Extended stored procedures
    /\bsp_/gi, // Stored procedures
    /\b(SCRIPT|DECLARE|CAST|CONVERT)\b/gi
  ]
  
  let sanitized = input.trim()
  
  // Check for SQL injection patterns
  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      throw new Error('Potentially malicious SQL input detected')
    }
  }
  
  // Additional cleaning
  sanitized = sanitized
    .replace(/[';]/g, '') // Remove quotes and semicolons
    .replace(/--/g, '') // Remove SQL comment sequences
    .replace(/(\bDROP\b|\bDELETE\b|\bTRUNCATE\b|\bINSERT\b|\bUPDATE\b)/gi, '') // Remove dangerous SQL keywords
    
  return sanitized
}

// Validate table name against whitelist
export function validateTableName(tableName: string): boolean {
  const allowedTables = ['addresses', 'main_categories', 'sub_categories', 'users', 'logs', 'api_keys']
  
  if (typeof tableName !== 'string') {
    return false
  }
  
  // Check for path traversal
  if (tableName.includes('/') || tableName.includes('\\') || tableName.includes('..')) {
    return false
  }
  
  // Check if it's in the whitelist
  return allowedTables.includes(tableName.toLowerCase().trim())
}

// Validate email format
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// Validate password strength
export function isStrongPassword(password: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (password.length < 8) {
    errors.push('Şifre en az 8 karakter olmalıdır')
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Şifre en az bir büyük harf içermelidir')
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Şifre en az bir küçük harf içermelidir')
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Şifre en az bir rakam içermelidir')
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Şifre en az bir özel karakter içermelidir')
  }
  
  return { isValid: errors.length === 0, errors }
}

// Generate CSRF token
export function generateCSRFToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

// Security headers (updated CSP for Yandex Maps)
export const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' *.yandex.com *.yandex.net *.yandex.ru *.yandex.com.tr api-maps.yandex.ru yastatic.net *.yastatic.net; style-src 'self' 'unsafe-inline' *.yandex.com *.yandex.net; img-src 'self' data: blob: *.yandex.com *.yandex.net *.yandex.ru; connect-src 'self' *.supabase.co *.yandex.com *.yandex.net *.yandex.ru *.yandex.com.tr api-maps.yandex.ru; frame-src 'none'; object-src 'none';",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
}

// Log security events
export function logSecurityEvent(event: string, details: any, request: NextRequest) {
  const timestamp = new Date().toISOString()
  const clientIP = getClientIP(request)
  const userAgent = request.headers.get('user-agent') || 'unknown'
  
  console.warn(`[SECURITY] ${timestamp} - ${event}`, {
    clientIP,
    userAgent,
    details,
    url: request.url
  })
} 