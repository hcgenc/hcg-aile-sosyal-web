"use client"

import type React from "react"

import { createContext, useContext, useState, useEffect } from "react"
import type { SupabaseClient } from "@supabase/auth-helpers-nextjs"
import { createSupabaseClient } from "@/lib/supabase-helpers"
import type { Database } from "@/types/supabase"

type SupabaseContextType = {
  supabase: SupabaseClient<Database> | null
  isLoading: boolean
  refreshClient: () => void
}

const SupabaseContext = createContext<SupabaseContextType>({
  supabase: null,
  isLoading: true,
  refreshClient: () => {},
})

export const useSupabase = () => useContext(SupabaseContext)

export const SupabaseProvider = ({ children }: { children: React.ReactNode }) => {
  const [supabase, setSupabase] = useState<SupabaseClient<Database> | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshClient = () => {
    const client = createSupabaseClient()
    setSupabase(client)
  }

  useEffect(() => {
    refreshClient()
    setIsLoading(false)
  }, [])

  return <SupabaseContext.Provider value={{ supabase, isLoading, refreshClient }}>{children}</SupabaseContext.Provider>
}
