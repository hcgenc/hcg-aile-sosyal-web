export interface SupabaseFilter {
  [key: string]: any | {
    operator: 'ilike' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'eq'
    value: any
  }
}

export interface SupabaseOrderBy {
  column: string
  ascending?: boolean
}

export interface SupabaseOptions {
  select?: string
  filter?: SupabaseFilter
  orderBy?: SupabaseOrderBy | SupabaseOrderBy[]
  limit?: number
  single?: boolean
}

export interface SupabaseResponse<T = any> {
  data: T | null
  error?: {
    message: string
    details?: any
  }
  count?: number
  status?: number
}

class SupabaseProxy {
  private apiUrl = '/api/supabase'

  private async makeRequest(payload: any): Promise<SupabaseResponse> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (!response.ok) {
        return {
          data: null,
          error: {
            message: result.error || 'Request failed',
            details: result.details
          }
        }
      }

      return result
    } catch (error) {
      return {
        data: null,
        error: {
          message: error instanceof Error ? error.message : 'Network error',
          details: error
        }
      }
    }
  }

  // SELECT operations
  async select<T = any>(table: string, options: SupabaseOptions = {}): Promise<SupabaseResponse<T[]>> {
    return this.makeRequest({
      table,
      method: 'SELECT',
      ...options
    })
  }

  async selectSingle<T = any>(table: string, options: Omit<SupabaseOptions, 'single'> = {}): Promise<SupabaseResponse<T>> {
    return this.makeRequest({
      table,
      method: 'SELECT',
      single: true,
      ...options
    })
  }

  // INSERT operations
  async insert<T = any>(table: string, data: any | any[], select?: string): Promise<SupabaseResponse<T>> {
    return this.makeRequest({
      table,
      method: 'INSERT',
      data,
      select
    })
  }

  // UPDATE operations
  async update<T = any>(
    table: string, 
    data: any, 
    filter: SupabaseFilter, 
    select?: string
  ): Promise<SupabaseResponse<T>> {
    return this.makeRequest({
      table,
      method: 'UPDATE',
      data,
      filter,
      select
    })
  }

  // DELETE operations
  async delete(table: string, filter: SupabaseFilter): Promise<SupabaseResponse> {
    return this.makeRequest({
      table,
      method: 'DELETE',
      filter
    })
  }

  // UPSERT operations
  async upsert<T = any>(table: string, data: any | any[], select?: string): Promise<SupabaseResponse<T>> {
    return this.makeRequest({
      table,
      method: 'UPSERT',
      data,
      select
    })
  }

  // Helper methods that mimic Supabase client API
  from(table: string) {
    return {
      select: (select: string = '*') => ({
        eq: (column: string, value: any) => this.select(table, {
          select,
          filter: { [column]: value }
        }),
        
        ilike: (column: string, pattern: string) => this.select(table, {
          select,
          filter: { [column]: { operator: 'ilike' as const, value: pattern } }
        }),
        
        in: (column: string, values: any[]) => this.select(table, {
          select,
          filter: { [column]: { operator: 'in' as const, value: values } }
        }),
        
        order: (column: string, options: { ascending?: boolean } = {}) => ({
          limit: (count: number) => this.select(table, {
            select,
            orderBy: { column, ascending: options.ascending ?? true },
            limit: count
          }),
          
          then: (callback: (result: SupabaseResponse) => void) => {
            this.select(table, {
              select,
              orderBy: { column, ascending: options.ascending ?? true }
            }).then(callback)
          }
        }),
        
        limit: (count: number) => this.select(table, { select, limit: count }),
        
        single: () => this.selectSingle(table, { select }),
        
        then: (callback: (result: SupabaseResponse) => void) => {
          this.select(table, { select }).then(callback)
        }
      }),
      
      insert: (data: any | any[]) => ({
        select: (select?: string) => this.insert(table, data, select),
        then: (callback: (result: SupabaseResponse) => void) => {
          this.insert(table, data).then(callback)
        }
      }),
      
      update: (data: any) => ({
        eq: (column: string, value: any) => ({
          select: (select?: string) => this.update(table, data, { [column]: value }, select),
          then: (callback: (result: SupabaseResponse) => void) => {
            this.update(table, data, { [column]: value }).then(callback)
          }
        })
      }),
      
      delete: () => ({
        eq: (column: string, value: any) => this.delete(table, { [column]: value })
      }),
      
      upsert: (data: any | any[]) => ({
        select: (select?: string) => this.upsert(table, data, select),
        then: (callback: (result: SupabaseResponse) => void) => {
          this.upsert(table, data).then(callback)
        }
      })
    }
  }
}

// Export singleton instance
export const supabaseProxy = new SupabaseProxy()

// Export class for custom instances if needed
export { SupabaseProxy } 