import { apiRequest } from "./http"
import type { UserSettings, UserSettingsPatch } from "./types"

export const settingsApi = {
  getMe: () => apiRequest<UserSettings>("/settings/me"),
  updateMe: (payload: UserSettingsPatch) =>
    apiRequest<UserSettings>("/settings/me", {
      method: "PATCH",
      body: payload,
    }),
}
