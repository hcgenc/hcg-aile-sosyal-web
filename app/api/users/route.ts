import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyToken } from '@/lib/auth'
import { applySecurityHeaders } from '@/lib/middleware'
import { sanitizeString } from '@/lib/security'
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

// Input validasyon fonksiyonu
function validateUserInput(data: any) {
  const errors: string[] = []
  
  if (!data.username || typeof data.username !== 'string' || data.username.trim().length < 3) {
    errors.push('Kullanıcı adı en az 3 karakter olmalıdır')
  }
  
  if (!data.password || typeof data.password !== 'string' || data.password.length < 6) {
    errors.push('Şifre en az 6 karakter olmalıdır')
  }
  
  if (!data.fullName || typeof data.fullName !== 'string' || data.fullName.trim().length < 2) {
    errors.push('Ad Soyad en az 2 karakter olmalıdır')
  }
  
  if (!data.role || !['normal', 'editor'].includes(data.role)) {
    errors.push('Rol normal veya editor olmalıdır')
  }
  
  if (!data.city || typeof data.city !== 'string' || data.city.trim().length < 2) {
    errors.push('Geçerli bir şehir seçilmelidir')
  }
  
  // Kullanıcı adı regex kontrolü
  if (data.username && !/^[a-zA-Z0-9_]+$/.test(data.username)) {
    errors.push('Kullanıcı adı sadece harf, rakam ve alt çizgi içerebilir')
  }
  
  return errors
}

// POST - Yeni kullanıcı ekleme (Sadece admin)
export async function POST(request: NextRequest) {
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
        { error: 'Bu işlem için yetkiniz yok. Sadece sistem yöneticileri kullanıcı ekleyebilir.' },
        { status: 403 }
      )
      return applySecurityHeaders(response)
    }

    // Request body'yi parse et
    const body = await request.json()
    
    // Input validasyonu
    const validationErrors = validateUserInput(body)
    if (validationErrors.length > 0) {
      const response = NextResponse.json(
        { error: validationErrors.join(', ') },
        { status: 400 }
      )
      return applySecurityHeaders(response)
    }

    const { username, password, fullName, role, city } = body

    // Input sanitization
    const sanitizedUsername = sanitizeString(username.trim())
    const sanitizedFullName = sanitizeString(fullName.trim())
    const sanitizedCity = sanitizeString(city.trim())

    // Kullanıcı adı tekrarı kontrolü
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('username', sanitizedUsername)
      .single()

    if (existingUser) {
      const response = NextResponse.json(
        { error: 'Bu kullanıcı adı zaten kullanılıyor' },
        { status: 400 }
      )
      return applySecurityHeaders(response)
    }

    // Yeni kullanıcı ekleme (plain text password as per database schema)
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        username: sanitizedUsername,
        password: password,
        full_name: sanitizedFullName,
        role: role,
        city: sanitizedCity
      })
      .select('id, username, full_name, role, city, created_at')
      .single()

    if (insertError) {
      console.error('Error creating user:', insertError)
      
      let errorMessage = 'Kullanıcı oluşturulurken bir hata oluştu'
      
      if (insertError.message.includes('duplicate') || insertError.code === '23505') {
        errorMessage = 'Bu kullanıcı adı zaten kullanılıyor'
      } else if (insertError.message.includes('constraint')) {
        errorMessage = 'Veri bütünlüğü hatası. Lütfen girilen bilgileri kontrol edin.'
      }
      
      const response = NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      )
      return applySecurityHeaders(response)
    }

    // Log işlemi
    await supabase
      .from('logs')
      .insert({
        user_id: decoded.userId,
        username: decoded.username,
        action: 'USER_CREATED',
        details: `Admin created new user: ${sanitizedUsername} (${role}) in ${sanitizedCity}`,
        user_agent: request.headers.get('user-agent') || null
      })

    const response = NextResponse.json(
      { 
        message: 'Kullanıcı başarıyla eklendi',
        user: {
          id: newUser.id,
          username: newUser.username,
          fullName: newUser.full_name,
          role: newUser.role,
          city: newUser.city,
          createdAt: newUser.created_at
        }
      },
      { status: 201 }
    )
    
    return applySecurityHeaders(response)

  } catch (error) {
    console.error('Error in user creation API:', error)
    
    const response = NextResponse.json(
      { error: 'Kullanıcı oluşturulurken bir hata oluştu' },
      { status: 500 }
    )
    return applySecurityHeaders(response)
  }
}

// GET - Kullanıcı listesi (Sadece admin)
export async function GET(request: NextRequest) {
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

    // Kullanıcı listesini getir (şifre hariç)
    const { data: users, error: selectError } = await supabase
      .from('users')
      .select('id, username, full_name, role, city, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (selectError) {
      console.error('Error fetching users:', selectError)
      const response = NextResponse.json(
        { error: 'Kullanıcılar getirilirken bir hata oluştu' },
        { status: 500 }
      )
      return applySecurityHeaders(response)
    }

    const response = NextResponse.json(
      { 
        users: users.map((user: any) => ({
          id: user.id,
          username: user.username,
          fullName: user.full_name,
          role: user.role,
          city: user.city,
          createdAt: user.created_at,
          updatedAt: user.updated_at
        }))
      },
      { status: 200 }
    )
    
    return applySecurityHeaders(response)

  } catch (error) {
    console.error('Error in user list API:', error)
    const response = NextResponse.json(
      { error: 'Kullanıcılar getirilirken bir hata oluştu' },
      { status: 500 }
    )
    return applySecurityHeaders(response)
  }
} 