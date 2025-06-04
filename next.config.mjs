/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(), microphone=(), camera=()',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' *.yandex.com *.yandex.net *.yandex.ru *.yandex.com.tr api-maps.yandex.ru yastatic.net *.yastatic.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: *.yandex.com *.yandex.net *.yandex.ru *.yandex.com.tr yastatic.net *.yastatic.net; connect-src 'self' *.supabase.co *.yandex.com *.yandex.net *.yandex.ru *.yandex.com.tr yastatic.net *.yastatic.net; frame-src 'none'; object-src 'none';",
          },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.NODE_ENV === 'production' ? process.env.BASE_URL || '' : '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, X-Requested-With',
          },
          {
            key: 'Access-Control-Max-Age',
            value: '86400',
          },
        ],
      },
    ]
  },
  async rewrites() {
    return [
      {
        source: '/api/supabase',
        destination: '/api/supabase',
      },
    ]
  },
}

export default nextConfig
