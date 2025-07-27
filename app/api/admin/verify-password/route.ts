import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { applySecurityHeaders } from '@/lib/middleware'
import { logSecurityEvent } from '@/lib/security'
import type { Database } from '@/types/supabase'

// Server-side Supabase client (auth endpoints need service role for user table access)
function createServerSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables')
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
    const { password, userId } = await request.json()

    if (!password || !userId) {
      return NextResponse.json(
        { error: 'Şifre ve kullanıcı ID gerekli' },
        { status: 400 }
      )
    }

    // Type validation
    if (typeof password !== 'string' || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'Geçersiz parametre formatı' },
        { status: 400 }
      )
    }

    const supabase = createServerSupabaseClient()
    
    // Query user from database - direct Supabase access like login
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, password, role')
      .eq('id', userId)
      .eq('role', 'admin')
      .single()

    if (error || !user) {
      // Log failed admin verification attempt
      logSecurityEvent('FAILED_ADMIN_VERIFICATION', { 
        userId: userId,
        reason: 'admin_user_not_found'
      }, request)
      
      return NextResponse.json(
        { error: 'Admin kullanıcı bulunamadı' },
        { status: 403 }
      )
    }

    if (!user.password) {
      return NextResponse.json(
        { error: 'Kullanıcı şifresi bulunamadı' },
        { status: 500 }
      )
    }

    // Verify password using bcrypt (same as login)
    const isPasswordValid = password === user.password

    if (!isPasswordValid) {
      // Log failed password verification
      logSecurityEvent('FAILED_ADMIN_PASSWORD_VERIFICATION', { 
        userId: userId,
        username: user.username,
        reason: 'invalid_password'
      }, request)
      
      return NextResponse.json(
        { error: 'Geçersiz şifre' },
        { status: 401 }
      )
    }

    // Log successful admin verification
    logSecurityEvent('SUCCESSFUL_ADMIN_VERIFICATION', { 
      userId: userId,
      username: user.username,
      action: 'password_verified'
    }, request)

    // Şifre doğru
    const response = NextResponse.json({
      success: true,
      message: 'Şifre doğrulandı'
    })
    
    return applySecurityHeaders(response)

  } catch (error) {
    console.error('Şifre doğrulama hatası:', error)
    
    logSecurityEvent('ADMIN_VERIFICATION_ERROR', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, request)
    
    const response = NextResponse.json(
      { error: 'Sunucu hatası' },
      { status: 500 }
    )
    return applySecurityHeaders(response)
  }
} 