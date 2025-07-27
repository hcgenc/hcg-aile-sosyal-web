"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import { useSupabase } from "./supabase-context"
import { toast } from "@/components/ui/use-toast"

export type UserRole = "normal" | "editor" | "admin"

export type User = {
  id: string
  username: string
  role: UserRole
  fullName: string
  city?: string
  createdAt: string
  lastLogin?: string
}

type AuthContextType = {
  user: User | null
  isLoading: boolean
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
  hasPermission: (action: string) => boolean
  logAction: (action: string, details?: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: async () => false,
  logout: () => {},
  hasPermission: () => false,
  logAction: async () => {},
})

export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const { supabase } = useSupabase()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Check if user is logged in on app start - simplified approach
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem("auth_token")
      const userData = localStorage.getItem("user")
        
        if (token && userData) {
          // Simply trust the stored user data if token exists
          // Server will validate the token on API requests
          const parsedUser = JSON.parse(userData)
          setUser(parsedUser)
        }
      } catch (error) {
        console.error("Error loading auth data:", error)
        // Clear invalid data
        localStorage.removeItem("auth_token")
        localStorage.removeItem("user")
      }
      setIsLoading(false)
    }

    checkAuth()
  }, [])

  const login = async (username: string, password: string): Promise<boolean> => {
    if (!supabase) return false

    try {
      setIsLoading(true)

      // Call secure login API endpoint
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password })
      })

      const result = await response.json()

      if (!response.ok) {
        toast({
          title: "Hata",
          description: result.error || "Giriş yapılırken bir sorun oluştu.",
          variant: "destructive",
        })
        return false
      }

      if (result.token && result.user) {
        // Use the user data from API response with fullName from database
        const userWithMissingFields = {
          ...result.user,
          createdAt: new Date().toISOString() // Add current date if not provided
        }

        // Store JWT token and user data
        localStorage.setItem("auth_token", result.token)
        localStorage.setItem("user", JSON.stringify(userWithMissingFields))
        setUser(userWithMissingFields)

        // Log the login action
        await logActionInternal(userWithMissingFields, "LOGIN", "Kullanıcı sisteme giriş yaptı")

        toast({
          title: "Başarılı",
          description: `Hoş geldiniz, ${userWithMissingFields.fullName}!`,
        })

        return true
      }

      return false
    } catch (error) {
      console.error("Login error:", error)
      toast({
        title: "Hata",
        description: "Giriş yapılırken bir sorun oluştu.",
        variant: "destructive",
      })
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    if (user) {
      await logActionInternal(user, "LOGOUT", "Kullanıcı sistemden çıkış yaptı")
    }

    // Clear all auth data
    localStorage.removeItem("auth_token")
    localStorage.removeItem("user")
    setUser(null)
    
    toast({
      title: "Başarılı",
      description: "Başarıyla çıkış yapıldı.",
    })
  }

  // Check user permissions based on role
  const hasPermission = (action: string): boolean => {
    if (!user) return false

    const permissions = {
      normal: ["VIEW_MAP", "VIEW_SERVICE_LIST", "VIEW_FILTERS"],
      editor: [
        "VIEW_MAP",
        "VIEW_SERVICE_LIST",
        "VIEW_FILTERS",
        "ADD_ADDRESS",
        "EDIT_ADDRESS",
        "DELETE_ADDRESS",
        "VIEW_CATEGORY_MANAGEMENT",
        "MANAGE_API_KEYS",
        "VIEW_LOGS"
        // Editor artık MANAGE_CATEGORIES yetkisine sahip değil
      ],
      admin: [
        "VIEW_MAP",
        "VIEW_SERVICE_LIST",
        "VIEW_FILTERS",
        "ADD_ADDRESS",
        "EDIT_ADDRESS",
        "DELETE_ADDRESS",
        "MANAGE_CATEGORIES",
        "VIEW_CATEGORY_MANAGEMENT",
        "MANAGE_API_KEYS",
        "VIEW_LOGS",
        "MANAGE_USERS",
        "SYSTEM_CONTROL"
      ],
    }

    return permissions[user.role]?.includes(action) || false
  }

  // Internal logging function
  const logActionInternal = async (userObj: User, action: string, details?: string) => {
    if (!supabase) return

    try {
      const result = await supabase.insert("logs", {
        user_id: userObj.id,
        username: userObj.username,
        action,
        details,
        ip_address: null, // Could be implemented with a service
        user_agent: navigator.userAgent,
      })
      
      if (result.error) {
        // Handle authentication errors
        if (result.error.message?.includes('authentication') || result.error.message?.includes('401') || result.error.message?.includes('Invalid authentication token')) {
          // Token might be expired - silently fail for logging
          // Don't logout the user just because logging failed
          return
        }
        console.error("Failed to log action:", JSON.stringify({
          action,
          error: result.error.message,
          details: result.error.details
        }, null, 2))
      }
    } catch (error) {
      console.error("Error logging action:", error instanceof Error ? error.message : "Unknown error")
    }
  }

  // Public logging function
  const logAction = async (action: string, details?: string) => {
    if (user) {
      await logActionInternal(user, action, details)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        hasPermission,
        logAction,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
