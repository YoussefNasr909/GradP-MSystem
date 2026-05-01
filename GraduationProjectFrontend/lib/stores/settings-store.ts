"use client"

import { create } from "zustand"
import { settingsApi } from "@/lib/api/settings"
import type { UserSettings, UserSettingsPatch } from "@/lib/api/types"

type SettingsState = {
  settings: UserSettings | null
  isLoading: boolean
  isSaving: boolean
  error: string | null
  loadSettings: () => Promise<UserSettings | null>
  saveSettings: (payload: UserSettingsPatch) => Promise<UserSettings>
  setSettings: (settings: UserSettings | null) => void
  reset: () => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  isLoading: false,
  isSaving: false,
  error: null,
  setSettings: (settings) => set({ settings }),
  reset: () => set({ settings: null, isLoading: false, isSaving: false, error: null }),
  loadSettings: async () => {
    set({ isLoading: true, error: null })
    try {
      const settings = await settingsApi.getMe()
      set({ settings, isLoading: false })
      return settings
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load settings."
      set({ error: message, isLoading: false })
      return null
    }
  },
  saveSettings: async (payload) => {
    set({ isSaving: true, error: null })
    try {
      const settings = await settingsApi.updateMe(payload)
      set({ settings, isSaving: false })
      return settings
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save settings."
      set({ error: message, isSaving: false })
      throw err
    }
  },
}))
