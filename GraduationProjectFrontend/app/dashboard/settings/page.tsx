"use client"

import type React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { motion } from "framer-motion"
import {
  AlertCircle,
  Bell,
  Camera,
  Check,
  Copy,
  Github,
  Linkedin,
  Loader2,
  Lock,
  Mail,
  Monitor,
  Moon,
  Palette,
  Save,
  Shield,
  Smartphone,
  Sun,
  Trash2,
  User,
  Volume2,
} from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { authApi } from "@/lib/api/auth"
import { mapApiUserToUiUser } from "@/lib/api/mappers"
import type { Department, Track, UserSettings } from "@/lib/api/types"
import { usersApi } from "@/lib/api/users"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/lib/stores/auth-store"
import { useSettingsStore } from "@/lib/stores/settings-store"
import { useUIStore } from "@/lib/stores/ui-store"

type SettingsTab = "profile" | "notifications" | "appearance" | "privacy" | "security"
type ProfileVisibility = UserSettings["privacy"]["profileVisibility"]

type ProfileFormState = {
  firstName: string
  lastName: string
  email: string
  phone: string
  department: Department | ""
  preferredTrack: Track | ""
  bio: string
  linkedinUrl: string
  githubUsername: string
}

const SETTINGS_TABS: Array<{ value: SettingsTab; label: string; icon: typeof User }> = [
  { value: "profile", label: "Profile", icon: User },
  { value: "notifications", label: "Notifications", icon: Bell },
  { value: "appearance", label: "Appearance", icon: Palette },
  { value: "privacy", label: "Privacy", icon: Shield },
  { value: "security", label: "Security", icon: Lock },
]

const DEPARTMENT_OPTIONS: Array<{ value: Department; label: string }> = [
  { value: "COMPUTER_SCIENCE", label: "Computer Science (CS)" },
  { value: "SOFTWARE_ENGINEERING", label: "Software Engineering (SE)" },
  { value: "INFORMATION_TECHNOLOGY", label: "Information Technology (IT)" },
  { value: "COMPUTER_ENGINEERING", label: "Computer Engineering (CE)" },
  { value: "DATA_SCIENCE", label: "Data Science" },
  { value: "ARTIFICIAL_INTELLIGENCE", label: "Artificial Intelligence" },
  { value: "CYBERSECURITY_INFOSEC", label: "Cybersecurity / Information Security" },
  { value: "INFORMATION_SYSTEMS", label: "Information Systems (IS)" },
  { value: "BIOINFORMATICS", label: "Bioinformatics" },
]

const TRACK_OPTIONS: Array<{ value: Track; label: string }> = [
  { value: "FRONTEND_DEVELOPMENT", label: "Frontend Development" },
  { value: "BACKEND_DEVELOPMENT", label: "Backend Development" },
  { value: "FULLSTACK_DEVELOPMENT", label: "Full-Stack Development" },
  { value: "MOBILE_APP_DEVELOPMENT", label: "Mobile App Development" },
  { value: "DEVOPS", label: "DevOps" },
  { value: "CLOUD_ENGINEERING", label: "Cloud Engineering" },
  { value: "SOFTWARE_ARCHITECTURE", label: "Software Architecture" },
  { value: "QUALITY_ASSURANCE", label: "Quality Assurance (QA)" },
  { value: "GAME_DEVELOPMENT", label: "Game Development" },
]

const VISIBILITY_OPTIONS: Array<{ value: ProfileVisibility; label: string; helper: string }> = [
  { value: "PUBLIC", label: "Public", helper: "Visible in search and public profile views." },
  { value: "TEAM_ONLY", label: "Team only", helper: "Visible to your current team and supervisors." },
  { value: "PRIVATE", label: "Private", helper: "Hidden from search, direct chat candidates, and public profile routes." },
]

const DEFAULT_NOTIFICATIONS: UserSettings["notifications"] = {
  emailNotifications: true,
  websiteNotifications: true,
  soundNotifications: true,
  taskReminders: true,
  meetingReminders: true,
  submissionAlerts: true,
  teamUpdates: true,
  mentionNotifications: true,
  deadlineWarnings: true,
  gradeNotifications: true,
  weeklyDigest: false,
}

const DEFAULT_APPEARANCE: UserSettings["appearance"] = {
  theme: "system",
  fontSize: 16,
  compactMode: false,
  reducedMotion: false,
  highContrast: false,
  sidebarCollapsed: false,
}

const DEFAULT_PRIVACY: UserSettings["privacy"] = {
  profileVisibility: "PUBLIC",
  showEmail: true,
  showActivity: true,
  showTeam: true,
  showOnlineStatus: true,
}

const DEFAULT_SECURITY: UserSettings["security"] = {
  loginAlerts: true,
  sessionTimeout: 30,
  twoFactorEnabled: false,
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.28 } },
}

const cardClassName = "rounded-xl border-border/60 shadow-sm"
const panelClassName = "rounded-lg border border-border/60 bg-muted/20 p-4"
const actionRowClassName = "flex flex-col gap-3 border-t border-border/60 pt-5 sm:flex-row sm:items-center sm:justify-between"

function getObjectValue<T>(value: unknown, key: string): T | null {
  if (!value || typeof value !== "object" || !(key in value)) return null
  return (value as Record<string, unknown>)[key] as T | null
}

