"use client"

import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "framer-motion"
import Link from "next/link"
import { useEffect, useState, type ReactNode } from "react"
import { useTheme } from "next-themes"
import {
  ArrowRight,
  Award,
  BarChart3,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileCheck2,
  FileText,
  Github,
  GraduationCap,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Moon,
  ShieldCheck,
  Star,
  Sun,
  Target,
  Users,
  Workflow,
  X,
  type LucideIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { isUserProfileIncomplete } from "@/lib/auth/profile-completion"
import { useAuthStore } from "@/lib/stores/auth-store"
import { cn } from "@/lib/utils"

const navItems = [
  { label: "Workflow", id: "workflow" },
  { label: "Features", id: "features" },
  { label: "Outcomes", id: "outcomes" },
  { label: "FAQ", id: "faq" },
] as const

const smoothEase = [0.22, 1, 0.36, 1] as const

const proofMetrics = [
  {
    label: "6 SDLC phases",
    value: "End-to-end",
    description: "Proposal, design, build, review, submission, and grading stay connected.",
    icon: Workflow,
  },
  {
    label: "GitHub-linked submissions",
    value: "Less manual work",
    description: "Issues, commits, and releases support progress reports and deliverables.",
    icon: Github,
  },
  {
    label: "Role-based supervision",
    value: "Clear ownership",
    description: "Students, leaders, supervisors, and admins see the tools they need.",
    icon: ShieldCheck,
  },
] as const

const workflowSteps = [
  { label: "Proposal", icon: FileText },
  { label: "Team", icon: Users },
  { label: "Tasks", icon: LayoutDashboard },
  { label: "Review", icon: MessageSquare },
  { label: "Submission", icon: FileCheck2 },
  { label: "Grade", icon: Award },
] as const

const previewPanels = {
  Overview: {
    kicker: "Graduation Project Overview",
    title: "Smart Campus Assistant",
    status: "On track",
    statusClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    message: "Clarify the deployment architecture and attach API test evidence before the design review.",
    stats: [
      { label: "SDLC phase", value: "Design", icon: Workflow, tone: "text-sky-500" },
      { label: "Sprint health", value: "78%", icon: BarChart3, tone: "text-emerald-500" },
      { label: "Next review", value: "Thu 2 PM", icon: Clock3, tone: "text-amber-500" },
    ],
    board: {
      title: "Current board",
      subtitle: "Evidence-ready tasks for the next supervisor review",
      badge: "Sprint 06",
      columns: [
        { title: "In progress", items: ["Finalize ER diagram", "Build auth guard"], color: "bg-sky-500" },
        { title: "In review", items: ["SRS draft", "API test plan"], color: "bg-amber-500" },
        { title: "Approved", items: ["Team invite flow", "GitHub release"], color: "bg-emerald-500" },
      ],
    },
    evidenceTitle: "GitHub evidence",
    evidenceDetail: "24 commits linked this week",
    progress: 80,
  },
  Tasks: {
    kicker: "Sprint Execution",
    title: "Evidence-ready task board",
    status: "Reviewing",
    statusClass: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    message: "Two tasks are ready for supervisor review and one implementation item needs final evidence.",
    stats: [
      { label: "Open tasks", value: "14", icon: LayoutDashboard, tone: "text-sky-500" },
      { label: "Ready review", value: "5", icon: CheckCircle2, tone: "text-emerald-500" },
      { label: "Blocked", value: "1", icon: Bell, tone: "text-amber-500" },
    ],
    board: {
      title: "Sprint task flow",
      subtitle: "Click a task to preview how feedback follows the work item",
      badge: "Live board",
      columns: [
        { title: "To refine", items: ["Auth edge cases", "Mobile task cards"], color: "bg-sky-500" },
        { title: "In review", items: ["API test plan", "Sprint evidence"], color: "bg-amber-500" },
        { title: "Ready", items: ["ER diagram", "Task acceptance"], color: "bg-emerald-500" },
      ],
    },
    evidenceTitle: "Review readiness",
    evidenceDetail: "5 tasks include links or files",
    progress: 68,
  },
  Submissions: {
    kicker: "Deliverable Control",
    title: "SRS package under review",
    status: "Pending feedback",
    statusClass: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    message: "The SRS draft is attached with rubric criteria and a structured feedback loop.",
    stats: [
      { label: "Deliverable", value: "SRS", icon: FileText, tone: "text-sky-500" },
      { label: "Rubric score", value: "82/100", icon: Award, tone: "text-emerald-500" },
      { label: "Revision", value: "1 open", icon: MessageSquare, tone: "text-amber-500" },
    ],
    board: {
      title: "Submission review",
      subtitle: "Rubric items, comments, and evidence stay attached to the deliverable",
      badge: "Phase 02",
      columns: [
        { title: "Uploaded", items: ["SRS v2.pdf", "UML package"], color: "bg-sky-500" },
        { title: "Comments", items: ["Scope note", "API section"], color: "bg-amber-500" },
        { title: "Accepted", items: ["Team charter", "Proposal"], color: "bg-emerald-500" },
      ],
    },
    evidenceTitle: "Rubric evidence",
    evidenceDetail: "4 criteria reviewed by supervisor",
    progress: 82,
  },
  Meetings: {
    kicker: "Supervision Rhythm",
    title: "Design review prepared",
    status: "Thu 2 PM",
    statusClass: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
    message: "Meeting notes, risks, and next actions are connected to the current SDLC phase.",
    stats: [
      { label: "Upcoming", value: "Thu", icon: Calendar, tone: "text-sky-500" },
      { label: "Agenda", value: "4 items", icon: FileCheck2, tone: "text-emerald-500" },
      { label: "Risk level", value: "Low", icon: ShieldCheck, tone: "text-amber-500" },
    ],
    board: {
      title: "Meeting agenda",
      subtitle: "A clean supervision checklist before the next design review",
      badge: "45 min",
      columns: [
        { title: "Discuss", items: ["Architecture", "Risks"], color: "bg-sky-500" },
        { title: "Decide", items: ["API scope", "Timeline"], color: "bg-amber-500" },
        { title: "Follow up", items: ["Minutes", "Next tasks"], color: "bg-emerald-500" },
      ],
    },
    evidenceTitle: "Calendar sync",
    evidenceDetail: "Agenda and notes ready",
    progress: 72,
  },
} as const

type PreviewPanel = keyof typeof previewPanels

const processSteps = [
  {
    step: "01",
    title: "Create the workspace",
    artifact: "Team invite and supervisor request",
    description: "Open a project space, invite members, and request the Doctor or TA supervising the graduation project.",
    icon: Users,
  },
  {
    step: "02",
    title: "Run the project rhythm",
    artifact: "Kanban board and SDLC timeline",
    description: "Plan sprint work, connect GitHub activity, track meetings, and keep every deliverable tied to a phase.",
    icon: LayoutDashboard,
  },
  {
    step: "03",
    title: "Submit with evidence",
    artifact: "Graded deliverable and feedback loop",
    description: "Upload files or sync releases, then receive structured feedback, scores, and next actions in one place.",
    icon: FileCheck2,
  },
] as const

const rolePanels = [
  {
    value: "students",
    label: "Students",
    icon: GraduationCap,
    eyebrow: "Student workspace",
    title: "Know exactly what to build, submit, and explain.",
    description:
      "A focused daily view for tasks, files, meetings, GitHub activity, XP, and deadline pressure before it becomes a surprise.",
    accent: "from-sky-500/20 via-sky-500/5 to-emerald-500/20",
    metric: "78%",
    metricLabel: "weekly progress",
    bullets: [
      { title: "Task clarity", text: "Priorities, due dates, and review status stay visible." },
      { title: "Submission memory", text: "Deliverables and feedback stay attached to the project." },
      { title: "GitHub context", text: "Commits and releases support progress reporting." },
      { title: "Motivation loop", text: "XP and badges reward consistent execution." },
    ],
  },
  {
    value: "supervisors",
    label: "Supervisors",
    icon: Users,
    eyebrow: "Supervisor cockpit",
    title: "Review more teams without chasing scattered updates.",
    description:
      "A supervision layer for progress, risk, meetings, submissions, and feedback across assigned teams.",
    accent: "from-indigo-500/20 via-indigo-500/5 to-amber-500/20",
    metric: "8",
    metricLabel: "teams in view",
    bullets: [
      { title: "Team overview", text: "See phase, tasks, and deadline health at a glance." },
      { title: "Structured grading", text: "Review deliverables with scores and comments." },
      { title: "Risk signals", text: "Spot low activity and missed milestones earlier." },
      { title: "Meeting flow", text: "Keep supervision sessions tied to project context." },
    ],
  },
  {
    value: "teams",
    label: "Teams",
    icon: Workflow,
    eyebrow: "Team operations",
    title: "Turn graduation project chaos into a shared operating system.",
    description:
      "A collaborative workspace for planning, discussion, peer review, resource sharing, and delivery readiness.",
    accent: "from-emerald-500/20 via-emerald-500/5 to-sky-500/20",
    metric: "6",
    metricLabel: "board stages",
    bullets: [
      { title: "Kanban execution", text: "Move work from backlog to approved and done." },
      { title: "Shared resources", text: "Files, links, videos, and documents live together." },
      { title: "Peer reviews", text: "Contribution reviews are structured and traceable." },
      { title: "Time tracking", text: "Workload distribution becomes visible." },
    ],
  },
  {
    value: "admins",
    label: "Admins",
    icon: ShieldCheck,
    eyebrow: "Academic control",
    title: "Manage the platform without losing auditability.",
    description:
      "A clean administrative layer for users, settings, announcements, audit logs, exports, and platform analytics.",
    accent: "from-amber-500/20 via-amber-500/5 to-sky-500/20",
    metric: "100%",
    metricLabel: "role coverage",
    bullets: [
      { title: "User management", text: "Maintain roles, accounts, and academic profiles." },
      { title: "System settings", text: "Control feature flags and notification behavior." },
      { title: "Audit trail", text: "Track important activity and operational changes." },
      { title: "Exports", text: "Prepare reports for project and grading records." },
    ],
  },
] as const

const outcomes = [
  {
    role: "Student",
    initials: "AM",
    title: "Less double-entry work",
    quote: "GitHub issues, tasks, and submissions finally tell the same story before review day.",
    signal: "Saved weekly status prep",
    icon: Github,
  },
  {
    role: "Team leader",
    initials: "NE",
    title: "Cleaner sprint accountability",
    quote: "Everyone can see what is blocked, what is ready for review, and what still needs evidence.",
    signal: "Clearer team ownership",
    icon: Target,
  },
  {
    role: "Supervisor",
    initials: "KI",
    title: "Faster progress checks",
    quote: "The team timeline, deliverables, and feedback history are visible without digging through messages.",
    signal: "Better review rhythm",
    icon: BarChart3,
  },
] as const

const faqs = [
  {
    question: "What deliverables can students submit?",
    answer: "SRS files, UML diagrams, prototypes, source code, test plans, final reports, and presentations.",
  },
  {
    question: "How does GitHub sync help?",
    answer: "Issues, commits, pull requests, and releases can support tasks, progress reports, and release-based submissions.",
  },
  {
    question: "Which roles are supported?",
    answer: "Students, team leaders, TAs, Doctors, and admins each get role-appropriate workflows and dashboards.",
  },
  {
    question: "Can supervisors review multiple teams?",
    answer: "Yes. Supervisors can track assigned teams, meetings, risks, submissions, feedback, and grading status.",
  },
  {
    question: "Is gamification part of the workflow?",
    answer: "Yes. XP, badges, and leaderboards reinforce consistent task completion and milestone delivery.",
  },
  {
    question: "Does this replace existing communication tools?",
    answer: "It reduces scattered coordination by keeping project discussion, feedback, and evidence in context.",
  },
] as const

const footerGroups = [
  {
    title: "Product",
    links: [
      { label: "Workflow", href: "#workflow" },
      { label: "Features", href: "#features" },
      { label: "Outcomes", href: "#outcomes" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "Roles",
    links: [
      { label: "Students", href: "#features" },
      { label: "Team Leaders", href: "#features" },
      { label: "Supervisors", href: "#features" },
      { label: "Admins", href: "#features" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Create Account", href: "/register" },
      { label: "Sign In", href: "/login" },
    ],
  },
] as const

type CtaState = {
  hasIncompleteProfile: boolean
  isAuthenticated: boolean
  isReadyAuthenticated: boolean
  primaryHref: string
  primaryLabel: string
  primaryShortLabel: string
  signInHref: string
  signInLabel: string
}

export default function LandingPage() {
  const { scrollYProgress } = useScroll()
  const scaleX = useTransform(scrollYProgress, [0, 1], [0, 1])
  const shouldReduceMotion = useReducedMotion()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeSection, setActiveSection] = useState("")
  const [activeRoleTab, setActiveRoleTab] = useState("students")
  const [mounted, setMounted] = useState(false)
  const { resolvedTheme, setTheme } = useTheme()
  const { accessToken, currentUser, hasHydrated } = useAuthStore()

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [mobileMenuOpen])

  useEffect(() => {
    const sections = navItems.map((item) => document.getElementById(item.id)).filter(Boolean) as HTMLElement[]
    if (!sections.length) return

    let ticking = false
    const updateActiveSection = () => {
      const marker = window.scrollY + window.innerHeight * 0.32
      let next = ""
      for (const section of sections) {
        if (section.offsetTop <= marker) next = section.id
      }
      setActiveSection(next)
      ticking = false
    }

    const requestUpdate = () => {
      if (ticking) return
      ticking = true
      window.requestAnimationFrame(updateActiveSection)
    }

    requestUpdate()
    window.addEventListener("scroll", requestUpdate, { passive: true })
    window.addEventListener("resize", requestUpdate)

    return () => {
      window.removeEventListener("scroll", requestUpdate)
      window.removeEventListener("resize", requestUpdate)
    }
  }, [])

  const isAuthenticated = hasHydrated && Boolean(accessToken || currentUser)
  const hasIncompleteProfile = isAuthenticated && isUserProfileIncomplete(currentUser)
  const isReadyAuthenticated = isAuthenticated && !hasIncompleteProfile
  const cta: CtaState = {
    hasIncompleteProfile,
    isAuthenticated,
    isReadyAuthenticated,
    primaryHref: hasIncompleteProfile ? "/complete-profile?reason=incomplete" : isReadyAuthenticated ? "/dashboard" : "/register",
    primaryLabel: hasIncompleteProfile ? "Complete Profile" : isReadyAuthenticated ? "Open Dashboard" : "Create Your Workspace",
    primaryShortLabel: hasIncompleteProfile ? "Complete" : isReadyAuthenticated ? "Dashboard" : "Create",
    signInHref: isReadyAuthenticated ? "/dashboard" : "/login",
    signInLabel: isReadyAuthenticated ? "Open Dashboard" : "Sign In",
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <motion.div className="fixed inset-x-0 top-0 z-[60] h-0.5 origin-left bg-primary" style={{ scaleX }} />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,oklch(var(--primary)/0.12),transparent_32rem),linear-gradient(to_bottom,oklch(var(--background)),oklch(var(--muted)/0.42))]" />
      <div className="fixed inset-0 -z-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808010_1px,transparent_1px)] bg-[size:48px_48px]" />

      <Header
        activeSection={activeSection}
        cta={cta}
        mobileMenuOpen={mobileMenuOpen}
        mounted={mounted}
        resolvedTheme={resolvedTheme}
        setMobileMenuOpen={setMobileMenuOpen}
        setTheme={setTheme}
      />

      <main>
        <Hero cta={cta} shouldReduceMotion={Boolean(shouldReduceMotion)} />
        <WorkflowStrip />
        <HowItWorks />
        <RoleFeatures activeRoleTab={activeRoleTab} cta={cta} setActiveRoleTab={setActiveRoleTab} />
        <Outcomes />
        <FAQ cta={cta} />
        <FinalCTA cta={cta} />
      </main>

      <Footer cta={cta} />
    </div>
  )
}

