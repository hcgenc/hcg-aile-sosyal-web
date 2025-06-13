import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { applySecurityHeaders } from '@/lib/middleware'
import { logSecurityEvent } from '@/lib/security'
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

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'Kullanıcı ID gerekli' },
        { status: 400 }
      )
    }

    const supabase = createServerSupabaseClient()
    
    // Kullanıcının admin olduğunu doğrula
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, username, role')
      .eq('id', userId)
      .eq('role', 'admin')
      .single()

    if (userError || !user) {
      logSecurityEvent('UNAUTHORIZED_DELETE_ALL_ATTEMPT', { 
        userId: userId,
        reason: 'not_admin_or_not_found'
      }, request)
      
      return NextResponse.json(
        { error: 'Yetkisiz erişim' },
        { status: 403 }
      )
    }

    // Önce toplam kayıt sayısını al
    const { count: totalCount, error: countError } = await supabase
      .from('addresses')
      .select('*', { count: 'exact', head: true })

    if (countError) {
      throw countError
    }

    // Tüm adresleri sil - admin yetkisi ile
    const { error: deleteError } = await supabase
      .from('addresses')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Dummy condition to delete all

    if (deleteError) {
      throw deleteError
    }

    // Log the admin action
    logSecurityEvent('ADMIN_DELETE_ALL_ADDRESSES', { 
      adminUserId: userId,
      adminUsername: user.username,
      deletedCount: totalCount || 0,
      action: 'delete_all_addresses'
    }, request)

    const response = NextResponse.json({
      success: true,
      message: 'Tüm adresler başarıyla silindi',
      deletedCount: totalCount || 0
    })
    
    return applySecurityHeaders(response)

  } catch (error) {
    console.error('Tüm adresler silinirken hata:', error)
    
    logSecurityEvent('DELETE_ALL_ADDRESSES_ERROR', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, request)
    
    const response = NextResponse.json(
      { error: 'Sunucu hatası' },
      { status: 500 }
    )
    return applySecurityHeaders(response)
  }
} 