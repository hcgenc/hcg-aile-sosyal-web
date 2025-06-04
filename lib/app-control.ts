// APP CONTROL SYSTEM
// Uygulamanın admin tarafından anlık kontrol edilmesi için

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Supabase client (server-side)
const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// App status cache (performance için)
let appStatusCache: {
  isActive: boolean
  lastChecked: number
  reason?: string
} = {
  isActive: true,
  lastChecked: 0
}

const CACHE_DURATION = 10000 // 10 saniye cache (daha uzun)

export interface AppStatus {
  isActive: boolean
  reason?: string
  updatedAt?: string
  updatedBy?: string
}

// App status kontrol fonksiyonu
export async function checkAppStatus(): Promise<AppStatus> {
  const now = Date.now()
  
  // Cache geçerli mi kontrol et
  if (now - appStatusCache.lastChecked < CACHE_DURATION) {
    return {
      isActive: appStatusCache.isActive,
      reason: appStatusCache.reason
    }
  }

  try {
    // Supabase'den son status'u al
    const { data, error } = await supabase
      .from('app_is_active')
      .select('active, reason, updated_at, updated_by')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      console.error('App status check error:', error)
      
      // Cache varsa ve çok eski değilse onu kullan
      if (appStatusCache.lastChecked > 0 && (now - appStatusCache.lastChecked) < 60000) {
        console.log('Using cached app status due to database error')
        return {
          isActive: appStatusCache.isActive,
          reason: appStatusCache.reason
        }
      }
      
      // Hata durumunda güvenli tarafta kal (aktif olarak devam et)
      return { isActive: true, reason: 'Status check failed - defaulting to active' }
    }

    // Cache'i güncelle
    appStatusCache = {
      isActive: data.active,
      lastChecked: now,
      reason: data.reason
    }

    return {
      isActive: data.active,
      reason: data.reason,
      updatedAt: data.updated_at,
      updatedBy: data.updated_by
    }

  } catch (error) {
    console.error('App status check exception:', error)
    
    // Cache varsa ve çok eski değilse onu kullan
    if (appStatusCache.lastChecked > 0 && (now - appStatusCache.lastChecked) < 60000) {
      console.log('Using cached app status due to exception')
      return {
        isActive: appStatusCache.isActive,
        reason: appStatusCache.reason
      }
    }
    
    return { isActive: true, reason: 'Exception occurred - defaulting to active' }
  }
}

// App status güncelleme fonksiyonu (admin only)
export async function updateAppStatus(
  newStatus: boolean, 
  reason: string = '',
  adminUsername: string
): Promise<{ success: boolean, message: string }> {
  
  try {
    // Admin kontrolü
    const { data: adminUser, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('username', adminUsername)
      .single()

    if (userError || adminUser?.role !== 'editor') {
      return {
        success: false,
        message: 'Access denied: Only editors can change app status'
      }
    }

    // Status güncelle
    const { error } = await supabase
      .from('app_is_active')
      .update({
        active: newStatus,
        reason: reason || `Status changed to ${newStatus ? 'active' : 'inactive'} by ${adminUsername}`,
        updated_by: adminUsername,
        updated_at: new Date().toISOString()
      })
      .eq('id', (await supabase
        .from('app_is_active')
        .select('id')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()
      ).data?.id)

    if (error) {
      return {
        success: false,
        message: `Failed to update app status: ${error.message}`
      }
    }

    // Cache'i temizle
    appStatusCache.lastChecked = 0

    return {
      success: true,
      message: `App status updated to ${newStatus ? 'ACTIVE' : 'INACTIVE'}`
    }

  } catch (error) {
    return {
      success: false,
      message: `Exception updating app status: ${error}`
    }
  }
}

// Middleware fonksiyonu
export async function appControlMiddleware(request: NextRequest): Promise<NextResponse | null> {
  
  // API routes için kontrol et
  if (request.nextUrl.pathname.startsWith('/api/')) {
    
    // App control endpoint'ini hariç tut (admin kontrol için gerekli)
    if (request.nextUrl.pathname === '/api/app-control') {
      return null // Middleware'i pas geç
    }

    // App status kontrol et
    const status = await checkAppStatus()
    
    if (!status.isActive) {
      return NextResponse.json(
        {
          error: 'Application is currently inactive',
          reason: status.reason || 'Maintenance mode active',
          code: 'APP_INACTIVE',
          timestamp: new Date().toISOString()
        },
        { 
          status: 503, // Service Unavailable
          headers: {
            'Retry-After': '300', // 5 dakika sonra tekrar dene
            'X-App-Status': 'inactive'
          }
        }
      )
    }
  }

  return null // Middleware'i pas geç
}

// Realtime subscription için hook
export class AppStatusMonitor {
  private subscription: any = null
  private callbacks: Array<(status: boolean) => void> = []

  constructor() {
    this.setupRealtimeSubscription()
  }

  private setupRealtimeSubscription() {
    this.subscription = supabase
      .channel('app-status-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'app_is_active'
        },
        (payload) => {
          console.log('App status changed:', payload.new)
          
          // Cache'i güncelle
          appStatusCache = {
            isActive: payload.new.active,
            lastChecked: Date.now(),
            reason: payload.new.reason
          }

          // Callbacks'leri çağır
          this.callbacks.forEach(callback => {
            try {
              callback(payload.new.active)
            } catch (error) {
              console.error('App status callback error:', error)
            }
          })
        }
      )
      .subscribe()
  }

  // Status değişikliği için callback ekle
  onStatusChange(callback: (isActive: boolean) => void) {
    this.callbacks.push(callback)
  }

  // Subscription'ı temizle
  cleanup() {
    if (this.subscription) {
      supabase.removeChannel(this.subscription)
      this.subscription = null
    }
    this.callbacks = []
  }
}

// Singleton instance
export const appStatusMonitor = new AppStatusMonitor()

// Cache temizleme fonksiyonu
export function clearAppStatusCache() {
  appStatusCache.lastChecked = 0
} 