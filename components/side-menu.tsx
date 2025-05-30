"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X, MapPin, FolderTree, List, Home, LogOut, FileSpreadsheet } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/context/auth-context"
import { Button } from "@/components/ui/button"

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
      icon: <Home className="mr-2 h-4 w-4" />,
      permission: "VIEW_MAP",
    },
    {
      name: "Adres Ekle",
      path: "/adres-ekle",
      icon: <MapPin className="mr-2 h-4 w-4" />,
      permission: "ADD_ADDRESS",
    },
    {
      name: "Toplu Veri Girişi",
      path: "/toplu-veri-girisi",
      icon: <FileSpreadsheet className="mr-2 h-4 w-4" />,
      permission: "ADD_ADDRESS",
    },
    {
      name: "Kategori Yönetimi",
      path: "/kategori-yonetimi",
      icon: <FolderTree className="mr-2 h-4 w-4" />,
      permission: "MANAGE_CATEGORIES",
    },
    {
      name: "Hizmet Alanların Listesi",
      path: "/hizmet-listesi",
      icon: <List className="mr-2 h-4 w-4" />,
      permission: "VIEW_SERVICE_LIST",
    },
  ]

  // Filter menu items based on user permissions
  const visibleMenuItems = menuItems.filter((item) => hasPermission(item.permission))

  return (
    <>
      <button
        onClick={toggleMenu}
        className="fixed z-[1000] top-4 left-4 bg-gray-800 text-gray-100 p-3 rounded-md shadow-lg hover:bg-gray-700 transition-colors border-2 border-gray-600"
        aria-label="Menüyü Aç/Kapat"
        style={{ boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)" }}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-[999] w-64 bg-gray-800 shadow-lg transform transition-transform duration-300 ease-in-out border-r border-gray-700",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex flex-col h-full p-4">
          <div className="space-y-1 py-16">
            {visibleMenuItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => handleMenuItemClick(item.name, item.path)}
                className={cn(
                  "flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors",
                  pathname === item.path
                    ? "bg-gray-700 text-gray-100 border border-gray-600"
                    : "text-gray-300 hover:bg-gray-700 hover:text-gray-100",
                )}
              >
                {item.icon}
                {item.name}
              </Link>
            ))}
          </div>

          {/* User info and logout at bottom */}
          {user && (
            <div className="mt-auto p-4 border-t border-gray-700">
              <div className="text-sm text-gray-400 mb-3">
                <div className="font-medium text-gray-200">{user.fullName}</div>
                <div className="text-xs">@{user.username}</div>
                <div className="text-xs mt-1 text-blue-400">
                  {user.role === "editor" ? "Editör" : "Normal Kullanıcı"}
                </div>
              </div>
              <Button
                onClick={logout}
                variant="outline"
                size="sm"
                className="w-full border-red-600 text-red-400 hover:bg-red-900/20 hover:text-red-300"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Çıkış Yap
              </Button>
            </div>
          )}
        </div>
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 z-[998] bg-black bg-opacity-50"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  )
}
