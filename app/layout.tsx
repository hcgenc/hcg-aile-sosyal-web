import type React from "react"
import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from "@/components/theme-provider"
import { SideMenu } from "@/components/side-menu"
import { MapProvider } from "@/context/map-context"
import { SupabaseProvider } from "@/context/supabase-context"
import { AuthProvider } from "@/context/auth-context"
import { ConnectionProvider } from "@/context/connection-context"
import { AuthGuard } from "@/components/auth-guard"
import { ConnectionStatus } from "@/components/connection-status"
import "./globals.css"
import "./yandex-maps.css"

export const metadata = {
  title: "Harita Tabanlı Adres ve Kategori Yönetimi",
  description: "Türkçe web uygulaması: Harita tabanlı adres ve kategori yönetim sistemi",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr" suppressHydrationWarning className="dark">
      <body className="dark:bg-gray-900 dark:text-gray-100">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          <SupabaseProvider>
            <AuthProvider>
              <ConnectionProvider>
                <AuthGuard>
                  <MapProvider>
                    <SideMenu />
                    {children}
                    <Toaster />
                    <ConnectionStatus />
                  </MapProvider>
                </AuthGuard>
              </ConnectionProvider>
            </AuthProvider>
          </SupabaseProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
