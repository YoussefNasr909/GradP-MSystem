"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  FileText,
  Video,
  MessageSquare,
  Award,
  BarChart3,
  ShieldCheck,
  Upload,
  GraduationCap,
  ChevronDown,
  CheckCircle2,
  Crown,
  Calendar,
  TrendingUp,
  BookOpen,
  MessageCircle,
  Timer,
  Github,
  FolderOpen,
  AlertTriangle,
  ClipboardList,
  Trophy,
  X,
  Activity,
  HelpCircle,
  LifeBuoy,
  StickyNote,
  Megaphone,
  Wand2,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useAuthStore } from "@/lib/stores/auth-store"
import { useUIStore } from "@/lib/stores/ui-store"
import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { useMyTeamState } from "@/lib/hooks/use-my-team-state"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

type Role = "admin" | "doctor" | "ta" | "support" | "leader" | "member"

type NavigationItem = {
  name: string
  href: string
  icon: LucideIcon
  roles: Role[]
}

const navigationItems: NavigationItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["admin", "doctor", "ta", "support", "leader", "member"] },
  { name: "Supervision", href: "/dashboard/supervisor-toolkit", icon: StickyNote, roles: ["doctor", "ta"] },
  { name: "User Management", href: "/dashboard/admin", icon: ShieldCheck, roles: ["admin"] },
  { name: "My Team", href: "/dashboard/my-team", icon: Crown, roles: ["leader", "member"] },
  { name: "GitHub", href: "/dashboard/github", icon: Github, roles: ["leader", "member", "doctor", "ta"] },
  { name: "Gamification", href: "/dashboard/gamification", icon: Trophy, roles: ["leader", "member"] },
  { name: "Gamification Admin", href: "/dashboard/gamification/admin", icon: Trophy, roles: ["admin"] },
  { name: "Gamification Review", href: "/dashboard/gamification/admin", icon: Trophy, roles: ["doctor", "ta"] },
  { name: "All Teams", href: "/dashboard/teams", icon: Users, roles: ["admin"] },
  { name: "My Teams", href: "/dashboard/teams", icon: Users, roles: ["doctor", "ta"] },
  { name: "Tasks & Boards", href: "/dashboard/tasks", icon: CheckSquare, roles: ["leader", "member"] },
  { name: "Sprints", href: "/dashboard/sprints", icon: ClipboardList, roles: ["leader", "member", "doctor", "ta", "admin"] },
  { name: "Time Tracker", href: "/dashboard/time-tracker", icon: Timer, roles: ["leader", "member"] },
  { name: "Calendar", href: "/dashboard/calendar", icon: Calendar, roles: ["doctor", "ta", "leader", "member"] },
  { name: "Proposals", href: "/dashboard/proposals", icon: FileText, roles: ["doctor", "leader", "member"] },
  { name: "Submissions", href: "/dashboard/submissions", icon: Upload, roles: ["leader", "member", "doctor", "ta"] },
  { name: "Review Tasks", href: "/dashboard/reviews", icon: CheckCircle2, roles: ["ta", "leader"] },
  { name: "Grades Overview", href: "/dashboard/evaluations", icon: Award, roles: ["admin", "doctor"] },
  { name: "Meetings", href: "/dashboard/meetings", icon: Video, roles: ["doctor", "ta", "leader", "member"] },
  { name: "Discussions", href: "/dashboard/discussions", icon: MessageCircle, roles: ["doctor", "ta", "leader", "member"] },
  { name: "Chat", href: "/dashboard/chat", icon: MessageSquare, roles: ["admin", "doctor", "ta", "support", "leader", "member"] },
  { name: "Resources", href: "/dashboard/resources", icon: BookOpen, roles: ["doctor", "ta", "leader", "member"] },
  { name: "Documents", href: "/dashboard/files", icon: FolderOpen, roles: ["leader", "member", "doctor", "ta"] },
  { name: "Announcements", href: "/dashboard/announcements", icon: Megaphone, roles: ["admin", "doctor", "ta", "leader", "member"] },
  { name: "Analytics", href: "/dashboard/analytics", icon: TrendingUp, roles: ["admin", "doctor"] },
  { name: "Reports", href: "/dashboard/reports", icon: BarChart3, roles: ["admin", "doctor"] },
  { name: "Risk Management", href: "/dashboard/risk-management", icon: AlertTriangle, roles: ["leader", "member", "ta", "doctor"] },
  { name: "System Logs", href: "/dashboard/admin/logs", icon: Activity, roles: ["admin"] },
  { name: "Help Center", href: "/dashboard/help", icon: HelpCircle, roles: ["admin", "doctor", "ta", "leader", "member"] },
  { name: "FAQs", href: "/dashboard/faq", icon: BookOpen, roles: ["admin", "doctor", "ta", "leader", "member"] },
  { name: "Contact Support", href: "/dashboard/support", icon: LifeBuoy, roles: ["admin", "doctor", "ta", "leader", "member"] },
  { name: "Support Queue", href: "/dashboard/support", icon: LifeBuoy, roles: ["support"] },
]

