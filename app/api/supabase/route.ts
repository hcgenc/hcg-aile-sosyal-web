import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import type { Database } from '@/types/supabase'
import { applySecurityMiddleware, applySecurityHeaders } from '@/lib/middleware'
import { sanitizeString, sanitizeSQL, logSecurityEvent, validateTableName, rateLimit } from '@/lib/security'

// Server-side Supabase client (gizli credentials ile)
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

// Sanitize input data
function sanitizeData(data: any): any {
  if (typeof data === 'string') {
    return sanitizeString(data)
  }
  
  if (Array.isArray(data)) {
    return data.map(sanitizeData)
  }
  
  if (data && typeof data === 'object') {
    const sanitized: any = {}
    for (const [key, value] of Object.entries(data)) {
      sanitized[sanitizeString(key)] = sanitizeData(value)
    }
    return sanitized
  }
  
  return data
}

export async function POST(request: NextRequest) {
  try {
    // Apply general rate limiting for API requests (100/min)
    const rateLimitResult = rateLimit({ windowMs: 60000, maxRequests: 100 })(request)
    if (!rateLimitResult.success) {
      logSecurityEvent('API_RATE_LIMIT_EXCEEDED', {
        remaining: rateLimitResult.remaining,
        resetTime: new Date(rateLimitResult.resetTime).toISOString()
      }, request)
      
      const response = NextResponse.json(
        { error: 'Rate limit exceeded. Please slow down.' },
        { 
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString()
          }
        }
      )
      return applySecurityHeaders(response)
    }

    // Parse request first to determine if authentication is needed
    let requestData
    try {
      requestData = await request.json()
    } catch (error) {
      logSecurityEvent('INVALID_API_JSON', {}, request)
      const response = NextResponse.json(
        { error: 'Invalid JSON payload' }, 
        { status: 400 }
      )
      return applySecurityHeaders(response)
    }

    const { table, method } = requestData

    // Enhanced table validation
    if (!table || typeof table !== 'string') {
      logSecurityEvent('MISSING_TABLE_PARAMETER', { table }, request)
      const response = NextResponse.json(
        { error: 'Table parameter is required and must be a string' }, 
        { status: 400 }
      )
      return applySecurityHeaders(response)
    }

    // Validate table name using enhanced validation
    if (!validateTableName(table)) {
      logSecurityEvent('INVALID_TABLE_NAME', { table }, request)
      const response = NextResponse.json(
        { error: 'Invalid table name. Access denied.' }, 
        { status: 400 }
      )
      return applySecurityHeaders(response)
    }

    // Sanitize table name after validation
    let sanitizedTable: string
    try {
      sanitizedTable = sanitizeSQL(table)
    } catch (error) {
      logSecurityEvent('MALICIOUS_TABLE_INPUT', { table }, request)
      const response = NextResponse.json(
        { error: 'Potentially malicious input detected in table name' }, 
        { status: 400 }
      )
      return applySecurityHeaders(response)
    }

    // Define public tables that don't require authentication for reading
    const publicReadTables = ['addresses', 'main_categories', 'sub_categories']
    const isPublicRead = publicReadTables.includes(sanitizedTable) && method?.toUpperCase() === 'SELECT'

    // Apply security middleware - conditional authentication
    const securityResult = await applySecurityMiddleware(request, {
      requireAuth: !isPublicRead, // Public read operations don't require auth
      applyRateLimit: false // Already applied above
    })
    
    if (!securityResult.success && securityResult.response) {
      return applySecurityHeaders(securityResult.response)
    }
    
    const { 
      data, 
      filter, 
      select, 
      orderBy, 
      limit,
      single 
    } = requestData
    
    if (!method) {
      logSecurityEvent('MISSING_METHOD_PARAMETER', { table: sanitizedTable }, request)
      const response = NextResponse.json(
        { error: 'Method parameter is required' }, 
        { status: 400 }
      )
      return applySecurityHeaders(response)
    }
    
    const supabase = createServerSupabaseClient()
    
    let query: any = supabase.from(sanitizedTable)
    
    switch (method.toUpperCase()) {
      case 'SELECT':
        // Sanitize select parameter
        let sanitizedSelect = '*'
        if (select && typeof select === 'string') {
          try {
            sanitizedSelect = sanitizeSQL(select)
          } catch (error) {
            logSecurityEvent('MALICIOUS_SELECT_INPUT', { select, table: sanitizedTable }, request)
            const response = NextResponse.json(
              { error: 'Potentially malicious input detected in select clause' }, 
              { status: 400 }
            )
            return applySecurityHeaders(response)
          }
        }
        
        query = query.select(sanitizedSelect)
        
        // Apply filters
        if (filter) {
          Object.keys(filter).forEach(key => {
            let sanitizedKey: string
            try {
              sanitizedKey = sanitizeSQL(key)
            } catch (error) {
              logSecurityEvent('MALICIOUS_FILTER_KEY', { key, table: sanitizedTable }, request)
              throw new Error('Potentially malicious input detected in filter key')
            }
            
            const value = filter[key]
            if (value !== undefined && value !== null) {
              if (typeof value === 'object' && value.operator) {
                // Advanced filtering: { operator: 'ilike', value: '%search%' }
                const sanitizedValue = sanitizeData(value.value)
                switch (value.operator) {
                  case 'ilike':
                    query = query.ilike(sanitizedKey, sanitizedValue)
                    break
                  case 'gt':
                    query = query.gt(sanitizedKey, sanitizedValue)
                    break
                  case 'lt':
                    query = query.lt(sanitizedKey, sanitizedValue)
                    break
                  case 'gte':
                    query = query.gte(sanitizedKey, sanitizedValue)
                    break
                  case 'lte':
                    query = query.lte(sanitizedKey, sanitizedValue)
                    break
                  case 'in':
                    query = query.in(sanitizedKey, sanitizedValue)
                    break
                  default:
                    query = query.eq(sanitizedKey, sanitizedValue)
                }
              } else {
                // Simple equality filter
                query = query.eq(sanitizedKey, sanitizeData(value))
              }
            }
          })
        }
        
        // Apply ordering
        if (orderBy) {
          if (Array.isArray(orderBy)) {
            orderBy.forEach(order => {
              try {
                const sanitizedColumn = sanitizeSQL(order.column)
                query = query.order(sanitizedColumn, { ascending: order.ascending ?? true })
              } catch (error) {
                logSecurityEvent('MALICIOUS_ORDER_COLUMN', { column: order.column, table: sanitizedTable }, request)
                throw new Error('Potentially malicious input detected in order column')
              }
            })
          } else {
            try {
              const sanitizedColumn = sanitizeSQL(orderBy.column)
              query = query.order(sanitizedColumn, { ascending: orderBy.ascending ?? true })
            } catch (error) {
              logSecurityEvent('MALICIOUS_ORDER_COLUMN', { column: orderBy.column, table: sanitizedTable }, request)
              throw new Error('Potentially malicious input detected in order column')
            }
          }
        }
        
        // Apply limit (max 1000 records for security)
        if (limit) {
          const sanitizedLimit = Math.min(Math.max(parseInt(limit), 1), 1000)
          query = query.limit(sanitizedLimit)
        }
        
        // Single result
        if (single) {
          query = query.single()
        }
        
        break
        
      case 'INSERT':
        if (!data) {
          const response = NextResponse.json(
            { error: 'Data is required for INSERT' }, 
            { status: 400 }
          )
          return applySecurityHeaders(response)
        }
        
        // Sanitize data
        const sanitizedInsertData = sanitizeData(data)
        query = query.insert(sanitizedInsertData)
        
        if (select) {
          try {
            const sanitizedSelect = sanitizeSQL(select)
            query = query.select(sanitizedSelect)
          } catch (error) {
            logSecurityEvent('MALICIOUS_INSERT_SELECT', { select, table: sanitizedTable }, request)
            const response = NextResponse.json(
              { error: 'Potentially malicious input detected in select clause' }, 
              { status: 400 }
            )
            return applySecurityHeaders(response)
          }
        }
        break
        
      case 'UPDATE':
        if (!data) {
          const response = NextResponse.json(
            { error: 'Data is required for UPDATE' }, 
            { status: 400 }
          )
          return applySecurityHeaders(response)
        }
        
        // UPDATE işlemi için filter zorunlu (güvenlik)
        if (!filter || Object.keys(filter).length === 0) {
          logSecurityEvent('UPDATE_WITHOUT_FILTER', { table: sanitizedTable }, request)
          const response = NextResponse.json(
            { error: 'Filters are required for UPDATE operations for security' }, 
            { status: 400 }
          )
          return applySecurityHeaders(response)
        }
        
        // Sanitize data
        const sanitizedUpdateData = sanitizeData(data)
        query = query.update(sanitizedUpdateData)
        
        // Apply filters for update
        Object.keys(filter).forEach(key => {
          try {
            const sanitizedKey = sanitizeSQL(key)
            const value = filter[key]
            if (value !== undefined && value !== null) {
              query = query.eq(sanitizedKey, sanitizeData(value))
            }
          } catch (error) {
            logSecurityEvent('MALICIOUS_UPDATE_FILTER', { key, table: sanitizedTable }, request)
            throw new Error('Potentially malicious input detected in update filter')
          }
        })
        
        if (select) {
          try {
            const sanitizedSelect = sanitizeSQL(select)
            query = query.select(sanitizedSelect)
          } catch (error) {
            logSecurityEvent('MALICIOUS_UPDATE_SELECT', { select, table: sanitizedTable }, request)
            throw new Error('Potentially malicious input detected in select clause')
          }
        }
        break
        
      case 'DELETE':
        // DELETE işlemi için filter zorunlu (güvenlik)
        if (!filter || Object.keys(filter).length === 0) {
          logSecurityEvent('DELETE_WITHOUT_FILTER', { table: sanitizedTable }, request)
          const response = NextResponse.json(
            { error: 'Filters are required for DELETE operations for security' }, 
            { status: 400 }
          )
          return applySecurityHeaders(response)
        }
        
        // Apply delete operation first
        query = query.delete()
        
        // Then apply filters
        Object.keys(filter).forEach(key => {
          try {
            const sanitizedKey = sanitizeSQL(key)
            const value = filter[key]
            if (value !== undefined && value !== null) {
              query = query.eq(sanitizedKey, sanitizeData(value))
            }
          } catch (error) {
            logSecurityEvent('MALICIOUS_DELETE_FILTER', { key, table: sanitizedTable }, request)
            throw new Error('Potentially malicious input detected in delete filter')
          }
        })
        
        break
        
      case 'UPSERT':
        if (!data) {
          const response = NextResponse.json(
            { error: 'Data is required for UPSERT' }, 
            { status: 400 }
          )
          return applySecurityHeaders(response)
        }
        
        // Sanitize data
        const sanitizedUpsertData = sanitizeData(data)
        query = query.upsert(sanitizedUpsertData)
        
        if (select) {
          try {
            const sanitizedSelect = sanitizeSQL(select)
            query = query.select(sanitizedSelect)
          } catch (error) {
            logSecurityEvent('MALICIOUS_UPSERT_SELECT', { select, table: sanitizedTable }, request)
            const response = NextResponse.json(
              { error: 'Potentially malicious input detected in select clause' }, 
              { status: 400 }
            )
            return applySecurityHeaders(response)
          }
        }
        break
        
      default:
        logSecurityEvent('INVALID_METHOD', { method }, request)
        const response = NextResponse.json(
          { error: `Invalid method: ${method}` }, 
          { status: 400 }
        )
        return applySecurityHeaders(response)
    }
    
    const result = await query
    
    if (result.error) {
      // Don't expose detailed error information
      logSecurityEvent('SUPABASE_ERROR', { 
        error: result.error.message,
        table: sanitizedTable,
        method 
      }, request)
      
      const response = NextResponse.json(
        { error: 'Database operation failed' }, 
        { status: 400 }
      )
      return applySecurityHeaders(response)
    }
    
    const response = NextResponse.json({ 
      data: result.data, 
      count: result.count,
      status: result.status
    })
    
    return applySecurityHeaders(response)
    
  } catch (error) {
    logSecurityEvent('API_ERROR', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, request)
    
    const response = NextResponse.json(
      { error: error instanceof Error && error.message.includes('malicious') 
          ? error.message 
          : 'Internal server error' }, 
      { status: error instanceof Error && error.message.includes('malicious') ? 400 : 500 }
    )
    return applySecurityHeaders(response)
  }
}

