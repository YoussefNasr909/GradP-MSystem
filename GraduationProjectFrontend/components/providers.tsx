"use client"

import type React from "react"
import { ThemeProvider } from "next-themes"
import { Toaster } from "@/components/ui/toaster"
import { AuthBootstrap } from "@/components/auth/auth-bootstrap"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthBootstrap>{children}</AuthBootstrap>
      <Toaster />
    </ThemeProvider>
  )
}
