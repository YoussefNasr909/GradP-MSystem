"use client"

import { create } from "zustand"

const LS_IN_APP = "pref:inAppNotifications"

interface UIState {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  isMobileSidebarOpen: boolean
  setMobileSidebarOpen: (open: boolean) => void
  toggleMobileSidebar: () => void
  commandPaletteOpen: boolean
  setCommandPaletteOpen: (open: boolean) => void
  notificationsPanelOpen: boolean
  setNotificationsPanelOpen: (open: boolean) => void
  inAppNotifications: boolean
  setInAppNotifications: (enabled: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  isMobileSidebarOpen: false,
  setMobileSidebarOpen: (open) => set({ isMobileSidebarOpen: open }),
  toggleMobileSidebar: () => set((state) => ({ isMobileSidebarOpen: !state.isMobileSidebarOpen })),
  commandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  notificationsPanelOpen: false,
  setNotificationsPanelOpen: (open) => set({ notificationsPanelOpen: open }),
  inAppNotifications: typeof window !== "undefined"
    ? localStorage.getItem(LS_IN_APP) !== "false"
    : true,
  setInAppNotifications: (enabled) => {
    if (typeof window !== "undefined") localStorage.setItem(LS_IN_APP, String(enabled))
    set({ inAppNotifications: enabled })
  },
}))