function trimOrNull(value: string) {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function isValidUrl(value: string) {
  if (!value.trim()) return true
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

function isValidGithubUsername(value: string) {
  return !value.trim() || /^(?!-)[A-Za-z0-9-]{1,39}(?<!-)$/.test(value.trim())
}

function getGithubProfileUrl(username: string) {
  const cleanUsername = username.trim().replace(/^@/, "")
  return cleanUsername ? `https://github.com/${cleanUsername}` : ""
}

function isStrongPassword(value: string) {
  return value.length >= 8 && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value)
}

function playNotificationSound() {
  if (typeof window === "undefined") return
  const audioWindow = window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }
  const AudioContextCtor = audioWindow.AudioContext ?? audioWindow.webkitAudioContext
  if (!AudioContextCtor) return

  const context = new AudioContextCtor()
  const oscillator = context.createOscillator()
  const gain = context.createGain()

  oscillator.type = "sine"
  oscillator.frequency.value = 740
  gain.gain.setValueAtTime(0.0001, context.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22)
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start()
  oscillator.stop(context.currentTime + 0.24)
}

function getInitialProfileForm(currentUser: ReturnType<typeof useAuthStore.getState>["currentUser"]): ProfileFormState {
  const nameParts = currentUser?.name?.trim().split(/\s+/).filter(Boolean) ?? []
  const departmentRaw = getObjectValue<Department>(currentUser, "departmentRaw")
  const trackRaw = getObjectValue<Track>(currentUser, "preferredTrackRaw")

  return {
    firstName: currentUser?.firstName ?? nameParts[0] ?? "",
    lastName: currentUser?.lastName ?? nameParts.slice(1).join(" ") ?? "",
    email: currentUser?.email ?? "",
    phone: currentUser?.phone ?? "",
    department: departmentRaw ?? "",
    preferredTrack: trackRaw ?? "",
    bio: currentUser?.bio ?? "",
    linkedinUrl: currentUser?.linkedinUrl ?? "",
    githubUsername: currentUser?.githubUsername ?? "",
  }
}