const navigationItemByName = Object.fromEntries(navigationItems.map((item) => [item.name, item])) as Record<
  string,
  NavigationItem
>

const roleNavigationGroups: Record<Role, { name: string; items: string[] }[]> = {
  admin: [
    { name: "Main", items: ["Dashboard", "Sprints", "User Management", "All Teams", "Gamification Admin", "System Logs"] },
    { name: "Management & Reports", items: ["Analytics", "Reports", "Grades Overview"] },
    { name: "Communication", items: ["Announcements", "Chat"] },
    { name: "Help & Support", items: ["Help Center", "FAQs", "Contact Support"] },
  ],
  doctor: [
    { name: "Main", items: ["Dashboard", "Supervision", "My Teams", "Sprints", "Gamification Review", "Submissions", "Grades Overview", "Proposals"] },
    {
      name: "Work & Collaboration",
      items: ["Meetings", "Calendar", "Risk Management", "Announcements", "Resources", "Documents", "GitHub", "Discussions", "Chat"],
    },
    { name: "Management & Reports", items: ["Analytics", "Reports"] },
    { name: "Help & Support", items: ["Help Center", "FAQs", "Contact Support"] },
  ],
  ta: [
    { name: "Main", items: ["Dashboard", "Review Tasks", "Supervision", "Sprints", "Gamification Review", "Submissions", "Risk Management", "My Teams"] },
    {
      name: "Work & Collaboration",
      items: ["Meetings", "Calendar", "Announcements", "Resources", "Documents", "GitHub", "Discussions", "Chat"],
    },
    { name: "Help & Support", items: ["Help Center", "FAQs", "Contact Support"] },
  ],
  support: [
    { name: "Main", items: ["Dashboard", "Support Queue", "Chat"] },
  ],
  leader: [
    { name: "Main", items: ["Dashboard", "My Team", "Tasks & Boards", "Sprints", "Submissions", "Proposals", "Review Tasks"] },
    {
      name: "Work & Collaboration",
      items: ["GitHub", "Meetings", "Calendar", "Risk Management", "Time Tracker", "Documents", "Discussions", "Chat", "Resources", "Announcements"],
    },
    { name: "Growth", items: ["Gamification"] },
    { name: "Help & Support", items: ["Help Center", "FAQs", "Contact Support"] },
  ],
  member: [
    { name: "Main", items: ["Dashboard", "My Team", "Tasks & Boards", "Sprints", "Submissions", "GitHub"] },
    {
      name: "Work & Collaboration",
      items: ["Meetings", "Calendar", "Time Tracker", "Documents", "Resources", "Discussions", "Chat", "Announcements", "Proposals", "Risk Management"],
    },
    { name: "Growth", items: ["Gamification"] },
    { name: "Help & Support", items: ["Help Center", "FAQs", "Contact Support"] },
  ],
}

