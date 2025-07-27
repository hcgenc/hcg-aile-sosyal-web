// NEXT.JS MIDDLEWARE
// App Control System + Authentication Middleware

import { NextRequest, NextResponse } from 'next/server'
import { appControlMiddleware } from '@/lib/app-control'

export default async function middleware(request: NextRequest) {
  // 1. App Control Check - Önce uygulamanın aktif olup olmadığını kontrol et
  const appControlResponse = await appControlMiddleware(request)
  if (appControlResponse) {
    return appControlResponse // App inactive ise 503 döndür
  }

  // 2. Diğer middleware işlemleri burada olabilir
  // (Örneğin: authentication, logging, vb.)

  // 3. Normal işlemlere devam et
  return NextResponse.next()
}

// Middleware'in hangi route'larda çalışacağını belirt
export const config = {
  matcher: [
    // Sadece API routes için
    '/api/((?!_next|static).*)',
  ]
} 