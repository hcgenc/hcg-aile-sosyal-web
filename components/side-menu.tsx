"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X, MapPin, FolderTree, List, Home, LogOut, FileSpreadsheet, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/context/auth-context"
import { Button } from "@/components/ui/button"
import { ConnectionStatusIndicator } from "@/components/connection-status"

export function SideMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const { user, hasPermission, logAction, logout } = useAuth()

  const toggleMenu = () => {
    setIsOpen(!isOpen)
  }

  const handleMenuItemClick = async (itemName: string, path: string) => {
    await logAction("NAVIGATE", `Navigated to ${itemName} (${path})`)
    setIsOpen(false)
  }

  const menuItems = [
    {
      name: "Ana Sayfa",
      path: "/",
      icon: <Home className="mr-3 h-5 w-5" />,
      permission: "VIEW_MAP",
    },
    {
      name: "Adres Ekle",
      path: "/adres-ekle",
      icon: <MapPin className="mr-3 h-5 w-5" />,
      permission: "ADD_ADDRESS",
    },
    {
      name: "Toplu Veri Girişi",
      path: "/toplu-veri-girisi",
      icon: <FileSpreadsheet className="mr-3 h-5 w-5" />,
      permission: "ADD_ADDRESS",
    },
    {
      name: "Kategori Yönetimi",
      path: "/kategori-yonetimi",
      icon: <FolderTree className="mr-3 h-5 w-5" />,
      permission: "MANAGE_CATEGORIES",
    },
    {
      name: "Hizmet Alanların Listesi",
      path: "/hizmet-listesi",
      icon: <List className="mr-3 h-5 w-5" />,
      permission: "VIEW_SERVICE_LIST",
    },
  ]

  // Filter menu items based on user permissions
  const visibleMenuItems = menuItems.filter((item) => hasPermission(item.permission))

  return (
    <>
      {/* Menu Toggle Button - Only show when sidebar is closed */}
      {!isOpen && (
        <button
          onClick={toggleMenu}
          className="fixed z-[1000] top-4 left-4 bg-gradient-to-r from-gray-800 to-gray-900 text-gray-100 p-3 rounded-xl shadow-xl hover:from-gray-700 hover:to-gray-800 transition-all duration-300 border border-gray-600/50 backdrop-blur-sm"
          aria-label="Menüyü Aç"
          style={{ boxShadow: "0 8px 25px rgba(0, 0, 0, 0.4)" }}
        >
          <Menu className="h-6 w-6" />
        </button>
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-[999] w-72 bg-gradient-to-b from-gray-800 via-gray-900 to-gray-800 shadow-2xl transform transition-all duration-500 ease-out border-r border-gray-700/50 backdrop-blur-xl",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex flex-col h-full relative">
          {/* Close Button - Top right corner of sidebar */}
          <button
            onClick={toggleMenu}
            className="absolute top-4 right-4 z-[1001] bg-gradient-to-r from-gray-700 to-gray-800 text-gray-100 p-2 rounded-lg shadow-lg hover:from-gray-600 hover:to-gray-700 transition-all duration-300 border border-gray-600/50"
            aria-label="Menüyü Kapat"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Header */}
          <div className="p-6 pr-16 border-b border-gray-700/50 bg-gradient-to-r from-gray-800/50 to-gray-900/50">
            <h2 className="text-xl font-bold text-gray-100 mb-2">Harita Sistemi</h2>
            <p className="text-sm text-gray-400">Adres & Kategori Yönetimi</p>
          </div>

          {/* Connection Status */}
          <div className="px-6 py-4 border-b border-gray-700/30">
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-800/30 border border-gray-700/30 backdrop-blur-sm">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Bağlantı</span>
              <ConnectionStatusIndicator />
            </div>
          </div>

          {/* Navigation Menu */}
          <div className="flex-1 overflow-y-auto p-6">
            <nav className="space-y-2">
              {visibleMenuItems.map((item) => (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => handleMenuItemClick(item.name, item.path)}
                  className={cn(
                    "flex items-center px-4 py-3.5 text-sm font-medium rounded-xl transition-all duration-300 group relative overflow-hidden",
                    pathname === item.path
                      ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-600/20 border border-blue-500/30"
                      : "text-gray-300 hover:bg-gradient-to-r hover:from-gray-700/50 hover:to-gray-600/50 hover:text-white border border-transparent hover:border-gray-600/30",
                  )}
                >
                  <div className="flex items-center flex-1 relative z-10">
                    {item.icon}
                    <span className="font-medium">{item.name}</span>
                  </div>
                  {pathname === item.path && (
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-blue-700/20 rounded-xl blur-sm"></div>
                  )}
                </Link>
              ))}
            </nav>
          </div>

          {/* User Profile & Logout - Enhanced user info display */}
          {user && (
            <div className="p-6 border-t border-gray-700/50 bg-gradient-to-r from-gray-800/30 to-gray-900/30">
              <div className="mb-4 p-4 rounded-xl bg-gray-800/50 border border-gray-700/30 backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-full bg-gradient-to-r from-blue-600 to-purple-600">
                    <User className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="text-sm font-semibold text-gray-100 truncate">
                      {user.fullName || 'Kullanıcı'}
                    </div>
                    <div className="text-xs text-gray-400 font-medium">
                      @{user.username}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-center">
                  <span className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-full",
                    user.role === "editor" 
                      ? "bg-gradient-to-r from-blue-600/20 to-purple-600/20 text-blue-300 border border-blue-500/30" 
                      : "bg-gradient-to-r from-gray-600/20 to-gray-700/20 text-gray-300 border border-gray-500/30"
                  )}>
                    {user.role === "editor" ? "Editör" : "Normal Kullanıcı"}
                  </span>
                </div>
              </div>
              
              <Button
                onClick={logout}
                variant="outline"
                size="sm"
                className="w-full bg-gradient-to-r from-red-900/20 to-red-800/20 border-red-600/50 text-red-400 hover:bg-gradient-to-r hover:from-red-900/40 hover:to-red-800/40 hover:text-red-300 hover:border-red-500/70 transition-all duration-300"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Çıkış Yap
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[998] bg-black/60 backdrop-blur-sm transition-opacity duration-500"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  )
}
