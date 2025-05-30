"use client"

import type React from "react"

import { useAuth } from "@/context/auth-context"
import { LoginScreen } from "./login-screen"

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return <LoginScreen />
  }

  if (!user) {
    return <LoginScreen />
  }

  return <>{children}</>
}