function Header({
  activeSection,
  cta,
  mobileMenuOpen,
  mounted,
  resolvedTheme,
  setMobileMenuOpen,
  setTheme,
}: {
  activeSection: string
  cta: CtaState
  mobileMenuOpen: boolean
  mounted: boolean
  resolvedTheme: string | undefined
  setMobileMenuOpen: (open: boolean) => void
  setTheme: (theme: string) => void
}) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="fixed inset-x-0 top-0 z-50 border-b border-border/70 bg-background/82 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="group flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
            <GraduationCap className="h-5 w-5" />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block text-sm font-bold tracking-[-0.01em] sm:text-base">GPMS</span>
            <span className="hidden text-xs text-muted-foreground xs:block">Graduation Project Management</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 rounded-full border border-border/70 bg-background/70 p-1 lg:flex">
          {navItems.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={cn(
                "relative rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                activeSection === item.id && "bg-primary/10 text-primary",
              )}
              aria-current={activeSection === item.id ? "location" : undefined}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 rounded-xl"
              aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            >
              {resolvedTheme === "dark" ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
            </Button>
          )}
          {!cta.isReadyAuthenticated && (
            <Button asChild variant="ghost" className="hidden h-11 rounded-xl px-4 sm:inline-flex">
              <Link href={cta.signInHref}>Sign In</Link>
            </Button>
          )}
          <Button asChild className="h-11 rounded-xl px-4 shadow-sm shadow-primary/20">
            <Link href={cta.primaryHref}>
              <span className="hidden sm:inline">{cta.primaryLabel}</span>
              <span className="sm:hidden">{cta.primaryShortLabel}</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 rounded-xl lg:hidden"
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-controls="mobile-navigation"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            id="mobile-navigation"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border/70 bg-background/96 lg:hidden"
          >
            <div className="mx-auto max-w-7xl space-y-2 px-4 py-4 sm:px-6">
              {navItems.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className={cn(
                    "flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    activeSection === item.id && "bg-primary/10 text-primary",
                  )}
                  onClick={() => setMobileMenuOpen(false)}
                  aria-current={activeSection === item.id ? "location" : undefined}
                >
                  {item.label}
                </a>
              ))}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button asChild variant="outline" className="h-11 rounded-xl bg-transparent">
                  <Link href={cta.signInHref}>{cta.signInLabel}</Link>
                </Button>
                <Button asChild className="h-11 rounded-xl">
                  <Link href={cta.primaryHref}>{cta.primaryShortLabel}</Link>
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}

