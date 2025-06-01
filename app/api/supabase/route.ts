import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import type { Database } from '@/types/supabase'

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

export async function POST(request: NextRequest) {
  try {
    const { 
      table, 
      method, 
      data, 
      filter, 
      select, 
      orderBy, 
      limit,
      single 
    } = await request.json()
    
    if (!table || !method) {
      return NextResponse.json(
        { error: 'Table and method are required' }, 
        { status: 400 }
      )
    }
    
    const supabase = createServerSupabaseClient()
    
    let query: any = supabase.from(table)
    
    switch (method.toUpperCase()) {
      case 'SELECT':
        query = query.select(select || '*')
        
        // Apply filters
        if (filter) {
          Object.keys(filter).forEach(key => {
            const value = filter[key]
            if (value !== undefined && value !== null) {
              if (typeof value === 'object' && value.operator) {
                // Advanced filtering: { operator: 'ilike', value: '%search%' }
                switch (value.operator) {
                  case 'ilike':
                    query = query.ilike(key, value.value)
                    break
                  case 'gt':
                    query = query.gt(key, value.value)
                    break
                  case 'lt':
                    query = query.lt(key, value.value)
                    break
                  case 'gte':
                    query = query.gte(key, value.value)
                    break
                  case 'lte':
                    query = query.lte(key, value.value)
                    break
                  case 'in':
                    query = query.in(key, value.value)
                    break
                  default:
                    query = query.eq(key, value.value)
                }
              } else {
                // Simple equality filter
                query = query.eq(key, value)
              }
            }
          })
        }
        
        // Apply ordering
        if (orderBy) {
          if (Array.isArray(orderBy)) {
            orderBy.forEach(order => {
              query = query.order(order.column, { ascending: order.ascending ?? true })
            })
          } else {
            query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true })
          }
        }
        
        // Apply limit
        if (limit) {
          query = query.limit(limit)
        }
        
        // Single result
        if (single) {
          query = query.single()
        }
        
        break
        
      case 'INSERT':
        if (!data) {
          return NextResponse.json(
            { error: 'Data is required for INSERT' }, 
            { status: 400 }
          )
        }
        query = query.insert(data)
        if (select) {
          query = query.select(select)
        }
        break
        
      case 'UPDATE':
        if (!data) {
          return NextResponse.json(
            { error: 'Data is required for UPDATE' }, 
            { status: 400 }
          )
        }
        
        // UPDATE işlemi için filter zorunlu (güvenlik)
        if (!filter || Object.keys(filter).length === 0) {
          return NextResponse.json(
            { error: 'Filters are required for UPDATE operations for security' }, 
            { status: 400 }
          )
        }
        
        query = query.update(data)
        
        // Apply filters for update
        Object.keys(filter).forEach(key => {
          const value = filter[key]
          if (value !== undefined && value !== null) {
            query = query.eq(key, value)
          }
        })
        
        if (select) {
          query = query.select(select)
        }
        break
        
      case 'DELETE':
        // DELETE işlemi için filter zorunlu (güvenlik)
        if (!filter || Object.keys(filter).length === 0) {
          return NextResponse.json(
            { error: 'Filters are required for DELETE operations for security' }, 
            { status: 400 }
          )
        }
        
        // Apply delete operation first
        query = query.delete()
        
        // Then apply filters
        Object.keys(filter).forEach(key => {
          const value = filter[key]
          if (value !== undefined && value !== null) {
            query = query.eq(key, value)
          }
        })
        
        break
        
      case 'UPSERT':
        if (!data) {
          return NextResponse.json(
            { error: 'Data is required for UPSERT' }, 
            { status: 400 }
          )
        }
        query = query.upsert(data)
        if (select) {
          query = query.select(select)
        }
        break
        
      default:
        return NextResponse.json(
          { error: `Invalid method: ${method}` }, 
          { status: 400 }
        )
    }
    
    const result = await query
    
    if (result.error) {
      return NextResponse.json(
        { error: result.error.message, details: result.error }, 
        { status: 400 }
      )
    }
    
    return NextResponse.json({ 
      data: result.data, 
      count: result.count,
      status: result.status
    })
    
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' }, 
      { status: 500 }
    )
  }
}

// GET method for simple queries
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const table = searchParams.get('table')
    const select = searchParams.get('select')
    
    if (!table) {
      return NextResponse.json(
        { error: 'Table parameter is required' }, 
        { status: 400 }
      )
    }
    
    const supabase = createServerSupabaseClient()
    const query = supabase.from(table).select(select || '*')
    
    const result = await query
    
    if (result.error) {
      return NextResponse.json(
        { error: result.error.message }, 
        { status: 400 }
      )
    }
    
    return NextResponse.json({ data: result.data })
    
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
} 