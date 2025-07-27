export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      addresses: {
        Row: {
          id: string
          first_name: string
          last_name: string
          province: string
          district: string
          neighborhood: string
          address: string
          latitude: number
          longitude: number
          main_category_id: string
          sub_category_id: string
          created_at: string
        }
        Insert: {
          id?: string
          first_name: string
          last_name: string
          province: string
          district: string
          neighborhood: string
          address: string
          latitude: number
          longitude: number
          main_category_id: string
          sub_category_id: string
          created_at?: string
        }
        Update: {
          id?: string
          first_name?: string
          last_name?: string
          province?: string
          district?: string
          neighborhood?: string
          address?: string
          latitude?: number
          longitude?: number
          main_category_id?: string
          sub_category_id?: string
          created_at?: string
        }
      }
      main_categories: {
        Row: {
          id: string
          name: string
          color: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          color: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          color?: string
          created_at?: string
        }
      }
      sub_categories: {
        Row: {
          id: string
          name: string
          main_category_id: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          main_category_id: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          main_category_id?: string
          created_at?: string
        }
      }
      api_keys: {
        Row: {
          id: string
          service_name: string
          api_key: string
          description: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          service_name: string
          api_key: string
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          service_name?: string
          api_key?: string
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      users: {
        Row: {
          id: string
          username: string
          password: string
          role: string
          full_name: string | null
          city: string | null
          created_at: string
          last_login: string | null
        }
        Insert: {
          id?: string
          username: string
          password: string
          role?: string
          full_name?: string | null
          city?: string | null
          created_at?: string
          last_login?: string | null
        }
        Update: {
          id?: string
          username?: string
          password?: string
          role?: string
          full_name?: string | null
          city?: string | null
          created_at?: string
          last_login?: string | null
        }
      }
      logs: {
        Row: {
          id: string
          user_id: string
          username: string
          action: string
          details: string | null
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          username: string
          action: string
          details?: string | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          username?: string
          action?: string
          details?: string | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
      }
    }
  }
}
