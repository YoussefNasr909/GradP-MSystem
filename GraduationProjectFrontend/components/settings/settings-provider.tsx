"use client"

import type React from "react"
import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { useAuthStore } from "@/lib/stores/auth-store"
import { useSettingsStore } from "@/lib/stores/settings-store"
import { useUIStore } from "@/lib/stores/ui-store"

const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "scroll", "pointermove"] as const

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { setTheme } = useTheme()
  const { accessToken, currentUser, logout } = useAuthStore()
  const { settings, loadSettings, reset } = useSettingsStore()
  const setSidebarCollapsed = useUIStore((state) => state.setSidebarCollapsed)
  const logoutTimerRef = useRef<number | null>(null)
  const setThemeRef = useRef(setTheme)

  useEffect(() => {
    setThemeRef.current = setTheme
  }, [setTheme])

  useEffect(() => {
    if (!accessToken || !currentUser) {
      reset()
      return
    }

    loadSettings()
  }, [accessToken, currentUser?.id, currentUser, loadSettings, reset])

  useEffect(() => {
    if (!settings) return

    const root = document.documentElement
    const { appearance } = settings

    setThemeRef.current(appearance.theme)
    root.style.fontSize = `${appearance.fontSize}px`
    root.classList.toggle("app-compact", appearance.compactMode)
    root.classList.toggle("app-reduced-motion", appearance.reducedMotion)
    root.classList.toggle("app-high-contrast", appearance.highContrast)
    setSidebarCollapsed(appearance.sidebarCollapsed)

    return () => {
      root.style.fontSize = ""
      root.classList.remove("app-compact", "app-reduced-motion", "app-high-contrast")
    }
  }, [settings, setSidebarCollapsed])

  useEffect(() => {
    if (!accessToken || !settings) return

    const timeoutMinutes = settings.security.sessionTimeout
    if (!timeoutMinutes || timeoutMinutes < 5) return

    const clearLogoutTimer = () => {
      if (logoutTimerRef.current) {
        window.clearTimeout(logoutTimerRef.current)
        logoutTimerRef.current = null
      }
    }

    const resetLogoutTimer = () => {
      clearLogoutTimer()
      logoutTimerRef.current = window.setTimeout(
        () => {
          logout()
          router.replace("/login?reason=session-timeout")
        },
        timeoutMinutes * 60 * 1000,
      )
    }

    resetLogoutTimer()
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, resetLogoutTimer, { passive: true }))

    return () => {
      clearLogoutTimer()
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, resetLogoutTimer))
    }
  }, [accessToken, settings, logout, router])

  return <>{children}</>
}
