"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import { supabaseProxy } from "@/lib/supabase-proxy"

type SupabaseContextType = {
  supabase: typeof supabaseProxy
  isLoading: boolean
  refreshClient: () => void
}

const SupabaseContext = createContext<SupabaseContextType>({
  supabase: supabaseProxy,
  isLoading: false,
  refreshClient: () => {},
})

export const useSupabase = () => useContext(SupabaseContext)

export const SupabaseProvider = ({ children }: { children: React.ReactNode }) => {
  const [isLoading, setIsLoading] = useState(true)

  const refreshClient = () => {
    // Server-side proxy doesn't need refresh
    console.log("Using server-side proxy - no refresh needed")
  }

  useEffect(() => {
    // Simulate loading for consistency
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 100)

    return () => clearTimeout(timer)
  }, [])

  return (
    <SupabaseContext.Provider value={{ supabase: supabaseProxy, isLoading, refreshClient }}>
      {children}
    </SupabaseContext.Provider>
  )
}