export default function SettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currentUser, accessToken, rememberSession, setAuth, logout } = useAuthStore()
  const { settings, isLoading, isSaving, error, loadSettings, saveSettings } = useSettingsStore()
  const { theme: activeTheme, setTheme } = useTheme()
  const setSidebarCollapsed = useUIStore((state) => state.setSidebarCollapsed)
  const inAppNotifications = useUIStore((state) => state.inAppNotifications)
  const setInAppNotifications = useUIStore((state) => state.setInAppNotifications)
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile")
  const [profileForm, setProfileForm] = useState<ProfileFormState>(() => getInitialProfileForm(currentUser))
  const [notifications, setNotifications] = useState<UserSettings["notifications"]>(DEFAULT_NOTIFICATIONS)
  const [appearance, setAppearance] = useState<UserSettings["appearance"]>(DEFAULT_APPEARANCE)
  const [privacy, setPrivacy] = useState<UserSettings["privacy"]>(DEFAULT_PRIVACY)
  const [security, setSecurity] = useState<UserSettings["security"]>(DEFAULT_SECURITY)
  const [savingSection, setSavingSection] = useState<SettingsTab | null>(null)
  const [savedSection, setSavedSection] = useState<SettingsTab | null>(null)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profilePhotoUploading, setProfilePhotoUploading] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)

  const settingsRef = useRef(settings)
  const setThemeRef = useRef(setTheme)
  const setSidebarCollapsedRef = useRef(setSidebarCollapsed)
  const profilePhotoInputRef = useRef<HTMLInputElement | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteEmail, setDeleteEmail] = useState("")
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [twoFactorOpen, setTwoFactorOpen] = useState(false)
  const [twoFactorPassword, setTwoFactorPassword] = useState("")
  const [twoFactorPasswordError, setTwoFactorPasswordError] = useState("")
  const [twoFactorSetup, setTwoFactorSetup] = useState<{
    qrCodeDataUrl: string
    manualEntryKey: string
  } | null>(null)
  const [twoFactorCode, setTwoFactorCode] = useState("")
  const [twoFactorCodeError, setTwoFactorCodeError] = useState("")
  const [twoFactorRecoveryCodes, setTwoFactorRecoveryCodes] = useState<string[]>([])
  const [twoFactorBusy, setTwoFactorBusy] = useState(false)
  const [disablePassword, setDisablePassword] = useState("")
  const [disableCode, setDisableCode] = useState("")
  const [disableRecoveryCode, setDisableRecoveryCode] = useState("")
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  useEffect(() => {
    setThemeRef.current = setTheme
  }, [setTheme])

  useEffect(() => {
    setSidebarCollapsedRef.current = setSidebarCollapsed
  }, [setSidebarCollapsed])

  useEffect(() => {
    const tab = searchParams.get("tab")
    if (tab && SETTINGS_TABS.some((item) => item.value === tab)) {
      setActiveTab(tab as SettingsTab)
    }
  }, [searchParams])

  useEffect(() => {
    setProfileForm(getInitialProfileForm(currentUser))
  }, [currentUser])

  useEffect(() => {
    if (!settings) return
    setNotifications(settings.notifications)
    setAppearance(settings.appearance)
    setPrivacy(settings.privacy)
    setSecurity(settings.security)
  }, [settings])

  // Keep appearance.theme in sync when theme changes from navbar
  useEffect(() => {
    if (!activeTheme) return
    setAppearance((current) => {
      if (current.theme === activeTheme) return current
      return { ...current, theme: activeTheme as "light" | "dark" | "system" }
    })
  }, [activeTheme])

  // On unmount, restore DOM to the last saved settings so previews don't persist
  useEffect(() => {
    return () => {
      const saved = settingsRef.current
      if (!saved) return
      const root = document.documentElement
      root.style.fontSize = `${saved.appearance.fontSize}px`
      root.classList.toggle("app-compact", saved.appearance.compactMode)
      root.classList.toggle("app-reduced-motion", saved.appearance.reducedMotion)
      root.classList.toggle("app-high-contrast", saved.appearance.highContrast)
      setSidebarCollapsedRef.current(saved.appearance.sidebarCollapsed)
      setThemeRef.current(saved.appearance.theme)
    }
  }, [])

  const browserPermission = typeof window !== "undefined" && "Notification" in window ? Notification.permission : "default"
  const canDisableTwoFactor = disablePassword.trim().length > 0 && (disableCode.trim().length > 0 || disableRecoveryCode.trim().length > 0)
  const currentAvatarUrl = currentUser?.avatar || currentUser?.avatarUrl
  const linkedinUrl = profileForm.linkedinUrl.trim()
  const githubUsername = profileForm.githubUsername.trim().replace(/^@/, "")
  const githubProfileUrl = getGithubProfileUrl(githubUsername)

  const canSaveProfile = useMemo(() => {
    return profileForm.firstName.trim().length >= 2 && profileForm.lastName.trim().length >= 2 && profileForm.email.trim().length > 0
  }, [profileForm])

  const handleTabChange = (value: string) => {
    const next = value as SettingsTab
    setActiveTab(next)
    router.replace(`/dashboard/settings?tab=${next}`, { scroll: false })
  }

  const updateProfileField = <K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) => {
    setProfileForm((current) => ({ ...current, [key]: value }))
  }

  const saveProfile = async () => {
    if (!accessToken) {
      toast.error("Please sign in again before updating your profile.")
      return
    }
    if (!canSaveProfile) {
      toast.error("First and last name must be at least 2 characters.")
      return
    }
    if (!isValidUrl(profileForm.linkedinUrl)) {
      toast.error("Enter a valid LinkedIn URL.")
      return
    }
    if (!isValidGithubUsername(profileForm.githubUsername)) {
      toast.error("Enter a valid GitHub username.")
      return
    }

    setProfileSaving(true)
    try {
      const updated = await usersApi.updateMe(
        {
          firstName: profileForm.firstName.trim(),
          lastName: profileForm.lastName.trim(),
          phone: trimOrNull(profileForm.phone),
          department: profileForm.department || null,
          preferredTrack: profileForm.preferredTrack || null,
          bio: trimOrNull(profileForm.bio),
          linkedinUrl: trimOrNull(profileForm.linkedinUrl),
          githubUsername: trimOrNull(profileForm.githubUsername),
        },
        accessToken,
      )
      setAuth({ accessToken, user: mapApiUserToUiUser(updated), rememberSession })
      toast.success("Profile updated.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update profile.")
    } finally {
      setProfileSaving(false)
    }
  }

  const uploadProfilePhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""

    if (!file) return
    if (!accessToken) {
      toast.error("Please sign in again before changing your photo.")
      return
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file.")
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Profile photo must be 2MB or smaller.")
      return
    }

    const formData = new FormData()
    formData.append("avatar", file)

    setProfilePhotoUploading(true)
    try {
      const updated = await usersApi.uploadMyAvatar(formData, accessToken)
      setAuth({ accessToken, user: mapApiUserToUiUser(updated), rememberSession })
      toast.success("Profile photo updated.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload profile photo.")
    } finally {
      setProfilePhotoUploading(false)
    }
  }

  const toggleWebsiteNotifications = async (enabled: boolean) => {
    if (!enabled) {
      setNotifications((current) => ({ ...current, websiteNotifications: false }))
      return
    }

    if (typeof window === "undefined" || !("Notification" in window)) {
      toast.error("This browser does not support website notifications.")
      return
    }

    const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission()
    if (permission !== "granted") {
      setNotifications((current) => ({ ...current, websiteNotifications: false }))
      toast.error("Browser notifications were not enabled.")
      return
    }

    setNotifications((current) => ({ ...current, websiteNotifications: true }))
    new Notification("ProjectHub notifications enabled", { body: "You will see browser alerts for new updates." })
  }

  const markSaved = (section: SettingsTab) => {
    setSavedSection(section)
    setTimeout(() => setSavedSection((prev) => (prev === section ? null : prev)), 2000)
  }

  const saveNotifications = async () => {
    setSavingSection("notifications")
    try {
      await saveSettings({ notifications })
      markSaved("notifications")
      toast.success("Notification settings saved.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save notification settings.")
    } finally {
      setSavingSection(null)
    }
  }

  const saveAppearance = async () => {
    setSavingSection("appearance")
    try {
      await saveSettings({ appearance })
      markSaved("appearance")
      toast.success("Appearance settings saved.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save appearance settings.")
    } finally {
      setSavingSection(null)
    }
  }

  const savePrivacy = async () => {
    setSavingSection("privacy")
    try {
      await saveSettings({ privacy })
      markSaved("privacy")
      toast.success("Privacy settings saved.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save privacy settings.")
    } finally {
      setSavingSection(null)
    }
  }

  const handleTwoFactorDialogOpenChange = (open: boolean) => {
    setTwoFactorOpen(open)
    if (open) return

    setTwoFactorPasswordError("")
    setTwoFactorCodeError("")
  }

  const changePassword = async () => {
    if (!isStrongPassword(passwordForm.newPassword)) {
      toast.error("Use 8+ characters with uppercase, number, and special character.")
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("New passwords do not match.")
      return
    }

    setPasswordSaving(true)
    try {
      await authApi.changePassword(passwordForm)
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" })
      toast.success("Password changed.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change password.")
    } finally {
      setPasswordSaving(false)
    }
  }

  const startTwoFactorSetup = async () => {
    const password = twoFactorPassword.trim()

    if (!password) {
      setTwoFactorPasswordError("Enter your current password to continue.")
      return
    }

    setTwoFactorPasswordError("")
    setTwoFactorBusy(true)
    try {
      const result = await authApi.setupTwoFactor({ password })
      setTwoFactorSetup(result)
      setTwoFactorRecoveryCodes([])
      toast.success("Scan the authenticator QR code.")
    } catch (err) {
      setTwoFactorPasswordError(err instanceof Error ? err.message : "We could not confirm that password. Try again.")
    } finally {
      setTwoFactorBusy(false)
    }
  }

  const confirmTwoFactor = async () => {
    const code = twoFactorCode.trim()

    if (!code) {
      setTwoFactorCodeError("Enter the 6-digit code from your authenticator app.")
      return
    }

    if (!/^\d{6}$/.test(code)) {
      setTwoFactorCodeError("Authenticator codes are exactly 6 digits.")
      return
    }

    setTwoFactorCodeError("")
    setTwoFactorBusy(true)
    try {
      const result = await authApi.confirmTwoFactor({ code })
      setTwoFactorRecoveryCodes(result.recoveryCodes)
      await loadSettings()
      toast.success("Two-factor authentication enabled.")
    } catch (err) {
      setTwoFactorCodeError(err instanceof Error ? err.message : "That code did not work. Enter the current 6-digit code from your app.")
    } finally {
      setTwoFactorBusy(false)
    }
  }

  const disableTwoFactor = async () => {
    const hasPassword = disablePassword.trim().length > 0
    const hasVerification = disableCode.trim().length > 0 || disableRecoveryCode.trim().length > 0

    if (!hasPassword || !hasVerification) {
      toast.error("Enter your password and either an authenticator code or a recovery code.")
      return
    }

    setTwoFactorBusy(true)
    try {
      await authApi.disableTwoFactor({
        password: disablePassword,
        code: disableCode.trim() || undefined,
        recoveryCode: disableRecoveryCode.trim() || undefined,
      })
      setDisablePassword("")
      setDisableCode("")
      setDisableRecoveryCode("")
      await loadSettings()
      toast.success("Two-factor authentication disabled.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not disable two-factor authentication.")
    } finally {
      setTwoFactorBusy(false)
    }
  }

  const deleteAccount = async () => {
    setDeleteBusy(true)
    try {
      await usersApi.deleteMe({ email: deleteEmail.trim() })
      logout()
      toast.success("Your account has been deleted.")
      router.replace("/login")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete account.")
    } finally {
      setDeleteBusy(false)
    }
  }

  if (!currentUser) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <Card className="w-full max-w-sm text-center">
          <CardContent className="space-y-3 pt-6">
            <User className="mx-auto h-10 w-10 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Sign in required</h2>
            <p className="text-sm text-muted-foreground">Please sign in to manage settings.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="mx-auto max-w-[96rem] space-y-6 pb-8">
      <motion.div
        variants={itemVariants}
        className="flex flex-col gap-4 border-b border-border/60 pb-5 sm:flex-row sm:items-end sm:justify-between"
      >
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">Manage your profile, alerts, privacy, and sign-in protection.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => loadSettings()} disabled={isLoading} className="w-full sm:w-auto">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Sync
        </Button>
      </motion.div>

      {error ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => loadSettings()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <motion.div variants={itemVariants}>
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-5">
          <div className="-mx-2 overflow-x-auto px-2 sm:mx-0 sm:px-0">
            <TabsList className="inline-flex h-auto min-w-max gap-1 rounded-xl border border-border/60 bg-muted/40 p-1 shadow-sm">
              {SETTINGS_TABS.map((item) => (
                <TabsTrigger key={item.value} value={item.value} className="gap-2 rounded-lg px-3 py-2 text-xs transition data-[state=active]:bg-background data-[state=active]:shadow-sm sm:text-sm">
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="profile" className="mt-0">
            <div className="grid gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
              <Card className={cardClassName}>
                <CardHeader className="pb-3">
                  <CardTitle>Profile preview</CardTitle>
                  <CardDescription>This is how your identity appears across ProjectHub.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5 p-6">
                  <input ref={profilePhotoInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={uploadProfilePhoto} />
                  <div className="flex flex-col items-center text-center">
                    <div className="relative">
                      <Avatar className="h-32 w-32 border-4 border-background shadow-sm">
                        <AvatarImage src={currentAvatarUrl || undefined} alt={currentUser.name} />
                        <AvatarFallback className="bg-primary/10 text-3xl font-semibold text-primary">
                          {currentUser.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <Button
                        type="button"
                        size="icon"
                        className="absolute bottom-1 right-1 h-9 w-9 rounded-full shadow-sm"
                        onClick={() => profilePhotoInputRef.current?.click()}
                        disabled={profilePhotoUploading}
                        aria-label="Upload profile photo"
                      >
                        {profilePhotoUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                      </Button>
                    </div>
                    <div className="mt-4">
                      <p className="text-lg font-semibold">{currentUser.name}</p>
                      <p className="text-sm text-muted-foreground">{currentUser.email}</p>
                    </div>
                  </div>

                  <div className="space-y-4 border-t border-border/60 pt-5">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Bio</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {profileForm.bio.trim() || "No bio added yet."}
                      </p>
                    </div>

                    <div className="grid gap-2">
                      <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
                        <Linkedin className="h-4 w-4 shrink-0 text-primary" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-muted-foreground">LinkedIn</p>
                          {linkedinUrl ? (
                            <a href={linkedinUrl} target="_blank" rel="noreferrer" className="truncate text-sm font-semibold text-primary hover:underline">
                              LinkedIn profile
                            </a>
                          ) : (
                            <p className="truncate text-sm font-medium">Not added</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
                        <Github className="h-4 w-4 shrink-0 text-primary" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-muted-foreground">GitHub</p>
                          {githubProfileUrl ? (
                            <a href={githubProfileUrl} target="_blank" rel="noreferrer" className="truncate text-sm font-semibold text-primary hover:underline">
                              @{githubUsername}
                            </a>
                          ) : (
                            <p className="truncate text-sm font-medium">Not added</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={cardClassName}>
                <CardHeader>
                  <CardTitle>Personal details</CardTitle>
                  <CardDescription>Keep the information others use to recognize and contact you up to date.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="First name" htmlFor="firstName">
                      <Input id="firstName" value={profileForm.firstName} onChange={(event) => updateProfileField("firstName", event.target.value)} />
                    </Field>
                    <Field label="Last name" htmlFor="lastName">
                      <Input id="lastName" value={profileForm.lastName} onChange={(event) => updateProfileField("lastName", event.target.value)} />
                    </Field>
                    <Field label="Email" htmlFor="email">
                      <Input id="email" value={profileForm.email} disabled />
                    </Field>
                    <Field label="Phone" htmlFor="phone">
                      <Input id="phone" value={profileForm.phone} onChange={(event) => updateProfileField("phone", event.target.value)} placeholder="+20 100 000 0000" />
                    </Field>
                    <Field label="Department">
                      <Select value={profileForm.department || "none"} onValueChange={(value) => updateProfileField("department", value === "none" ? "" : (value as Department))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Not set</SelectItem>
                          {DEPARTMENT_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Preferred track">
                      <Select value={profileForm.preferredTrack || "none"} onValueChange={(value) => updateProfileField("preferredTrack", value === "none" ? "" : (value as Track))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select track" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Not set</SelectItem>
                          {TRACK_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>

                  <Field label="Bio" htmlFor="bio">
                    <Textarea id="bio" value={profileForm.bio} maxLength={500} onChange={(event) => updateProfileField("bio", event.target.value)} rows={4} />
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="LinkedIn URL" htmlFor="linkedinUrl">
                      <Input id="linkedinUrl" value={profileForm.linkedinUrl} onChange={(event) => updateProfileField("linkedinUrl", event.target.value)} placeholder="https://linkedin.com/in/name" />
                    </Field>
                    <Field label="GitHub username" htmlFor="githubUsername">
                      <Input id="githubUsername" value={profileForm.githubUsername} onChange={(event) => updateProfileField("githubUsername", event.target.value)} placeholder="octocat" />
                    </Field>
                  </div>

                  <div className={actionRowClassName}>
                    <p className="text-sm text-muted-foreground">Changes appear across your profile after saving.</p>
                    <Button onClick={saveProfile} disabled={!canSaveProfile || profileSaving}>
                      {profileSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save profile
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="notifications" className="mt-0">
            <Card className={cardClassName}>
              <CardHeader>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>Choose where alerts appear and which updates are worth interrupting you.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Master in-app toggle — stored locally, no save needed */}
                <SettingSwitch
                  icon={Bell}
                  label="In-app notifications"
                  helper="Show the bell badge and receive real-time alerts in the app. Turn off to silence the bell entirely. Saved instantly — no need to press Save."
                  checked={inAppNotifications}
                  onCheckedChange={setInAppNotifications}
                />

                <Separator />

                {/* Delivery channels */}
                <div className="space-y-3">
                  <SectionHeader title="Delivery" description="Pick how ProjectHub should reach you." />
                  <div className="grid gap-3 md:grid-cols-3">
                  <SettingSwitch
                    icon={Mail}
                    label="Email"
                    helper="Send copies to your inbox"
                    checked={notifications.emailNotifications}
                    onCheckedChange={(checked) => setNotifications((current) => ({ ...current, emailNotifications: checked }))}
                  />
                  <SettingSwitch
                    icon={Monitor}
                    label="Browser alerts"
                    helper={browserPermission === "denied" ? "Blocked in browser settings" : "Show desktop alerts"}
                    checked={notifications.websiteNotifications}
                    onCheckedChange={toggleWebsiteNotifications}
                  />
                  <SettingSwitch
                    icon={Volume2}
                    label="Sound"
                    helper="Play a short chime"
                    checked={notifications.soundNotifications}
                    onCheckedChange={(checked) => setNotifications((current) => ({ ...current, soundNotifications: checked }))}
                  />
                  </div>
                </div>

                <Separator />

                {/* Category filters */}
                <div className="space-y-3">
                  <SectionHeader title="Topics" description="Keep important academic work visible without turning every update into noise." />
                  <div className="grid gap-3 md:grid-cols-2">
                    <SettingSwitch label="Task reminders" helper="Assignments, approvals, and review requests" checked={notifications.taskReminders} onCheckedChange={(checked) => setNotifications((current) => ({ ...current, taskReminders: checked }))} />
                    <SettingSwitch label="Meeting reminders" helper="Calendar events and scheduled calls" checked={notifications.meetingReminders} onCheckedChange={(checked) => setNotifications((current) => ({ ...current, meetingReminders: checked }))} />
                    <SettingSwitch label="Submission alerts" helper="New and updated project submissions" checked={notifications.submissionAlerts} onCheckedChange={(checked) => setNotifications((current) => ({ ...current, submissionAlerts: checked }))} />
                    <SettingSwitch label="Team updates" helper="Invitations, join requests, and supervisor messages" checked={notifications.teamUpdates} onCheckedChange={(checked) => setNotifications((current) => ({ ...current, teamUpdates: checked }))} />
                    <SettingSwitch label="Mentions" helper="When someone mentions you in a message" checked={notifications.mentionNotifications} onCheckedChange={(checked) => setNotifications((current) => ({ ...current, mentionNotifications: checked }))} />
                    <SettingSwitch label="Deadline warnings" helper="Upcoming due dates on tasks and submissions" checked={notifications.deadlineWarnings} onCheckedChange={(checked) => setNotifications((current) => ({ ...current, deadlineWarnings: checked }))} />
                    <SettingSwitch label="Grade notifications" helper="When grades are posted or updated" checked={notifications.gradeNotifications} onCheckedChange={(checked) => setNotifications((current) => ({ ...current, gradeNotifications: checked }))} />
                    <SettingSwitch label="Weekly digest" helper="A summary email of your week's activity every Monday" checked={notifications.weeklyDigest} onCheckedChange={(checked) => setNotifications((current) => ({ ...current, weeklyDigest: checked }))} />
                  </div>
                </div>

                <div className={actionRowClassName}>
                  <p className="text-sm text-muted-foreground">Delivery and topic changes need to be saved.</p>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button variant="outline" onClick={playNotificationSound} disabled={!notifications.soundNotifications}>
                      <Volume2 className="h-4 w-4" />
                      Test sound
                    </Button>
                    <SettingsSaveButton section="notifications" label="Save notifications" onClick={saveNotifications} isSaving={isSaving} savingSection={savingSection} savedSection={savedSection} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appearance" className="mt-0">
            <Card className={cardClassName}>
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>Tune the interface for your screen, eyes, and working style.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <SectionHeader title="Theme" description="Choose the color mode ProjectHub should use." />
                <div className="grid gap-3 sm:grid-cols-3">
                  <ThemeButton icon={Sun} label="Light" selected={(activeTheme ?? appearance.theme) === "light"} onClick={() => { setTheme("light"); setAppearance((current) => ({ ...current, theme: "light" })) }} />
                  <ThemeButton icon={Moon} label="Dark" selected={(activeTheme ?? appearance.theme) === "dark"} onClick={() => { setTheme("dark"); setAppearance((current) => ({ ...current, theme: "dark" })) }} />
                  <ThemeButton icon={Monitor} label="System" selected={(activeTheme ?? appearance.theme) === "system"} onClick={() => { setTheme("system"); setAppearance((current) => ({ ...current, theme: "system" })) }} />
                </div>

                <div className={panelClassName}>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <Label>Font size</Label>
                      <p className="text-sm text-muted-foreground">Current size: {appearance.fontSize}px</p>
                    </div>
                  </div>
                  <Slider
                    value={[appearance.fontSize]}
                    min={12}
                    max={20}
                    step={1}
                    onValueChange={([value]) => {
                      const size = value ?? appearance.fontSize
                      document.documentElement.style.fontSize = `${size}px`
                      setAppearance((current) => ({ ...current, fontSize: size }))
                    }}
                  />
                </div>

                <div className="space-y-3">
                  <SectionHeader title="Comfort" description="Adjust density, movement, contrast, and navigation." />
                  <div className="grid gap-3 md:grid-cols-2">
                  <SettingSwitch
                    label="Compact mode"
                    helper="Fit more information on each screen"
                    checked={appearance.compactMode}
                    onCheckedChange={(checked) => {
                      document.documentElement.classList.toggle("app-compact", checked)
                      setAppearance((current) => ({ ...current, compactMode: checked }))
                    }}
                  />
                  <SettingSwitch
                    label="Reduced motion"
                    helper="Limit page and component animations"
                    checked={appearance.reducedMotion}
                    onCheckedChange={(checked) => {
                      document.documentElement.classList.toggle("app-reduced-motion", checked)
                      setAppearance((current) => ({ ...current, reducedMotion: checked }))
                    }}
                  />
                  <SettingSwitch
                    label="High contrast"
                    helper="Increase separation between text, borders, and surfaces"
                    checked={appearance.highContrast}
                    onCheckedChange={(checked) => {
                      document.documentElement.classList.toggle("app-high-contrast", checked)
                      setAppearance((current) => ({ ...current, highContrast: checked }))
                    }}
                  />
                  <SettingSwitch
                    label="Sidebar collapsed"
                    helper="Start with the sidebar minimized"
                    checked={appearance.sidebarCollapsed}
                    onCheckedChange={(checked) => {
                      setSidebarCollapsed(checked)
                      setAppearance((current) => ({ ...current, sidebarCollapsed: checked }))
                    }}
                  />
                  </div>
                </div>

                <div className={actionRowClassName}>
                  <p className="text-sm text-muted-foreground">Theme previews apply immediately. Save to keep them.</p>
                  <SettingsSaveButton section="appearance" label="Save appearance" onClick={saveAppearance} isSaving={isSaving} savingSection={savingSection} savedSection={savedSection} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="privacy" className="mt-0">
            <Card className={cardClassName}>
              <CardHeader>
                <CardTitle>Privacy</CardTitle>
                <CardDescription>Control who can find you and which profile details are shared.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <SectionHeader title="Profile visibility" description="Choose who can see your profile in search and directory views." />
                <div className="grid gap-3 md:grid-cols-3">
                  {VISIBILITY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setPrivacy((current) => ({ ...current, profileVisibility: option.value }))}
                      className={cn(
                        "rounded-lg border border-border/60 bg-background p-4 text-left transition hover:border-primary/40 hover:bg-primary/5",
                        privacy.profileVisibility === option.value && "border-primary bg-primary/10 shadow-sm",
                      )}
                    >
                      <p className="font-medium">{option.label}</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{option.helper}</p>
                    </button>
                  ))}
                </div>

                <Separator />

                <div className="space-y-3">
                  <SectionHeader title="Shared details" description="These switches control the extra information people can see." />
                  <div className="grid gap-3 md:grid-cols-2">
                  <SettingSwitch label="Show email" helper="Allow visible profiles to display your email" checked={privacy.showEmail} onCheckedChange={(checked) => setPrivacy((current) => ({ ...current, showEmail: checked }))} />
                  <SettingSwitch label="Show activity" helper="Show recent platform activity where supported" checked={privacy.showActivity} onCheckedChange={(checked) => setPrivacy((current) => ({ ...current, showActivity: checked }))} />
                  <SettingSwitch label="Show team" helper="Let people see your current team" checked={privacy.showTeam} onCheckedChange={(checked) => setPrivacy((current) => ({ ...current, showTeam: checked }))} />
                  <SettingSwitch label="Show online status" helper="Show whether you are currently active" checked={privacy.showOnlineStatus} onCheckedChange={(checked) => setPrivacy((current) => ({ ...current, showOnlineStatus: checked }))} />
                  </div>
                </div>

                <div className={actionRowClassName}>
                  <p className="text-sm text-muted-foreground">Privacy changes affect future profile and search views.</p>
                  <SettingsSaveButton section="privacy" label="Save privacy" onClick={savePrivacy} isSaving={isSaving} savingSection={savingSection} savedSection={savedSection} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="mt-0">
            <div className="grid gap-5 xl:grid-cols-2">
              <Card className={cardClassName}>
                <CardHeader>
                  <CardTitle>Password</CardTitle>
                  <CardDescription>Use a strong password that you do not use anywhere else.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Field label="Current password" htmlFor="currentPassword">
                    <Input id="currentPassword" type="password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))} />
                  </Field>
                  <Field label="New password" htmlFor="newPassword">
                    <Input id="newPassword" type="password" value={passwordForm.newPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))} />
                  </Field>
                  <Field label="Confirm password" htmlFor="confirmPassword">
                    <Input id="confirmPassword" type="password" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))} />
                  </Field>
                  <div className={actionRowClassName}>
                    <p className="text-sm text-muted-foreground">Minimum 8 characters with uppercase, number, and special character.</p>
                    <Button onClick={changePassword} disabled={passwordSaving} className="w-full sm:w-auto">
                      {passwordSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Change password
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className={cardClassName}>
                <CardHeader>
                  <CardTitle>Authenticator app</CardTitle>
                  <CardDescription>Add or remove the extra sign-in code from your account.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col gap-4 rounded-lg border border-border/60 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn("rounded-full p-2", security.twoFactorEnabled ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground")}>
                        <Smartphone className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium">{security.twoFactorEnabled ? "Authenticator app is on" : "Authenticator app is off"}</p>
                        <p className="text-sm text-muted-foreground">
                          {security.twoFactorEnabled ? "Sign-ins require a 6-digit app code." : "Turn it on to require a 6-digit app code when signing in."}
                        </p>
                      </div>
                    </div>
                    {!security.twoFactorEnabled ? (
                      <Button onClick={() => setTwoFactorOpen(true)} className="w-full sm:w-auto">
                        Set up
                      </Button>
                    ) : null}
                  </div>

                  {security.twoFactorEnabled ? (
                    <div className="space-y-4 rounded-lg border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
                      <div>
                        <p className="font-medium">Turn off authenticator app</p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          Enter your account password, then use either your current authenticator code or one saved recovery code. You do not need both codes.
                        </p>
                      </div>

                      <Field label="Account password" htmlFor="disablePassword">
                        <Input
                          id="disablePassword"
                          type="password"
                          value={disablePassword}
                          onChange={(event) => setDisablePassword(event.target.value)}
                          placeholder="Enter your current password"
                        />
                      </Field>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <Label>Choose one verification method</Label>
                          <span className="rounded-full bg-background px-2 py-1 text-xs font-medium text-muted-foreground ring-1 ring-border">One required</span>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                          <div className="rounded-lg border bg-background p-3">
                            <Field label="Authenticator code" htmlFor="disableCode">
                              <Input
                                id="disableCode"
                                value={disableCode}
                                onChange={(event) => setDisableCode(event.target.value)}
                                inputMode="numeric"
                                maxLength={6}
                                placeholder="6-digit code"
                              />
                            </Field>
                          </div>
                          <span className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">or</span>
                          <div className="rounded-lg border bg-background p-3">
                            <Field label="Recovery code" htmlFor="disableRecoveryCode">
                              <Input
                                id="disableRecoveryCode"
                                value={disableRecoveryCode}
                                onChange={(event) => setDisableRecoveryCode(event.target.value)}
                                placeholder="Paste one recovery code"
                              />
                            </Field>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs leading-5 text-muted-foreground">After this, your next sign-in will only use your password.</p>
                        <Button variant="destructive" onClick={disableTwoFactor} disabled={twoFactorBusy || !canDisableTwoFactor} className="w-full sm:w-auto">
                          {twoFactorBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                          Turn off authenticator
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card className={cn(cardClassName, "border-destructive/30 xl:col-span-2")}>
                <CardHeader>
                  <CardTitle>Delete account</CardTitle>
                  <CardDescription>Permanently remove your account, private settings, and profile access.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
                  <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                    <Trash2 className="h-4 w-4" />
                    Delete account
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </motion.div>

      <Dialog open={twoFactorOpen} onOpenChange={handleTwoFactorDialogOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Set up two-factor authentication</DialogTitle>
            <DialogDescription>
              Each time you sign in you will be asked for a 6-digit code generated by an app on your phone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {!twoFactorSetup ? (
              <>
                {/* What you need */}
                <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                  <p className="text-sm font-semibold">Before you start — install an authenticator app</p>
                  <p className="text-sm text-muted-foreground">
                    An authenticator app generates a new 6-digit code every 30 seconds. You need one of these on your phone:
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li><span className="font-medium text-foreground">Google Authenticator</span> — search for it in the App Store or Google Play</li>
                    <li><span className="font-medium text-foreground">Authy</span> — authy.com (also backs up your codes)</li>
                    <li><span className="font-medium text-foreground">Microsoft Authenticator</span> — works on iOS and Android</li>
                  </ul>
                </div>

                <Field label="Confirm your password to continue" htmlFor="twoFactorPassword">
                  <Input
                    id="twoFactorPassword"
                    type="password"
                    value={twoFactorPassword}
                    onChange={(event) => {
                      setTwoFactorPassword(event.target.value)
                      if (twoFactorPasswordError) setTwoFactorPasswordError("")
                    }}
                    onBlur={() => {
                      if (!twoFactorPassword.trim()) setTwoFactorPasswordError("Enter your current password to continue.")
                    }}
                    placeholder="Your current password"
                    aria-invalid={Boolean(twoFactorPasswordError)}
                    aria-describedby={twoFactorPasswordError ? "twoFactorPasswordError" : undefined}
                    className={cn(twoFactorPasswordError && "border-destructive focus-visible:ring-destructive/30")}
                  />
                  <FieldError id="twoFactorPasswordError" message={twoFactorPasswordError} />
                </Field>
              </>
            ) : twoFactorRecoveryCodes.length > 0 ? (
              /* Step 3 — show recovery codes */
              <div className="space-y-3">
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
                  <p className="mb-1 text-sm font-semibold text-emerald-700 dark:text-emerald-400">Two-factor authentication is now enabled!</p>
                  <p className="text-sm text-muted-foreground">
                    Save these recovery codes somewhere safe. If you ever lose access to your authenticator app, each code can be used once to sign in.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {twoFactorRecoveryCodes.map((code) => (
                    <code key={code} className="rounded border bg-muted px-3 py-1.5 text-sm font-mono text-center">
                      {code}
                    </code>
                  ))}
                </div>
              </div>
            ) : (
              /* Step 2 — scan QR and enter code */
              <>
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Step 1 — Scan this QR code with your authenticator app</p>
                  <div className="rounded-lg border bg-background p-3">
                    <img src={twoFactorSetup.qrCodeDataUrl} alt="Authenticator QR code" className="mx-auto h-48 w-48" />
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Can't scan? Enter this key manually instead</p>
                    <div className="mt-2 flex items-center gap-2">
                      <code className="min-w-0 flex-1 break-all rounded bg-muted px-2 py-1 text-xs">{twoFactorSetup.manualEntryKey}</code>
                      <Button variant="outline" size="icon" onClick={() => navigator.clipboard.writeText(twoFactorSetup.manualEntryKey)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-semibold">Step 2 — Enter the 6-digit code shown in your app</p>
                  <p className="text-xs text-muted-foreground">The code in your app changes every 30 seconds — enter the current one shown.</p>
                  <Input
                    id="twoFactorCode"
                    value={twoFactorCode}
                    onChange={(event) => {
                      setTwoFactorCode(event.target.value.replace(/\D/g, ""))
                      if (twoFactorCodeError) setTwoFactorCodeError("")
                    }}
                    onBlur={() => {
                      const code = twoFactorCode.trim()
                      if (code && code.length !== 6) setTwoFactorCodeError("Authenticator codes are exactly 6 digits.")
                    }}
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    aria-invalid={Boolean(twoFactorCodeError)}
                    aria-describedby={twoFactorCodeError ? "twoFactorCodeError" : undefined}
                    className={cn(
                      "text-center text-xl tracking-[0.5em] font-mono",
                      twoFactorCodeError && "border-destructive focus-visible:ring-destructive/30",
                    )}
                  />
                  <FieldError id="twoFactorCodeError" message={twoFactorCodeError} />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTwoFactorOpen(false)}>
              {twoFactorRecoveryCodes.length > 0 ? "Done" : "Cancel"}
            </Button>
            {!twoFactorSetup ? (
              <Button onClick={startTwoFactorSetup} disabled={twoFactorBusy}>
                {twoFactorBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
                Continue
              </Button>
            ) : twoFactorRecoveryCodes.length === 0 ? (
              <Button onClick={confirmTwoFactor} disabled={twoFactorBusy}>
                {twoFactorBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Verify &amp; enable
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete account</DialogTitle>
            <DialogDescription>Enter your account email to confirm permanent deletion.</DialogDescription>
          </DialogHeader>
          <Field label="Email" htmlFor="deleteEmail">
            <Input id="deleteEmail" value={deleteEmail} onChange={(event) => setDeleteEmail(event.target.value)} placeholder={currentUser.email} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteAccount} disabled={deleteBusy || deleteEmail.trim().toLowerCase() !== currentUser.email.toLowerCase()}>
              {deleteBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}

function FieldError({ id, message }: { id: string; message: string }) {
  if (!message) return null

  return (
    <p id={id} className="flex items-start gap-2 text-sm leading-5 text-destructive">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </p>
  )
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  )
}

function SettingSwitch({
  label,
  helper,
  checked,
  onCheckedChange,
  icon: Icon,
}: {
  label: string
  helper?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  icon?: typeof Bell
}) {
  return (
    <div className="flex min-h-16 items-center justify-between gap-4 rounded-lg border border-border/60 bg-background p-4 transition-colors hover:border-primary/30 hover:bg-muted/20">
      <div className="flex min-w-0 items-center gap-3">
        {Icon ? (
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Icon className="h-4 w-4" />
          </div>
        ) : null}
        <div className="min-w-0">
          <p className="font-medium">{label}</p>
          {helper ? <p className="mt-1 text-sm leading-5 text-muted-foreground">{helper}</p> : null}
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

function SettingsSaveButton({
  section,
  label,
  onClick,
  isSaving,
  savingSection,
  savedSection,
  className,
}: {
  section: SettingsTab
  label: string
  onClick: () => void
  isSaving: boolean
  savingSection: SettingsTab | null
  savedSection: SettingsTab | null
  className?: string
}) {
  const loading = isSaving && savingSection === section
  const saved = savedSection === section && !isSaving
  return (
    <Button onClick={onClick} disabled={isSaving} className={cn("min-w-[9rem] transition-all", className)}>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : saved ? (
        <Check className="h-4 w-4" />
      ) : (
        <Save className="h-4 w-4" />
      )}
      {loading ? "Saving…" : saved ? "Saved!" : label}
    </Button>
  )
}

function ThemeButton({
  icon: Icon,
  label,
  selected,
  onClick,
}: {
  icon: typeof Sun
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-between rounded-lg border border-border/60 bg-background p-4 text-left transition hover:border-primary/40 hover:bg-primary/5",
        selected && "border-primary bg-primary/10 shadow-sm",
      )}
    >
      <span className="flex items-center gap-3 font-medium">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      {selected ? <Check className="h-4 w-4 text-primary" /> : null}
    </button>
  )
}
