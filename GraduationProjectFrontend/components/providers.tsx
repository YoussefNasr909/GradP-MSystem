"use client"

import type React from "react"
import { ThemeProvider } from "next-themes"
import { Toaster } from "@/components/ui/toaster"
import { AuthBootstrap } from "@/components/auth/auth-bootstrap"
import { SettingsProvider } from "@/components/settings/settings-provider"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthBootstrap>
        <SettingsProvider>{children}</SettingsProvider>
      </AuthBootstrap>
      <Toaster />
    </ThemeProvider>
  )
}
