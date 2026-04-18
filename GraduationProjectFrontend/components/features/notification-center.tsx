"use client"

import type React from "react"

import { motion, AnimatePresence } from "framer-motion"
import {
  Bell,
  X,
  CheckCircle,
  AlertCircle,
  Info,
  Calendar,
  MessageSquare,
  FileText,
  Award,
  CheckCheck,
  Trash2,
  ArrowRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState, useMemo, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { useAuthStore } from "@/lib/stores/auth-store"
import { notifications as notificationsData } from "@/data/notifications"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState(notificationsData)
  const { currentUser } = useAuthStore()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"all" | "unread">("all")

  useEffect(() => {
    if (isOpen) {
      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as HTMLElement
        if (!target.closest("[data-notification-panel]") && !target.closest("[data-notification-trigger]")) {
          setIsOpen(false)
        }
      }
      document.addEventListener("click", handleClickOutside)
      return () => document.removeEventListener("click", handleClickOutside)
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen && typeof window !== "undefined" && window.innerWidth < 640) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isOpen])

  const userNotifications = useMemo(
    () => notifications.filter((n) => n.userId === currentUser?.id),
    [notifications, currentUser?.id],
  )

  const unreadCount = userNotifications.filter((n) => !n.read).length
  const displayedNotifications = activeTab === "unread" ? userNotifications.filter((n) => !n.read) : userNotifications

  const markAsRead = (id: string) => {
    setNotifications(notifications.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }

  const markAllAsRead = () => {
    setNotifications(notifications.map((n) => (n.userId === currentUser?.id && !n.read ? { ...n, read: true } : n)))
  }

  const deleteNotification = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setNotifications(notifications.filter((n) => n.id !== id))
  }

  const handleNotificationClick = (notification: any) => {
    markAsRead(notification.id)
    if (notification.actionUrl) {
      router.push(notification.actionUrl)
      setIsOpen(false)
    }
  }

  const getIcon = (type: string) => {
    const iconClass = "h-4 w-4 sm:h-5 sm:w-5"
    switch (type) {
      case "task":
        return <CheckCircle className={`${iconClass} text-emerald-500`} />
      case "meeting":
        return <Calendar className={`${iconClass} text-blue-500`} />
      case "submission":
        return <FileText className={`${iconClass} text-indigo-500`} />
      case "evaluation":
        return <Award className={`${iconClass} text-amber-500`} />
      case "message":
        return <MessageSquare className={`${iconClass} text-purple-500`} />
      case "system":
        return <AlertCircle className={`${iconClass} text-red-500`} />
      default:
        return <Info className={`${iconClass} text-slate-500`} />
    }
  }

  const getTypeBadge = (type: string) => {
    const badges: Record<string, { label: string; variant: string }> = {
      task: { label: "Task", variant: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
      meeting: { label: "Meeting", variant: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
      submission: { label: "Submission", variant: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400" },
      evaluation: { label: "Grade", variant: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
      message: { label: "Message", variant: "bg-purple-500/10 text-purple-700 dark:text-purple-400" },
      system: { label: "System", variant: "bg-red-500/10 text-red-700 dark:text-red-400" },
    }
    const badge = badges[type] || { label: "Info", variant: "bg-slate-500/10 text-slate-700 dark:text-slate-400" }
    return <span className={`text-xs px-2 py-0.5 rounded-full ${badge.variant} font-medium`}>{badge.label}</span>
  }

  return (
    <>
      <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
        <Button
          data-notification-trigger
          variant="ghost"
          size="icon"
          className="relative rounded-xl h-9 w-9 sm:h-10 sm:w-10"
          onClick={() => setIsOpen(!isOpen)}
        >
          <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 h-4 w-4 sm:h-5 sm:w-5 rounded-full bg-destructive flex items-center justify-center"
            >
              <span className="text-[10px] sm:text-xs font-bold text-destructive-foreground">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            </motion.span>
          )}
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 h-4 w-4 sm:h-5 sm:w-5 rounded-full bg-destructive animate-ping opacity-75" />
          )}
        </Button>
      </motion.div>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-background/90 backdrop-blur-sm z-40 sm:hidden"
              onClick={() => setIsOpen(false)}
            />

            <motion.div
              data-notification-panel
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed sm:absolute right-0 left-0 sm:left-auto top-14 sm:top-full sm:mt-2 sm:w-96 z-50 bg-card sm:glass-card sm:rounded-2xl border shadow-2xl overflow-hidden mx-0 sm:mx-0 h-[calc(100dvh-3.5rem)] sm:h-auto sm:max-h-[500px]"
            >
              <div className="flex items-center justify-between p-3 sm:p-4 border-b bg-muted/30">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-base sm:text-lg">Notifications</h3>
                  {unreadCount > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {unreadCount} new
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  {unreadCount > 0 && (
                    <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs h-8 px-2 sm:px-3">
                      <CheckCheck className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                      <span className="hidden sm:inline">Mark all read</span>
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="h-8 w-8 rounded-lg">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="p-2 sm:p-3 border-b bg-muted/20">
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "all" | "unread")}>
                  <TabsList className="w-full h-9 sm:h-10">
                    <TabsTrigger value="all" className="flex-1 text-xs sm:text-sm">
                      All
                    </TabsTrigger>
                    <TabsTrigger value="unread" className="flex-1 text-xs sm:text-sm">
                      Unread ({unreadCount})
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="overflow-y-auto flex-1 sm:max-h-[320px] scroll-smooth-touch bg-background/50">
                {displayedNotifications.length > 0 ? (
                  <div className="divide-y">
                    {displayedNotifications.slice(0, 10).map((notification, index) => (
                      <motion.div
                        key={notification.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.03 }}
                        onClick={() => handleNotificationClick(notification)}
                        className={`p-3 sm:p-4 cursor-pointer transition-all hover:bg-muted/80 active:bg-muted group relative ${
                          !notification.read ? "bg-primary/10" : "bg-background/80"
                        }`}
                      >
                        <div className="flex gap-3">
                          <div className="p-2 rounded-lg bg-muted shrink-0">{getIcon(notification.type)}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p
                                className={`text-xs sm:text-sm ${!notification.read ? "font-semibold text-foreground" : "text-foreground/90"} line-clamp-2`}
                              >
                                {notification.message || notification.content}
                              </p>
                              {!notification.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1" />}
                            </div>
                            <div className="flex items-center gap-2 mt-1.5">
                              {getTypeBadge(notification.type)}
                              <span className="text-[10px] sm:text-xs text-muted-foreground">
                                {notification.timestamp || notification.createdAt
                                  ? formatDistanceToNow(new Date(notification.timestamp || notification.createdAt), {
                                      addSuffix: true,
                                    })
                                  : "Recently"}
                              </span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                            onClick={(e) => deleteNotification(notification.id, e)}
                          >
                            <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 sm:p-12 text-center">
                    <Bell className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">No notifications yet</p>
                  </div>
                )}
              </div>

              <div className="p-2 sm:p-3 border-t bg-muted/30 safe-area-bottom">
                <Button
                  variant="ghost"
                  className="w-full justify-center gap-2 h-10 sm:h-9 text-sm"
                  onClick={() => {
                    router.push("/dashboard/notifications")
                    setIsOpen(false)
                  }}
                >
                  View all notifications
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