export function AppSidebar() {
  const pathname = usePathname()
  const { currentUser } = useAuthStore()
  const { sidebarCollapsed, isMobileSidebarOpen, setMobileSidebarOpen } = useUIStore()
  const [expandedGroups, setExpandedGroups] = useState<string[]>([
    "Main",
    "Management & Reports",
    "Communication",
    "Work & Collaboration",
  ])
  const currentRole = (currentUser?.role || "member") as Role
  const isStudentRole = currentRole === "leader" || currentRole === "member"
  const { data: myTeamState, isLoading: myTeamLoading } = useMyTeamState(isStudentRole)

  const toggleGroup = (groupName: string) => {
    setExpandedGroups((prev) => (prev.includes(groupName) ? prev.filter((g) => g !== groupName) : [...prev, groupName]))
  }

  const resolvedNavigationGroups = useMemo(() => {
    const shouldPromptTeamSetup = isStudentRole && !myTeamLoading && !myTeamState?.team
    const groupsForRole = roleNavigationGroups[currentRole] ?? roleNavigationGroups.member

    return groupsForRole
      .map((group) => ({
        ...group,
        items: group.items
          .map((itemName) => navigationItemByName[itemName])
          .filter((item): item is NavigationItem => Boolean(item) && item.roles.includes(currentRole))
          .map((item) => {
            if (item.href !== "/dashboard/my-team") return item

            if (!shouldPromptTeamSetup) return item

            return {
              ...item,
              name: currentRole === "leader" ? "Create Team" : "Join Team",
            }
          }),
      }))
      .filter((group) => group.items.length > 0)
  }, [currentRole, isStudentRole, myTeamLoading, myTeamState?.team])

  const activeHref = useMemo(() => {
    const visibleItems = resolvedNavigationGroups.flatMap((group) => group.items)
    const matchingItems = visibleItems
      .filter((item) => pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`)))
      .sort((left, right) => right.href.length - left.href.length)

    return matchingItems[0]?.href
  }, [pathname, resolvedNavigationGroups])

  return (
    <motion.aside
      initial={{ x: -300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={cn(
        "fixed left-0 top-0 z-50 h-dvh glass border-r transition-all duration-300",
        "w-[280px] xs:w-[260px] sm:w-64 lg:w-64",
        sidebarCollapsed && "lg:w-16",
      )}
    >
      <motion.div
        className="flex h-14 items-center justify-between border-b border-border px-3 sm:px-4"
        whileHover={{ scale: 1.02 }}
      >
        {!sidebarCollapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <motion.div
              className="p-1.5 rounded-lg sm:rounded-xl bg-primary/10 glow"
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.6 }}
            >
              <GraduationCap className="h-5 w-5 text-primary" />
            </motion.div>
            <span className="font-bold text-base tracking-tight text-foreground">ProjectHub</span>
          </Link>
        )}
        {sidebarCollapsed && (
          <motion.div
            className="p-2 rounded-xl bg-primary/10 glow mx-auto"
            whileHover={{ rotate: 360 }}
            transition={{ duration: 0.6 }}
          >
            <GraduationCap className="h-5 w-5 text-primary" />
          </motion.div>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden h-10 w-10 rounded-lg touch-target"
          onClick={() => setMobileSidebarOpen(false)}
        >
          <X className="h-5 w-5" />
        </Button>
      </motion.div>

      <ScrollArea className="h-[calc(100dvh-3.5rem)]">
        <nav className="space-y-1 p-2">
          {resolvedNavigationGroups.map((group, groupIndex) => {
            const filteredItems = group.items

            if (filteredItems.length === 0) return null

            const isExpanded = expandedGroups.includes(group.name)
            const isMainGroup = group.name === "Main"

            return (
              <motion.div
                key={group.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: groupIndex * 0.05, duration: 0.3 }}
                className="mb-2 sm:mb-3"
              >
                {!sidebarCollapsed && !isMainGroup && (
                  <button
                    onClick={() => toggleGroup(group.name)}
                    className="flex items-center justify-between w-full px-3 py-2.5 text-[11px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors min-h-[44px] touch-target"
                  >
                    <span className="truncate">{group.name}</span>
                    <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    </motion.div>
                  </button>
                )}

                {(isExpanded || sidebarCollapsed || isMainGroup) && (
                  <div className="space-y-0.5">
                    {filteredItems.map((item, index) => {
                      const isActive = activeHref === item.href
                      const navItem = (
                        <Link
                          href={item.href}
                          onClick={() => setMobileSidebarOpen(false)}
                          className={cn(
                            "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200 group relative overflow-hidden min-h-[48px] touch-target",
                            isActive
                              ? "bg-primary/10 text-primary shadow-lg shadow-primary/20"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/50 active:bg-muted/70",
                            sidebarCollapsed && "justify-center",
                          )}
                        >
                          {isActive && (
                            <motion.div
                              layoutId="sidebar-active"
                              className="absolute inset-0 bg-primary/10 rounded-xl"
                              transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            />
                          )}

                          <motion.div
                            className="relative z-10 shrink-0"
                            whileHover={{ scale: 1.1, rotate: 5 }}
                            transition={{ type: "spring", stiffness: 400 }}
                          >
                            <item.icon className="h-5 w-5" />
                          </motion.div>

                          {!sidebarCollapsed && <span className="relative z-10 truncate">{item.name}</span>}

                          {isActive && !sidebarCollapsed && (
                            <motion.div
                              className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-l-full"
                              layoutId="sidebar-indicator"
                              transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            />
                          )}
                        </Link>
                      )
                      return (
                        <motion.div
                          key={`${group.name}-${item.href}`}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.03, duration: 0.3 }}
                        >
                          {sidebarCollapsed ? (
                            <TooltipProvider delayDuration={120}>
                              <Tooltip>
                                <TooltipTrigger asChild>{navItem}</TooltipTrigger>
                                <TooltipContent side="right" align="center">
                                  {item.name}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            navItem
                          )}
                        </motion.div>
                      )
                    })}
                  </div>
                )}
              </motion.div>
            )
          })}
        </nav>

        <div className="h-8 safe-area-bottom" />
      </ScrollArea>
    </motion.aside>
  )
}
