import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyToken } from '@/lib/auth'
import { applySecurityHeaders } from '@/lib/middleware'
import { sanitizeString } from '@/lib/security'
import type { Database } from '@/types/supabase'

// Server-side Supabase client
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

// PUT - Kullanıcı güncelleme (Sadece admin)
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Token kontrolü
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const response = NextResponse.json(
        { error: 'Token bulunamadı' },
        { status: 401 }
      )
      return applySecurityHeaders(response)
    }

    const token = authHeader.split(' ')[1]
    const decoded = await verifyToken(token)
    
    if (!decoded || !decoded.userId) {
      const response = NextResponse.json(
        { error: 'Geçersiz token' },
        { status: 401 }
      )
      return applySecurityHeaders(response)
    }

    // Supabase client oluştur
    const supabase = createServerSupabaseClient()

    // Admin yetkisi kontrolü
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', decoded.userId)
      .single()

    if (userError || !user || user.role !== 'admin') {
      const response = NextResponse.json(
        { error: 'Bu işlem için yetkiniz yok' },
        { status: 403 }
      )
      return applySecurityHeaders(response)
    }

    const resolvedParams = await params
    const userId = resolvedParams.id
    
    if (!userId) {
      const response = NextResponse.json(
        { error: 'Kullanıcı ID bulunamadı' },
        { status: 400 }
      )
      return applySecurityHeaders(response)
    }

    // Request body'yi parse et
    const body = await request.json()
    const { username, fullName, role, city } = body

    // Input validasyonu
    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      const response = NextResponse.json(
        { error: 'Kullanıcı adı en az 3 karakter olmalıdır' },
        { status: 400 }
      )
      return applySecurityHeaders(response)
    }

    if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
      const response = NextResponse.json(
        { error: 'Ad Soyad en az 2 karakter olmalıdır' },
        { status: 400 }
      )
      return applySecurityHeaders(response)
    }

    if (!role || !['normal', 'editor'].includes(role)) {
      const response = NextResponse.json(
        { error: 'Rol normal veya editor olmalıdır' },
        { status: 400 }
      )
      return applySecurityHeaders(response)
    }

    if (!city || typeof city !== 'string' || city.trim().length < 2) {
      const response = NextResponse.json(
        { error: 'Geçerli bir şehir seçilmelidir' },
        { status: 400 }
      )
      return applySecurityHeaders(response)
    }

    // Input sanitization
    const sanitizedUsername = sanitizeString(username.trim().toLowerCase())
    const sanitizedFullName = sanitizeString(fullName.trim())
    const sanitizedCity = sanitizeString(city.trim())

    // Güncellenecek kullanıcının admin olmadığını kontrol et
    const { data: targetUser, error: targetError } = await supabase
      .from('users')
      .select('role, username')
      .eq('id', userId)
      .single()

    if (targetError || !targetUser) {
      const response = NextResponse.json(
        { error: 'Kullanıcı bulunamadı' },
        { status: 404 }
      )
      return applySecurityHeaders(response)
    }

    if (targetUser.role === 'admin') {
      const response = NextResponse.json(
        { error: 'Admin kullanıcıları düzenlenemez' },
        { status: 403 }
      )
      return applySecurityHeaders(response)
    }

    // Username değişikliği varsa, benzersizlik kontrolü yap
    if (sanitizedUsername !== targetUser.username) {
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('username', sanitizedUsername)
        .single()

      if (existingUser) {
        const response = NextResponse.json(
          { error: 'Bu kullanıcı adı zaten kullanılıyor' },
          { status: 409 }
        )
        return applySecurityHeaders(response)
      }
    }

    // Kullanıcı güncelleme
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({
        username: sanitizedUsername,
        full_name: sanitizedFullName,
        role: role,
        city: sanitizedCity
      })
      .eq('id', userId)
      .select('id, username, full_name, role, city, updated_at')
      .single()

    if (updateError) {
      console.error('Error updating user:', updateError)
      const response = NextResponse.json(
        { error: 'Kullanıcı güncellenirken bir hata oluştu' },
        { status: 500 }
      )
      return applySecurityHeaders(response)
    }

    // Log işlemi
    await supabase
      .from('logs')
      .insert({
        user_id: decoded.userId,
        username: decoded.username,
        action: 'USER_UPDATED',
        details: `Admin updated user: ${targetUser.username} -> username: ${sanitizedUsername}, role: ${role}, city: ${sanitizedCity}`,
        user_agent: request.headers.get('user-agent') || null
      })

    const response = NextResponse.json(
      { 
        message: 'Kullanıcı başarıyla güncellendi',
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          fullName: updatedUser.full_name,
          role: updatedUser.role,
          city: updatedUser.city,
          updatedAt: updatedUser.updated_at
        }
      },
      { status: 200 }
    )
    
    return applySecurityHeaders(response)

  } catch (error) {
    console.error('Error in user update API:', error)
    const response = NextResponse.json(
      { error: 'Kullanıcı güncellenirken bir hata oluştu' },
      { status: 500 }
    )
    return applySecurityHeaders(response)
  }
}

