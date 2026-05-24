"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowRight,
  Hash,
  Loader2,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  Sparkles,
  Sun,
  Users,
  X,
} from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"
import { NotificationCenter } from "@/components/features/notification-center"
import { teamsApi } from "@/lib/api/teams"
import type { ApiDirectoryUser, ApiTeamSummary } from "@/lib/api/types"
import { usersApi } from "@/lib/api/users"
import { formatRoleLabel, getAvatarInitial, getFullName } from "@/lib/team-display"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/lib/stores/auth-store"
import { useUIStore } from "@/lib/stores/ui-store"

const QUICK_RESULT_LIMIT = 4
const MIN_LIVE_SEARCH_LENGTH = 2

type SearchSuggestion = {
  key: string
  href: string
  kind: "user" | "team"
  title: string
  subtitle: string
  tertiary: string
  badgeLabel: string
  avatarUrl?: string | null
  avatarFallback: string
}

export function AppTopbar() {
  const { toggleSidebar, isMobileSidebarOpen, toggleMobileSidebar } = useUIStore()
  const { currentUser, logout } = useAuthStore()
  const { resolvedTheme, setTheme } = useTheme()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [showMobileSearch, setShowMobileSearch] = useState(false)
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)
  const [logoutProgress, setLogoutProgress] = useState(0)
  const [searchQuery, setSearchQuery] = useState("")
  const [desktopSearchFocused, setDesktopSearchFocused] = useState(false)
  const [mobileSearchFocused, setMobileSearchFocused] = useState(false)
  const [quickUsers, setQuickUsers] = useState<ApiDirectoryUser[]>([])
  const [quickTeams, setQuickTeams] = useState<ApiTeamSummary[]>([])
  const [quickUserTotal, setQuickUserTotal] = useState(0)
  const [quickTeamTotal, setQuickTeamTotal] = useState(0)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState("")
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const desktopBlurTimeoutRef = useRef<number | null>(null)

  const displayName =
    `${currentUser?.firstName ?? ""} ${currentUser?.lastName ?? ""}`.trim() ||
    currentUser?.name ||
    currentUser?.email ||
    "User"

  const avatarInitial = (currentUser?.firstName || currentUser?.name || currentUser?.email || "U")
    .trim()
    .charAt(0)
    .toUpperCase()
  const currentAvatarUrl = currentUser?.avatar || currentUser?.avatarUrl
  const getRoleBadge = (role: string) => {
    const badges = {
      admin: { label: "Admin", variant: "default" as const },
      doctor: { label: "Supervisor", variant: "secondary" as const },
      ta: { label: "TA", variant: "secondary" as const },
      support: { label: "Support", variant: "secondary" as const },
      leader: { label: "Leader", variant: "outline" as const },
      member: { label: "Member", variant: "outline" as const },
    }

    return badges[role as keyof typeof badges] || badges.member
  }

  const badge = getRoleBadge(currentUser?.role || "member")

  const queryFromUrl = searchParams.get("q") ?? ""
  const typeFromUrl = searchParams.get("type")
  const activeSearchType = typeFromUrl === "users" || typeFromUrl === "teams" ? typeFromUrl : "all"
  const isSearchPage = pathname === "/dashboard/search"
  const trimmedQuery = searchQuery.trim()
  const hasLiveQuery = trimmedQuery.length >= MIN_LIVE_SEARCH_LENGTH

  useEffect(() => {
    if (isSearchPage && !desktopSearchFocused && !mobileSearchFocused) {
      setSearchQuery(queryFromUrl)
    }
  }, [desktopSearchFocused, isSearchPage, mobileSearchFocused, queryFromUrl])

  useEffect(() => {
    if (!isSearchPage) return

    const trimmedUrlQuery = queryFromUrl.trim()
    if (trimmedQuery === trimmedUrlQuery) return

    const timer = window.setTimeout(() => {
      const params = new URLSearchParams()

      if (trimmedQuery) {
        params.set("q", trimmedQuery)

        if (activeSearchType !== "all") {
          params.set("type", activeSearchType)
        }
      }

      const nextQuery = params.toString()
      router.replace(nextQuery ? `/dashboard/search?${nextQuery}` : "/dashboard/search")
    }, 250)

    return () => window.clearTimeout(timer)
  }, [activeSearchType, isSearchPage, queryFromUrl, router, trimmedQuery])

  useEffect(() => {
    if (!hasLiveQuery) {
      setQuickUsers([])
      setQuickTeams([])
      setQuickUserTotal(0)
      setQuickTeamTotal(0)
      setSearchError("")
      setSearchLoading(false)
      setHighlightedIndex(-1)
      return
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      setSearchLoading(true)
      setSearchError("")

      Promise.all([
        usersApi.directory({ search: trimmedQuery, limit: QUICK_RESULT_LIMIT, page: 1 }),
        teamsApi.list({ search: trimmedQuery, limit: QUICK_RESULT_LIMIT, page: 1 }),
      ])
        .then(([userResult, teamResult]) => {
          if (cancelled) return
          setQuickUsers(userResult.items)
          setQuickTeams(teamResult.items)
          setQuickUserTotal(userResult.meta.total)
          setQuickTeamTotal(teamResult.meta.total)
          setHighlightedIndex(-1)
        })
        .catch((error: unknown) => {
          if (cancelled) return
          setSearchError(error instanceof Error ? error.message : "Couldn't search right now.")
          setQuickUsers([])
          setQuickTeams([])
          setQuickUserTotal(0)
          setQuickTeamTotal(0)
          setHighlightedIndex(-1)
        })
        .finally(() => {
          if (!cancelled) setSearchLoading(false)
        })
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [hasLiveQuery, trimmedQuery])

  const suggestions = useMemo<SearchSuggestion[]>(() => {
    const userSuggestions = quickUsers.map((user) => ({
      key: `user-${user.id}`,
      href: `/dashboard/users/${user.id}`,
      kind: "user" as const,
      title: getFullName(user),
      subtitle: user.academicId ? `Academic ID ${user.academicId}` : (user.email ?? "Email hidden"),
      tertiary: user.currentTeam
        ? `Team ${user.currentTeam.name}`
        : user.bio?.trim() || formatRoleLabel(user.role),
      badgeLabel: formatRoleLabel(user.role),
      avatarUrl: user.avatarUrl,
      avatarFallback: getAvatarInitial(user),
    }))

    const teamSuggestions = quickTeams.map((team) => ({
      key: `team-${team.id}`,
      href: `/dashboard/teams/${team.id}`,
      kind: "team" as const,
      title: team.name,
      subtitle: `Leader ${getFullName(team.leader)}`,
      tertiary: `${team.memberCount}/${team.maxMembers} members`,
      badgeLabel: "Team",
      avatarFallback: getAvatarInitial(team.leader),
    }))

    return [...userSuggestions, ...teamSuggestions]
  }, [quickTeams, quickUsers])

  const showDesktopSuggestions = desktopSearchFocused && hasLiveQuery
  const showMobileSuggestions = showMobileSearch && mobileSearchFocused && hasLiveQuery

  const clearDesktopBlurTimeout = () => {
    if (desktopBlurTimeoutRef.current !== null) {
      window.clearTimeout(desktopBlurTimeoutRef.current)
      desktopBlurTimeoutRef.current = null
    }
  }

  const handleDesktopSearchFocus = () => {
    clearDesktopBlurTimeout()
    setDesktopSearchFocused(true)
  }

  const handleDesktopSearchBlur = () => {
    clearDesktopBlurTimeout()
    desktopBlurTimeoutRef.current = window.setTimeout(() => {
      setDesktopSearchFocused(false)
      setHighlightedIndex(-1)
    }, 140)
  }

  const closeSearchSurfaces = () => {
    clearDesktopBlurTimeout()
    setDesktopSearchFocused(false)
    setMobileSearchFocused(false)
    setShowMobileSearch(false)
    setHighlightedIndex(-1)
  }

  useEffect(() => {
    return () => {
      clearDesktopBlurTimeout()
    }
  }, [])

  const openSearch = (value = searchQuery) => {
    const trimmed = value.trim()
    closeSearchSurfaces()
    if (isSearchPage) {
      const params = new URLSearchParams()

      if (trimmed) {
        params.set("q", trimmed)

        if (activeSearchType !== "all") {
          params.set("type", activeSearchType)
        }
      }

      const nextQuery = params.toString()
      router.replace(nextQuery ? `/dashboard/search?${nextQuery}` : "/dashboard/search")
      return
    }

    router.push(trimmed ? `/dashboard/search?q=${encodeURIComponent(trimmed)}&type=all` : "/dashboard/search")
  }

  const openSuggestion = (href: string) => {
    closeSearchSurfaces()
    router.push(href)
  }

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault()
      closeSearchSurfaces()
      return
    }

    if (!hasLiveQuery) {
      if (event.key === "Enter") {
        event.preventDefault()
        openSearch()
      }
      return
    }

    if (!suggestions.length) {
      if (event.key === "Enter") {
        event.preventDefault()
        openSearch()
      }
      return
    }

    if (event.key === "ArrowDown") {
      event.preventDefault()
      setHighlightedIndex((current) => (current >= suggestions.length - 1 ? 0 : current + 1))
      return
    }

    if (event.key === "ArrowUp") {
      event.preventDefault()
      setHighlightedIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1))
      return
    }

    if (event.key === "Enter") {
      event.preventDefault()
      if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
        openSuggestion(suggestions[highlightedIndex].href)
        return
      }
      openSearch()
    }
  }

  const handleLogout = () => {
    setShowLogoutDialog(true)
    setLogoutProgress(0)

    const duration = 1200
    const interval = 20
    const increment = 100 / (duration / interval)

    const timer = setInterval(() => {
      setLogoutProgress((previous) => {
        if (previous >= 100) {
          clearInterval(timer)
          return 100
        }
        return previous + increment
      })
    }, interval)

    setTimeout(() => {
      logout()
      router.push("/login")
    }, duration)
  }

  return (
    <>
      <Dialog open={showLogoutDialog} onOpenChange={() => {}}>
        <DialogContent className="mx-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border shadow-lg" showCloseButton={false}>
          <DialogTitle className="sr-only">Signing out</DialogTitle>
          <DialogDescription className="sr-only">Signing out of your account</DialogDescription>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <LogOut className="h-5 w-5 text-muted-foreground" />
            </div>
            <h3 className="mb-1 text-base font-medium">Signing out</h3>
            <p className="mb-4 text-sm text-muted-foreground">Thank you for using ProjectHub</p>
            <div className="w-full max-w-[200px]">
              <Progress value={logoutProgress} className="h-1" />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-2 glass safe-area-top xs:px-3 sm:px-4"
      >
        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMobileSidebar}
            className="h-10 w-10 shrink-0 rounded-lg touch-target"
          >
            {isMobileSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </motion.div>

        <motion.div whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }} className="hidden lg:block">
          <Button variant="ghost" size="icon" onClick={toggleSidebar} className="h-10 w-10 shrink-0 rounded-xl">
            <Menu className="h-5 w-5" />
          </Button>
        </motion.div>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-lg touch-target sm:hidden"
            onClick={() => setShowMobileSearch((open) => !open)}
          >
            <Search className="h-5 w-5" />
          </Button>

          <Popover
            open={showDesktopSuggestions}
            onOpenChange={(open) => {
              if (!open) {
                setDesktopSearchFocused(false)
                setHighlightedIndex(-1)
              }
            }}
          >
            <PopoverAnchor asChild>
              <motion.div
                className="relative hidden w-full max-w-xs sm:block md:max-w-md"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: "100%", opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search users, IDs, and teams..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onFocus={handleDesktopSearchFocus}
                  onBlur={handleDesktopSearchBlur}
                  onKeyDown={handleSearchKeyDown}
                  className="h-10 rounded-xl border-border/60 pl-9 text-sm glass transition-all focus-visible:border-primary/40 focus-visible:ring-primary/10"
                />
              </motion.div>
            </PopoverAnchor>
            <PopoverContent
              align="start"
              sideOffset={10}
              onOpenAutoFocus={(event) => event.preventDefault()}
              onCloseAutoFocus={(event) => event.preventDefault()}
              className="hidden w-[min(36rem,calc(100vw-2rem))] p-0 sm:block"
            >
              <SearchSuggestionsPanel
                query={trimmedQuery}
                isLoading={searchLoading}
                error={searchError}
                users={quickUsers}
                teams={quickTeams}
                userTotal={quickUserTotal}
                teamTotal={quickTeamTotal}
                highlightedIndex={highlightedIndex}
                onHighlight={setHighlightedIndex}
                onSelect={openSuggestion}
                onOpenAll={() => openSearch()}
              />
            </PopoverContent>
          </Popover>
        </div>

        {showMobileSearch && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute left-0 right-0 top-full z-50 border-b p-3 glass sm:hidden"
          >
            <div className="space-y-3 rounded-2xl border border-border/60 bg-background/95 p-3 shadow-lg">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search users, IDs, and teams..."
                  autoFocus
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onFocus={() => setMobileSearchFocused(true)}
                  onBlur={() => window.setTimeout(() => setMobileSearchFocused(false), 140)}
                  onKeyDown={handleSearchKeyDown}
                  className="h-11 rounded-xl border-border/50 pl-10 pr-10 text-base glass focus-visible:ring-primary/50"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2"
                  onClick={() => setShowMobileSearch(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {showMobileSuggestions && (
                <SearchSuggestionsPanel
                  query={trimmedQuery}
                  isLoading={searchLoading}
                  error={searchError}
                  users={quickUsers}
                  teams={quickTeams}
                  userTotal={quickUserTotal}
                  teamTotal={quickTeamTotal}
                  highlightedIndex={highlightedIndex}
                  onHighlight={setHighlightedIndex}
                  onSelect={openSuggestion}
                  onOpenAll={() => openSearch()}
                  isMobile
                />
              )}
            </div>
          </motion.div>
        )}

        <motion.div
          className="flex items-center gap-1 xs:gap-1.5 sm:gap-2"
          initial={{ x: 100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <NotificationCenter />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className="hidden sm:block">
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl">
                  {resolvedTheme === "dark" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                </Button>
              </motion.div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl border-border/50 glass-card">
              <DropdownMenuItem onClick={() => setTheme("light")} className="rounded-lg font-medium text-foreground/90 focus:bg-primary/15 focus:text-primary data-highlighted:bg-primary/15 data-highlighted:text-primary">
                <Sun className="mr-2 h-4 w-4" />
                Light
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")} className="rounded-lg font-medium text-foreground/90 focus:bg-primary/15 focus:text-primary data-highlighted:bg-primary/15 data-highlighted:text-primary">
                <Moon className="mr-2 h-4 w-4" />
                Dark
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")} className="rounded-lg font-medium text-foreground/90 focus:bg-primary/15 focus:text-primary data-highlighted:bg-primary/15 data-highlighted:text-primary">
                <Sparkles className="mr-2 h-4 w-4" />
                System
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-border/50 px-1.5 py-1.5 transition-all glass-card hover:border-primary/50 xs:px-2 sm:gap-2 sm:px-3 sm:py-2"
              >
                <Avatar className="h-7 w-7 sm:h-8 sm:w-8">
                  <AvatarImage src={currentAvatarUrl || undefined} alt={displayName} />
                  <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary sm:text-sm">
                    {avatarInitial}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden text-left sm:block">
                  <div className="max-w-[80px] truncate text-sm font-medium lg:max-w-[100px]">{displayName}</div>
                  <div className="text-xs text-muted-foreground">{badge.label}</div>
                </div>
              </motion.button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl border-border/50 glass-card">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">{currentUser?.email}</p>
                  <Badge className="mt-1 w-fit text-xs" variant={badge.variant}>
                    {badge.label}
                  </Badge>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="rounded-lg py-2.5 text-sm" onClick={() => router.push("/dashboard/settings")}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="sm:hidden" />
              <DropdownMenuItem
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                className="rounded-lg py-2.5 text-sm sm:hidden"
              >
                {resolvedTheme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                {resolvedTheme === "dark" ? "Light Mode" : "Dark Mode"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="rounded-lg py-2.5 text-sm text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </motion.div>
      </motion.header>
    </>
  )
}

function SearchSuggestionsPanel({
  query,
  isLoading,
  error,
  users,
  teams,
  userTotal,
  teamTotal,
  highlightedIndex,
  onHighlight,
  onSelect,
  onOpenAll,
  isMobile = false,
}: {
  query: string
  isLoading: boolean
  error: string
  users: ApiDirectoryUser[]
  teams: ApiTeamSummary[]
  userTotal: number
  teamTotal: number
  highlightedIndex: number
  onHighlight: (index: number) => void
  onSelect: (href: string) => void
  onOpenAll: () => void
  isMobile?: boolean
}) {
  const hasResults = users.length > 0 || teams.length > 0
  const totalResults = userTotal + teamTotal

  const getRoleColor = (role: string) => {
    switch (role) {
      case "doctor":
      case "ta":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
      case "admin":
        return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
      default:
        return "bg-primary/10 text-primary border-primary/20"
    }
  }

  return (
    <div
      className={cn(
        "flex max-h-[min(32rem,calc(100vh-5.5rem))] flex-col overflow-hidden rounded-2xl border border-border/60 bg-background/98 backdrop-blur-md",
        !isMobile && "shadow-2xl shadow-primary/5",
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-muted/20 px-4 py-3">
        <div className="space-y-0.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80">Search Results</p>
          <p className="text-xs font-medium text-muted-foreground">
            {hasResults ? (
              <>
                <span className="text-foreground">{totalResults}</span> quick matches
              </>
            ) : (
              "Find people, IDs, or team workspaces."
            )}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="h-8 rounded-lg bg-background/50 px-3 text-[11px] font-bold shadow-sm transition-all hover:bg-background"
          onMouseDown={(event) => event.preventDefault()}
          onClick={onOpenAll}
        >
          View all results
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-3 px-4 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="font-medium animate-pulse">Searching the directory...</span>
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 px-4 py-8 text-sm text-destructive">
          <X className="h-4 w-4" />
          <p className="font-medium">{error}</p>
        </div>
      ) : !hasResults ? (
        <div className="space-y-3 px-4 py-10 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground">
            <Search className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold">No quick matches for “{query}”</p>
            <p className="text-xs leading-relaxed text-muted-foreground">Try a shorter name, an academic ID, or open the full search page.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3 custom-scrollbar">
            <div className="space-y-6 pb-2">
              <AnimatePresence mode="popLayout">
                {users.length > 0 && (
                  <motion.div 
                    key="search-users-section"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-1.5"
                  >
                    <div className="flex items-center gap-2 px-2 pb-1">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">Users</p>
                      <div className="h-px flex-1 bg-border/40" />
                    </div>
                    {users.map((user, index) => (
                      <motion.button
                        key={user.id}
                        initial={{ opacity: 0, x: -5 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.04 }}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onMouseEnter={() => onHighlight(index)}
                        onClick={() => onSelect(`/dashboard/users/${user.id}`)}
                        className={cn(
                          "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-200",
                          highlightedIndex === index 
                            ? "bg-primary/[0.08] shadow-sm shadow-primary/5" 
                            : "hover:bg-muted/40",
                        )}
                      >
                        <div className="relative shrink-0">
                          <Avatar className="h-10 w-10 border-2 border-background shadow-sm ring-1 ring-border/50">
                            <AvatarImage src={user.avatarUrl || "/placeholder.svg"} />
                            <AvatarFallback className="bg-primary/5 font-bold text-primary">{getAvatarInitial(user)}</AvatarFallback>
                          </Avatar>
                          {highlightedIndex === index && (
                            <motion.div 
                              layoutId="search-user-active"
                              className="absolute -inset-1 rounded-full border border-primary/20"
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-bold text-foreground group-hover:text-primary transition-colors">{getFullName(user)}</p>
                            <Badge variant="outline" className={cn("rounded-md px-1.5 py-0 text-[9px] font-bold uppercase tracking-wider", getRoleColor(user.role))}>
                              {formatRoleLabel(user.role)}
                            </Badge>
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                            <span className="flex items-center gap-1 opacity-80">
                              <Hash className="h-3 w-3" />
                              {user.academicId || "No ID"}
                            </span>
                            <span className="h-1 w-1 rounded-full bg-border" />
                            <span className="truncate">{user.currentTeam ? user.currentTeam.name : "Unassigned"}</span>
                          </div>
                        </div>
                        <div className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-lg transition-all",
                          highlightedIndex === index ? "bg-primary text-primary-foreground translate-x-0 opacity-100" : "opacity-0 -translate-x-2"
                        )}>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </div>
                      </motion.button>
                    ))}
                  </motion.div>
                )}

                {teams.length > 0 && (
                  <motion.div 
                    key="search-teams-section"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: users.length * 0.04 }}
                    className="space-y-1.5"
                  >
                    <div className="flex items-center gap-2 px-2 pb-1">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">Teams</p>
                      <div className="h-px flex-1 bg-border/40" />
                    </div>
                    {teams.map((team, index) => {
                      const suggestionIndex = users.length + index

                      return (
                        <motion.button
                          key={team.id}
                          initial={{ opacity: 0, x: -5 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: suggestionIndex * 0.04 }}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onMouseEnter={() => onHighlight(suggestionIndex)}
                          onClick={() => onSelect(`/dashboard/teams/${team.id}`)}
                          className={cn(
                            "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-200",
                            highlightedIndex === suggestionIndex 
                              ? "bg-primary/[0.08] shadow-sm shadow-primary/5" 
                              : "hover:bg-muted/40",
                          )}
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-sm transition-transform group-hover:scale-105">
                            <Users className="h-4.5 w-4.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-sm font-bold text-foreground group-hover:text-primary transition-colors">{team.name}</p>
                              <Badge variant="outline" className="rounded-md border-border/50 bg-muted/30 px-1.5 py-0 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                                Team
                              </Badge>
                            </div>
                            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                              <span className="truncate opacity-90">Lead: {getFullName(team.leader)}</span>
                              <span className="h-1 w-1 rounded-full bg-border" />
                              <span>{team.memberCount}/{team.maxMembers} members</span>
                            </div>
                          </div>
                          <div className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-lg transition-all",
                            highlightedIndex === suggestionIndex ? "bg-primary text-primary-foreground translate-x-0 opacity-100" : "opacity-0 -translate-x-2"
                          )}>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </div>
                        </motion.button>
                      )
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {!isMobile && (
            <div className="flex items-center gap-4 border-t border-border/60 bg-muted/10 px-4 py-2 text-[10px] font-medium text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <kbd className="flex h-4 w-4 items-center justify-center rounded border border-border/60 bg-background font-sans text-[9px]">↵</kbd>
                <span>to select</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex gap-0.5">
                  <kbd className="flex h-4 w-4 items-center justify-center rounded border border-border/60 bg-background font-sans text-[9px]">↑</kbd>
                  <kbd className="flex h-4 w-4 items-center justify-center rounded border border-border/60 bg-background font-sans text-[9px]">↓</kbd>
                </div>
                <span>to navigate</span>
              </div>
              <div className="flex items-center gap-1.5">
                <kbd className="flex h-4 w-7 items-center justify-center rounded border border-border/60 bg-background font-sans text-[9px]">ESC</kbd>
                <span>to close</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