// GET method for simple queries
export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting for GET requests too
    const rateLimitResult = rateLimit({ windowMs: 60000, maxRequests: 100 })(request)
    if (!rateLimitResult.success) {
      logSecurityEvent('API_GET_RATE_LIMIT_EXCEEDED', {
        remaining: rateLimitResult.remaining,
        resetTime: new Date(rateLimitResult.resetTime).toISOString()
      }, request)
      
      const response = NextResponse.json(
        { error: 'Rate limit exceeded. Please slow down.' },
        { 
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString()
          }
        }
      )
      return applySecurityHeaders(response)
    }

    const { searchParams } = new URL(request.url)
    const table = searchParams.get('table')
    
    if (!table) {
      const response = NextResponse.json(
        { error: 'Table parameter is required' }, 
        { status: 400 }
      )
      return applySecurityHeaders(response)
    }

    // Enhanced table validation for GET requests
    if (!validateTableName(table)) {
      logSecurityEvent('INVALID_GET_TABLE_NAME', { table }, request)
      const response = NextResponse.json(
        { error: 'Invalid table name. Access denied.' }, 
        { status: 400 }
      )
      return applySecurityHeaders(response)
    }

    // Sanitize table name
    let sanitizedTable: string
    try {
      sanitizedTable = sanitizeSQL(table)
    } catch (error) {
      logSecurityEvent('MALICIOUS_GET_TABLE_INPUT', { table }, request)
      const response = NextResponse.json(
        { error: 'Potentially malicious input detected in table name' }, 
        { status: 400 }
      )
      return applySecurityHeaders(response)
    }

    // Define public tables that don't require authentication for reading
    const publicReadTables = ['addresses', 'main_categories', 'sub_categories', 'api_keys']
    const isPublicRead = publicReadTables.includes(sanitizedTable)

    // Apply security middleware - conditional authentication
    const securityResult = await applySecurityMiddleware(request, {
      requireAuth: !isPublicRead, // Public read operations don't require auth
      applyRateLimit: false // Already applied above
    })
    
    if (!securityResult.success && securityResult.response) {
      return applySecurityHeaders(securityResult.response)
    }
    
    const select = searchParams.get('select')
    
    const supabase = createServerSupabaseClient()
    let sanitizedSelect = '*'
    
    if (select) {
      try {
        sanitizedSelect = sanitizeSQL(select)
      } catch (error) {
        logSecurityEvent('MALICIOUS_GET_SELECT', { select, table: sanitizedTable }, request)
        const response = NextResponse.json(
          { error: 'Potentially malicious input detected in select clause' }, 
          { status: 400 }
        )
        return applySecurityHeaders(response)
      }
    }
    
    const query = supabase.from(sanitizedTable).select(sanitizedSelect)
    
    const result = await query
    
    if (result.error) {
      logSecurityEvent('SUPABASE_GET_ERROR', { 
        error: result.error.message,
        table: sanitizedTable 
      }, request)
      
      const response = NextResponse.json(
        { error: 'Database query failed' }, 
        { status: 400 }
      )
      return applySecurityHeaders(response)
    }
    
    const response = NextResponse.json({ data: result.data })
    return applySecurityHeaders(response)
    
  } catch (error) {
    logSecurityEvent('API_GET_ERROR', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, request)
    
    const response = NextResponse.json(
      { error: error instanceof Error && error.message.includes('malicious') 
          ? error.message 
          : 'Internal server error' }, 
      { status: error instanceof Error && error.message.includes('malicious') ? 400 : 500 }
    )
    return applySecurityHeaders(response)
  }
} 