// DELETE - Kullanıcı silme (Sadece admin)
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Token kontrolü
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const response = NextResponse.json(
        { error: 'Token bulunamadı' },
        { status: 401 }
      )
      return applySecurityHeaders(response)
    }

    const token = authHeader.split(' ')[1]
    const decoded = await verifyToken(token)
    
    if (!decoded || !decoded.userId) {
      const response = NextResponse.json(
        { error: 'Geçersiz token' },
        { status: 401 }
      )
      return applySecurityHeaders(response)
    }

    // Supabase client oluştur
    const supabase = createServerSupabaseClient()

    // Admin yetkisi kontrolü
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', decoded.userId)
      .single()

    if (userError || !user || user.role !== 'admin') {
      const response = NextResponse.json(
        { error: 'Bu işlem için yetkiniz yok' },
        { status: 403 }
      )
      return applySecurityHeaders(response)
        }

    const resolvedParams = await params
    const userId = resolvedParams.id

    if (!userId) {
      const response = NextResponse.json(
        { error: 'Kullanıcı ID bulunamadı' },
        { status: 400 }
      )
      return applySecurityHeaders(response)
    }

    // Silinecek kullanıcının admin olmadığını kontrol et
    const { data: targetUser, error: targetError } = await supabase
      .from('users')
      .select('role, username, full_name')
      .eq('id', userId)
      .single()

    if (targetError || !targetUser) {
      const response = NextResponse.json(
        { error: 'Kullanıcı bulunamadı' },
        { status: 404 }
      )
      return applySecurityHeaders(response)
    }

    if (targetUser.role === 'admin') {
      const response = NextResponse.json(
        { error: 'Admin kullanıcıları silinemez' },
        { status: 403 }
      )
      return applySecurityHeaders(response)
    }

    // Kendi kendini silme kontrolü
    if (userId === decoded.userId) {
      const response = NextResponse.json(
        { error: 'Kendi hesabınızı silemezsiniz' },
        { status: 403 }
      )
      return applySecurityHeaders(response)
    }

    // Kullanıcı silme
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId)

    if (deleteError) {
      console.error('Error deleting user:', deleteError)
      const response = NextResponse.json(
        { error: 'Kullanıcı silinirken bir hata oluştu' },
        { status: 500 }
      )
      return applySecurityHeaders(response)
    }

    // Log işlemi
    await supabase
      .from('logs')
      .insert({
        user_id: decoded.userId,
        username: decoded.username,
        action: 'USER_DELETED',
        details: `Admin deleted user: ${targetUser.username} (${targetUser.full_name})`,
        user_agent: request.headers.get('user-agent') || null
      })

    const response = NextResponse.json(
      { 
        message: 'Kullanıcı başarıyla silindi'
      },
      { status: 200 }
    )
    
    return applySecurityHeaders(response)

  } catch (error) {
    console.error('Error in user delete API:', error)
    const response = NextResponse.json(
      { error: 'Kullanıcı silinirken bir hata oluştu' },
      { status: 500 }
    )
    return applySecurityHeaders(response)
  }
} 