function Hero({ cta, shouldReduceMotion }: { cta: CtaState; shouldReduceMotion: boolean }) {
  return (
    <section className="overflow-x-clip px-4 pb-14 pt-20 sm:px-6 sm:pb-16 sm:pt-28 lg:px-8 lg:pb-20 lg:pt-24">
      <div className="mx-auto max-w-7xl">
        <div className="grid min-w-0 items-start gap-8 lg:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)] lg:gap-12 xl:gap-14">
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
            animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="min-w-0 pt-2 text-center lg:pt-8 lg:text-left xl:pt-10"
          >
            <h1 className="mx-auto max-w-[22rem] text-balance text-[2.35rem] font-bold leading-[1.02] tracking-normal text-foreground sm:max-w-4xl sm:text-5xl sm:leading-[1] md:text-6xl lg:mx-0 lg:text-7xl">
              Run graduation projects from proposal to final defense.
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg lg:mx-0">
              GPMS gives students, team leaders, supervisors, and admins one polished operating system for tasks,
              SDLC progress, GitHub evidence, submissions, feedback, and grading.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <Button asChild size="lg" className="h-12 rounded-xl px-6 text-sm shadow-lg shadow-primary/20 sm:h-13 sm:text-base">
                <Link href={cta.primaryHref} className="group">
                  {cta.primaryLabel}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 rounded-xl bg-background/70 px-6 text-sm sm:h-13 sm:text-base">
                <a href="#workflow">
                  <LayoutDashboard className="h-4 w-4" />
                  Preview Workflow
                </a>
              </Button>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
              {["Students", "Team leaders", "TAs", "Doctors", "Admins"].map((role) => (
                <span
                  key={role}
                  className="rounded-full border border-border/70 bg-background/75 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm"
                >
                  {role}
                </span>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 24, scale: 0.98 }}
            animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.65, delay: 0.1 }}
            className="min-w-0"
          >
            <DashboardPreview />
          </motion.div>
        </div>

        <div className="mt-8 grid gap-3 md:grid-cols-3 lg:mt-10">
          {proofMetrics.map((metric, index) => (
            <MotionCard
              key={metric.label}
              delay={0.1 + index * 0.06}
              className="group border-border/70 bg-card/82 p-5 shadow-sm backdrop-blur transition-[background-color,border-color,box-shadow] duration-150 hover:border-primary/35 hover:bg-card hover:shadow-lg hover:shadow-primary/10"
            >
              <div className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-[background-color,transform] duration-150 group-hover:-translate-y-0.5 group-hover:bg-primary/15">
                  <metric.icon className="h-5 w-5 transition-transform duration-150 group-hover:scale-110" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{metric.label}</p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-primary">{metric.value}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{metric.description}</p>
                </div>
              </div>
            </MotionCard>
          ))}
        </div>
      </div>
    </section>
  )
}

