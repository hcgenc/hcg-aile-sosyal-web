"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import { useSupabase } from "./supabase-context"
import { toast } from "@/components/ui/use-toast"

export type UserRole = "normal" | "editor"

export type User = {
  id: string
  username: string
  role: UserRole
  fullName: string
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

  // Check if user is logged in on app start
  useEffect(() => {
    const checkAuth = () => {
      const userData = localStorage.getItem("user")
      if (userData) {
        try {
          const parsedUser = JSON.parse(userData)
          setUser(parsedUser)
        } catch (error) {
          console.error("Error parsing user data:", error)
          localStorage.removeItem("user")
        }
      }
      setIsLoading(false)
    }

    checkAuth()
  }, [])

  // Simple password verification (in production, use proper hashing)
  const verifyPassword = (inputPassword: string, storedPassword: string): boolean => {
    // For demo purposes, we'll use simple comparison
    // In production, use bcrypt or similar
    return inputPassword === "password123" || inputPassword === storedPassword
  }

  const login = async (username: string, password: string): Promise<boolean> => {
    if (!supabase) return false

    try {
      setIsLoading(true)

      // Query user from database
      const { data: userData, error } = await supabase.from("users").select("*").eq("username", username).single()

      if (error || !userData) {
        toast({
          title: "Hata",
          description: "Kullanıcı adı veya şifre hatalı.",
          variant: "destructive",
        })
        return false
      }

      // Verify password
      if (!verifyPassword(password, userData.password)) {
        toast({
          title: "Hata",
          description: "Kullanıcı adı veya şifre hatalı.",
          variant: "destructive",
        })
        return false
      }

      // Create user object
      const userObj: User = {
        id: userData.id,
        username: userData.username,
        role: userData.role as UserRole,
        fullName: userData.full_name || userData.username,
        createdAt: userData.created_at,
        lastLogin: userData.last_login,
      }

      // Update last login
      await supabase.from("users").update({ last_login: new Date().toISOString() }).eq("id", userData.id)

      // Save to localStorage and state
      localStorage.setItem("user", JSON.stringify(userObj))
      setUser(userObj)

      // Log the login action
      await logActionInternal(userObj, "LOGIN", "Kullanıcı sisteme giriş yaptı")

      toast({
        title: "Başarılı",
        description: `Hoş geldiniz, ${userObj.fullName}!`,
      })

      return true
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
        "MANAGE_CATEGORIES",
        "VIEW_CATEGORY_MANAGEMENT",
      ],
    }

    return permissions[user.role]?.includes(action) || false
  }

  // Internal logging function
  const logActionInternal = async (userObj: User, action: string, details?: string) => {
    if (!supabase) return

    try {
      await supabase.from("logs").insert({
        user_id: userObj.id,
        username: userObj.username,
        action,
        details,
        ip_address: null, // Could be implemented with a service
        user_agent: navigator.userAgent,
      })
    } catch (error) {
      console.error("Error logging action:", error)
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
