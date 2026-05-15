"use client"

import type React from "react"
import { ThemeProvider } from "next-themes"
import { Toaster as LegacyToaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { AuthBootstrap } from "@/components/auth/auth-bootstrap"
import { SettingsProvider } from "@/components/settings/settings-provider"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthBootstrap>
        <SettingsProvider>{children}</SettingsProvider>
      </AuthBootstrap>
      <LegacyToaster />
      <SonnerToaster />
    </ThemeProvider>
  )
}