function DashboardPreview() {
  const shouldReduceMotion = useReducedMotion()
  const [activePanel, setActivePanel] = useState<PreviewPanel>("Overview")
  const [selectedTask, setSelectedTask] = useState("SRS draft")
  const activeCopy = previewPanels[activePanel]
  const sidebarItems: Array<{ label: PreviewPanel; icon: LucideIcon }> = [
    { label: "Overview", icon: LayoutDashboard },
    { label: "Tasks", icon: CheckCircle2 },
    { label: "Submissions", icon: FileCheck2 },
    { label: "Meetings", icon: Calendar },
  ]

  useEffect(() => {
    setSelectedTask(activeCopy.board.columns[1]?.items[0] ?? activeCopy.board.columns[0]?.items[0] ?? activeCopy.title)
  }, [activeCopy])

  return (
    <motion.div
      className="relative w-full min-w-0 max-w-full"
      whileHover={shouldReduceMotion ? undefined : { y: -6, scale: 1.005 }}
      transition={{ duration: 0.28, ease: smoothEase }}
    >
      <motion.div
        aria-hidden="true"
        className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-primary/18 via-transparent to-emerald-500/12 blur-2xl"
        animate={shouldReduceMotion ? undefined : { opacity: [0.56, 0.9, 0.56], scale: [1, 1.03, 1] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <Card className="relative w-full max-w-full overflow-hidden rounded-2xl border-border/70 bg-card/92 p-0 shadow-2xl shadow-primary/10 backdrop-blur">
        <div className="flex items-center justify-between border-b border-border/70 px-3 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            {["bg-red-400", "bg-amber-400", "bg-emerald-400"].map((dot, index) => (
              <motion.span
                key={dot}
                className={cn("h-3 w-3 rounded-full", dot)}
                animate={shouldReduceMotion ? undefined : { opacity: [0.55, 1, 0.55] }}
                transition={{ duration: 2.3, delay: index * 0.28, repeat: Infinity, ease: "easeInOut" }}
              />
            ))}
          </div>
          <motion.div
            animate={shouldReduceMotion ? undefined : { y: [0, -1.5, 0] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          >
            <Badge variant="secondary" className="rounded-full">Live workspace</Badge>
          </motion.div>
        </div>

        <div className="grid min-w-0 lg:grid-cols-[13rem_minmax(0,1fr)]">
          <aside className="hidden border-r border-border/70 bg-muted/20 p-4 lg:block">
            <div className="flex items-center gap-3 rounded-xl bg-background/80 p-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <GraduationCap className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold">GPMS</p>
                <p className="text-xs text-muted-foreground">Team Atlas</p>
              </div>
            </div>
            <div className="mt-5 space-y-2">
              {sidebarItems.map(({ label, icon: Icon }) => (
                <motion.button
                  key={label}
                  type="button"
                  aria-pressed={activePanel === label}
                  onClick={() => setActivePanel(label)}
                  whileHover={shouldReduceMotion ? undefined : { x: 3 }}
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-primary/8 hover:text-foreground",
                    activePanel === label && "bg-primary/10 text-primary shadow-sm",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </motion.button>
              ))}
            </div>
          </aside>

          <div className="min-w-0 p-3 sm:p-5">
            <div className="mb-4 flex max-w-full gap-2 overflow-x-auto pb-1 lg:hidden">
              {sidebarItems.map(({ label, icon: Icon }) => (
                <motion.button
                  key={label}
                  type="button"
                  aria-pressed={activePanel === label}
                  onClick={() => setActivePanel(label)}
                  whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border/70 bg-background/80 px-3 text-xs font-medium text-muted-foreground shadow-sm transition-colors duration-150",
                    activePanel === label && "border-primary/30 bg-primary/10 text-primary",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </motion.button>
              ))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activePanel}
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, y: -8 }}
                  transition={{ duration: 0.22, ease: smoothEase }}
                >
                  <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground sm:text-xs sm:tracking-[0.18em]">{activeCopy.kicker}</p>
                  <h2 className="mt-1 text-lg font-bold tracking-normal sm:text-2xl">{activeCopy.title}</h2>
                </motion.div>
              </AnimatePresence>
              <motion.div layout>
                <Badge variant="outline" className={cn("rounded-full", activeCopy.statusClass)}>
                  {activeCopy.status}
                </Badge>
              </motion.div>
            </div>

            <div className="mt-4 grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2 sm:mt-5 sm:gap-3">
              <AnimatePresence mode="popLayout">
                {activeCopy.stats.map((stat, index) => (
                  <motion.div
                    key={`${activePanel}-${stat.label}`}
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 10, scale: 0.98 }}
                    animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
                    exit={shouldReduceMotion ? undefined : { opacity: 0, y: -8, scale: 0.98 }}
                    transition={{ duration: 0.24, delay: index * 0.035, ease: smoothEase }}
                  >
                    <MiniStat
                      active={selectedTask === stat.label}
                      label={stat.label}
                      value={stat.value}
                      icon={stat.icon}
                      tone={stat.tone}
                      onSelect={() => setSelectedTask(stat.label)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={`${activePanel}-board`}
                className="mt-4 rounded-2xl border border-border/70 bg-background/72 p-3 sm:mt-5 sm:p-4"
                initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
                animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, y: -10 }}
                transition={{ duration: 0.26, ease: smoothEase }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{activeCopy.board.title}</p>
                    <p className="text-xs leading-5 text-muted-foreground">{activeCopy.board.subtitle}</p>
                  </div>
                  <Badge variant="secondary" className="rounded-full">{activeCopy.board.badge}</Badge>
                </div>

                <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1 md:mx-0 md:mt-4 md:grid md:grid-cols-3 md:gap-3 md:overflow-visible md:px-0 md:pb-0">
                  {activeCopy.board.columns.map((column, columnIndex) => (
                    <motion.div
                      key={`${activePanel}-${column.title}`}
                      className="min-w-[8.75rem] flex-1 rounded-xl border border-border/70 bg-muted/30 p-2.5 md:min-w-0 md:p-3"
                      initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
                      animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: columnIndex * 0.04, ease: smoothEase }}
                    >
                      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:text-xs sm:tracking-[0.14em]">
                        <span className={cn("h-2 w-2 rounded-full", column.color)} />
                        {column.title}
                      </div>
                      <div className="mt-2.5 space-y-2 md:mt-3">
                        {column.items.map((item) => (
                          <motion.button
                            key={item}
                            type="button"
                            aria-pressed={selectedTask === item}
                            onClick={() => setSelectedTask(item)}
                            whileHover={shouldReduceMotion ? undefined : { x: 3, y: -1 }}
                            whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
                            className={cn(
                              "w-full rounded-lg border border-border/70 bg-background/80 px-2.5 py-2 text-left text-xs text-foreground shadow-sm transition-colors duration-150 hover:border-primary/35 hover:bg-primary/5 md:px-3",
                              selectedTask === item && "border-primary/40 bg-primary/10 text-primary",
                            )}
                          >
                            {item}
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="mt-3 overflow-hidden rounded-xl border border-border/70 bg-muted/25 sm:mt-4">
                  <motion.div
                    className="h-1 bg-gradient-to-r from-sky-500 via-emerald-500 to-amber-400"
                    initial={shouldReduceMotion ? false : { scaleX: 0 }}
                    animate={shouldReduceMotion ? undefined : { scaleX: activeCopy.progress / 100 }}
                    style={{ originX: 0, scaleX: shouldReduceMotion ? activeCopy.progress / 100 : undefined }}
                    transition={{ duration: 0.5, ease: smoothEase }}
                  />
                  <div className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground">
                    <span>{activePanel} focus</span>
                    <span className="font-semibold text-primary">{activeCopy.progress}% ready</span>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            <AnimatePresence mode="wait">
              <motion.div
                key={`${activePanel}-cards`}
                className="mt-4 grid gap-2 sm:mt-5 sm:grid-cols-[1fr_0.8fr] sm:gap-3"
                initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
                animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, y: -10 }}
                transition={{ duration: 0.26, ease: smoothEase }}
              >
                <motion.div
                  className="rounded-2xl border border-border/70 bg-muted/25 p-3 sm:p-4"
                  whileHover={shouldReduceMotion ? undefined : { y: -2 }}
                  transition={{ duration: 0.22, ease: smoothEase }}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    Workspace signal
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground sm:text-sm sm:leading-6">
                    {activeCopy.message}
                  </p>
                  <p className="mt-3 text-xs font-medium text-primary">Selected: {selectedTask}</p>
                </motion.div>
                <motion.div
                  className="rounded-2xl border border-border/70 bg-muted/25 p-3 sm:p-4"
                  whileHover={shouldReduceMotion ? undefined : { y: -2 }}
                  transition={{ duration: 0.22, ease: smoothEase }}
                >
                  <div className="flex items-center justify-between text-sm font-semibold">
                    {activeCopy.evidenceTitle}
                    <Github className="h-4 w-4 text-foreground/70" />
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-background">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500"
                      initial={shouldReduceMotion ? false : { width: "18%" }}
                      animate={shouldReduceMotion ? undefined : { width: `${activeCopy.progress}%` }}
                      transition={{ duration: 0.55, delay: 0.08, ease: smoothEase }}
                      style={shouldReduceMotion ? { width: `${activeCopy.progress}%` } : undefined}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{activeCopy.evidenceDetail}</p>
                </motion.div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

function MiniStat({
  active = false,
  icon: Icon,
  label,
  onSelect,
  tone,
  value,
}: {
  active?: boolean
  icon: LucideIcon
  label: string
  onSelect?: () => void
  tone: string
  value: string
}) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      disabled={!onSelect}
      aria-pressed={active}
      whileHover={shouldReduceMotion || !onSelect ? undefined : { y: -2 }}
      whileTap={shouldReduceMotion || !onSelect ? undefined : { scale: 0.98 }}
      className={cn(
        "min-h-[4.5rem] rounded-xl border border-border/70 bg-muted/30 p-2.5 text-left transition-colors duration-150 hover:border-primary/35 hover:bg-primary/5 sm:min-h-0 sm:p-3",
        active && "border-primary/40 bg-primary/10",
        !onSelect && "cursor-default",
      )}
    >
      <div className="flex items-center justify-between gap-1 text-[10px] text-muted-foreground sm:text-xs">
        <span className="min-w-0 leading-tight">{label}</span>
        <Icon className={cn("h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4", tone)} />
      </div>
      <p className="mt-1.5 text-base font-bold sm:mt-2 sm:text-lg">{value}</p>
    </motion.button>
  )
}

function WorkflowStrip() {
  const shouldReduceMotion = useReducedMotion()

  return (
    <section id="workflow" className="scroll-mt-24 border-y border-border/70 bg-muted/20 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <motion.div
          className="mb-7 flex flex-col gap-2 text-center sm:mb-8"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
          whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.42, ease: smoothEase }}
        >
          <p className="text-sm font-semibold text-primary">One academic flow</p>
          <h2 className="text-2xl font-bold tracking-normal sm:text-3xl">From proposal to grade without context switching.</h2>
        </motion.div>
        <div className="grid gap-3 md:grid-cols-6">
          {workflowSteps.map((step, index) => (
            <motion.div
              key={step.label}
              className="relative"
              initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
              whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-70px" }}
              transition={{ duration: 0.36, delay: index * 0.045, ease: smoothEase }}
            >
              {index < workflowSteps.length - 1 && (
                <div className="absolute left-[calc(50%+1.5rem)] right-[calc(-50%+1.5rem)] top-7 hidden h-px bg-border md:block" />
              )}
              <motion.a
                href="#features"
                className="group relative flex items-center gap-3 rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm transition-colors hover:border-primary/35 hover:bg-primary/5 md:flex-col md:justify-center md:text-center"
                whileHover={shouldReduceMotion ? undefined : { y: -4 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                transition={{ duration: 0.22, ease: smoothEase }}
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <step.icon className="h-5 w-5 transition-transform group-hover:scale-105" />
                </span>
                <span className="text-sm font-semibold">{step.label}</span>
              </motion.a>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          eyebrow="How it works"
          title="A calmer process for a high-stakes semester."
          description="GPMS turns project coordination into a visible sequence of artifacts, decisions, reviews, and delivery evidence."
        />

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {processSteps.map((item, index) => (
            <MotionCard
              key={item.step}
              delay={index * 0.06}
              className="group border-border/70 bg-card/85 p-6 shadow-sm transition-[background-color,border-color,box-shadow] duration-150 hover:border-primary/35 hover:bg-card hover:shadow-lg hover:shadow-primary/10"
            >
              <div className="flex items-start justify-between gap-4">
                <span className="text-sm font-semibold text-primary">{item.step}</span>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-[background-color,transform] duration-150 group-hover:-translate-y-0.5 group-hover:bg-primary/15">
                  <item.icon className="h-5 w-5 transition-transform duration-150 group-hover:scale-110" />
                </span>
              </div>
              <h3 className="mt-5 text-xl font-bold tracking-normal">{item.title}</h3>
              <p className="mt-2 text-sm font-medium text-foreground/80">{item.artifact}</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.description}</p>
            </MotionCard>
          ))}
        </div>
      </div>
    </section>
  )
}

function RoleFeatures({
  activeRoleTab,
  cta,
  setActiveRoleTab,
}: {
  activeRoleTab: string
  cta: CtaState
  setActiveRoleTab: (value: string) => void
}) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <section id="features" className="scroll-mt-24 bg-muted/20 px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          eyebrow="Role-based features"
          title="Different responsibilities, one shared source of truth."
          description="Each role gets a focused workflow instead of another wall of modules."
        />

        <Tabs value={activeRoleTab} onValueChange={setActiveRoleTab} className="mt-10">
          <TabsList className="mx-auto grid h-auto w-full max-w-3xl grid-cols-2 gap-1 rounded-2xl border border-border/70 bg-background/75 p-1.5 sm:grid-cols-4">
            {rolePanels.map((role) => (
              <TabsTrigger key={role.value} value={role.value} className="h-11 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <role.icon className="h-4 w-4" />
                {role.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {rolePanels.map((role) => (
            <TabsContent key={role.value} value={role.value} className="mt-7">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28 }}
                className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
              >
                <motion.div
                  whileHover={shouldReduceMotion ? undefined : { y: -3 }}
                  transition={{ duration: 0.22, ease: smoothEase }}
                >
                  <Card className={cn("overflow-hidden rounded-2xl border-border/70 bg-card/90 p-0 shadow-sm", `bg-gradient-to-br ${role.accent}`)}>
                    <div className="p-6 sm:p-8">
                      <Badge variant="secondary" className="rounded-full">{role.eyebrow}</Badge>
                      <h3 className="mt-5 text-2xl font-bold tracking-normal sm:text-3xl">{role.title}</h3>
                      <p className="mt-4 text-sm leading-6 text-muted-foreground sm:text-base">{role.description}</p>
                      <div className="mt-7 flex items-end gap-3 rounded-2xl border border-border/70 bg-background/70 p-5">
                        <span className="text-4xl font-bold tracking-normal text-primary">{role.metric}</span>
                        <span className="pb-1 text-sm font-medium text-muted-foreground">{role.metricLabel}</span>
                      </div>
                      <Button asChild className="mt-6 h-11 rounded-xl">
                        <Link href={cta.primaryHref}>
                          {cta.isReadyAuthenticated ? "View Dashboard" : "View Dashboard"}
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </Card>
                </motion.div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {role.bullets.map((item, index) => (
                    <motion.div
                      key={item.title}
                      initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
                      animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                      transition={{ duration: 0.24, delay: index * 0.035, ease: smoothEase }}
                      whileHover={shouldReduceMotion ? undefined : { y: -3 }}
                    >
                      <Card className="group h-full rounded-2xl border-border/70 bg-card/85 p-5 shadow-sm transition-colors hover:border-primary/30">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500 transition-transform group-hover:scale-105" />
                        <h4 className="mt-4 text-base font-bold">{item.title}</h4>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.text}</p>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  )
}

function Outcomes() {
  return (
    <section id="outcomes" className="scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-7xl">
        <SectionHeader
          eyebrow="Outcomes"
          title="The page should build trust by showing what improves."
          description="Instead of generic praise, these cards frame the practical outcomes each audience cares about."
        />

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {outcomes.map((outcome, index) => (
            <MotionCard key={outcome.role} delay={index * 0.06} className="rounded-2xl border-border/70 bg-card/85 p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {outcome.initials}
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{outcome.role}</p>
                    <p className="text-xs text-muted-foreground">{outcome.signal}</p>
                  </div>
                </div>
                <outcome.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mt-6 text-xl font-bold tracking-normal">{outcome.title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">&ldquo;{outcome.quote}&rdquo;</p>
              <div className="mt-5 flex gap-1 text-amber-500" aria-label="Positive outcome rating">
                {[0, 1, 2, 3, 4].map((star) => (
                  <Star key={star} className="h-4 w-4 fill-current" />
                ))}
              </div>
            </MotionCard>
          ))}
        </div>
      </div>
    </section>
  )
}

function FAQ({ cta }: { cta: CtaState }) {
  const [openFaq, setOpenFaq] = useState<string>(faqs[0]?.question ?? "")

  return (
    <section id="faq" className="scroll-mt-24 bg-muted/20 px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr]">
          <div>
            <Badge variant="secondary" className="rounded-full">FAQ</Badge>
            <h2 className="mt-4 text-3xl font-bold tracking-normal sm:text-4xl">Questions before the first sprint?</h2>
            <p className="mt-4 text-sm leading-6 text-muted-foreground sm:text-base">
              Short answers for students and academic staff evaluating the workspace.
            </p>
            <Button asChild className="mt-6 h-11 rounded-xl">
              <Link href={cta.primaryHref}>{cta.primaryLabel}</Link>
            </Button>
          </div>

          <div className="grid items-start gap-3 md:grid-cols-2">
            {faqs.map((faq) => (
              <FAQItem
                key={faq.question}
                isOpen={openFaq === faq.question}
                question={faq.question}
                answer={faq.answer}
                onToggle={() => setOpenFaq((current) => (current === faq.question ? "" : faq.question))}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function FinalCTA({ cta }: { cta: CtaState }) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <section className="px-4 py-14 sm:px-6 lg:px-8">
      <motion.div
        className="mx-auto max-w-7xl overflow-hidden rounded-2xl border border-border/70 bg-foreground px-6 py-10 text-background shadow-2xl shadow-primary/10 sm:px-10 lg:px-12"
        initial={shouldReduceMotion ? false : { opacity: 0, y: 22, scale: 0.985 }}
        whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, margin: "-90px" }}
        transition={{ duration: 0.5, ease: smoothEase }}
        whileHover={shouldReduceMotion ? undefined : { y: -3 }}
      >
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-sm font-semibold text-background/70">Ready for a cleaner semester?</p>
            <h2 className="mt-2 text-3xl font-bold tracking-normal sm:text-4xl">Start your graduation workspace today.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-background/70 sm:text-base">
              Bring project planning, supervision, submissions, and grading into one professional workspace.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
            <Button asChild size="lg" className="h-12 rounded-xl bg-background px-6 text-foreground hover:bg-background/90">
              <Link href={cta.primaryHref}>
                {cta.primaryLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 rounded-xl border-background/30 bg-transparent px-6 text-background hover:bg-background/10 hover:text-background">
              <Link href={cta.signInHref}>{cta.signInLabel}</Link>
            </Button>
          </div>
        </div>
      </motion.div>
    </section>
  )
}

function Footer({ cta }: { cta: CtaState }) {
  const currentYear = new Date().getFullYear()
  const groups = footerGroups.map((group) => ({
    ...group,
    links: group.links.map((link) => ({
      ...link,
      href: link.href === "/register" ? cta.primaryHref : link.href === "/login" ? cta.signInHref : link.href,
      label: link.href === "/register" ? cta.primaryLabel : link.href === "/login" ? cta.signInLabel : link.label,
    })),
  }))

  return (
    <footer className="border-t border-border/70 bg-background px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-7 lg:grid-cols-[1.2fr_1fr] lg:gap-9">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <GraduationCap className="h-5 w-5" />
              </span>
              <div>
                <p className="font-bold">GPMS</p>
                <p className="text-sm text-muted-foreground">Graduation Project Management for FCAI teams.</p>
              </div>
            </div>
            <p className="mt-5 max-w-xl text-sm leading-6 text-muted-foreground">
              A premium academic workspace for moving graduation projects from idea to supervised, evidence-backed delivery.
            </p>
          </div>

          <div className="grid grid-cols-[0.85fr_1fr_1.15fr] gap-x-4 gap-y-6 sm:grid-cols-3 sm:gap-6">
            {groups.map((group) => (
              <div key={group.title} className="min-w-0">
                <h3 className="text-sm font-semibold text-foreground">{group.title}</h3>
                <ul className="mt-3 space-y-2.5 sm:space-y-2">
                  {group.links.map((link) => (
                    <li key={`${group.title}-${link.label}`}>
                      <FooterLink href={link.href}>{link.label}</FooterLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-9 flex flex-col gap-3 border-t border-border/70 pt-5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>{currentYear} GPMS. All rights reserved.</p>
          <p>Built for students, supervisors, and academic project teams.</p>
        </div>
      </div>
    </footer>
  )
}

function SectionHeader({
  description,
  eyebrow,
  title,
}: {
  description: string
  eyebrow: string
  title: string
}) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.div
      className="mx-auto max-w-3xl text-center"
      initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
      whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-90px" }}
      transition={{ duration: 0.42, ease: smoothEase }}
    >
      <Badge variant="secondary" className="rounded-full">{eyebrow}</Badge>
      <h2 className="mt-4 text-balance text-3xl font-bold tracking-normal sm:text-4xl lg:text-5xl">{title}</h2>
      <p className="mt-4 text-pretty text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>
    </motion.div>
  )
}

function MotionCard({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
      whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.34, delay, ease: smoothEase }}
      whileHover={shouldReduceMotion ? undefined : { y: -4, scale: 1.008, transition: { duration: 0.14, ease: smoothEase } }}
      whileTap={shouldReduceMotion ? undefined : { scale: 0.992, transition: { duration: 0.08, ease: smoothEase } }}
    >
      <Card className={cn("h-full", className)}>{children}</Card>
    </motion.div>
  )
}

function FAQItem({
  answer,
  isOpen,
  onToggle,
  question,
}: {
  answer: string
  isOpen: boolean
  onToggle: () => void
  question: string
}) {
  const id = question.toLowerCase().replace(/[^a-z0-9]+/g, "-")

  return (
    <Card className="self-start overflow-hidden rounded-2xl border-border/70 bg-card/85 p-0 shadow-sm">
      <button
        type="button"
        className="flex min-h-16 w-full items-center justify-between gap-4 px-5 py-4 text-left"
        aria-expanded={isOpen}
        aria-controls={`${id}-content`}
        id={`${id}-trigger`}
        onClick={onToggle}
      >
        <span className="text-sm font-semibold sm:text-base">{question}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={`${id}-content`}
            role="region"
            aria-labelledby={`${id}-trigger`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="px-5 pb-5 text-sm leading-6 text-muted-foreground">{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}

function FooterLink({ children, href }: { children: ReactNode; href: string }) {
  const className = "group inline-flex min-w-0 items-center gap-1.5 text-[13px] leading-5 text-muted-foreground transition-colors hover:text-foreground sm:text-sm"
  const content = (
    <>
      <span className="min-w-0">{children}</span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
    </>
  )

  if (href.startsWith("#")) {
    return (
      <a href={href} className={className}>
        {content}
      </a>
    )
  }

  return (
    <Link href={href} className={className}>
      {content}
    </Link>
  )
}
