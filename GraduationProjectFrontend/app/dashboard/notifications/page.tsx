"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Search,
  Clock,
  Calendar,
  FileText,
  MessageSquare,
  Star,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { notifications } from "@/data/notifications"
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"

export default function NotificationsPage() {
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [notificationList, setNotificationList] = useState(notifications)

  const filteredNotifications = notificationList
    .filter((n) => {
      if (filter === "unread") return !n.read
      if (filter === "read") return n.read
      return true
    })
    .filter(
      (n) =>
        n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.content.toLowerCase().includes(searchQuery.toLowerCase()),
    )

  const unreadCount = notificationList.filter((n) => !n.read).length

  const markAsRead = (id: string) => {
    setNotificationList((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }

  const markAllAsRead = () => {
    setNotificationList((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const deleteNotification = (id: string) => {
    setNotificationList((prev) => prev.filter((n) => n.id !== id))
  }

  const getIcon = (type: string) => {
    switch (type) {
      case "task":
        return <CheckCheck className="h-5 w-5" />
      case "meeting":
        return <Calendar className="h-5 w-5" />
      case "submission":
        return <FileText className="h-5 w-5" />
      case "evaluation":
        return <Star className="h-5 w-5" />
      case "message":
        return <MessageSquare className="h-5 w-5" />
      default:
        return <Bell className="h-5 w-5" />
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case "task":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400"
      case "meeting":
        return "bg-purple-500/10 text-purple-600 dark:text-purple-400"
      case "submission":
        return "bg-green-500/10 text-green-600 dark:text-green-400"
      case "evaluation":
        return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
      case "message":
        return "bg-pink-500/10 text-pink-600 dark:text-pink-400"
      default:
        return "bg-gray-500/10 text-gray-600 dark:text-gray-400"
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20">
              <Bell className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
                Notifications
              </h1>
              <p className="text-muted-foreground">Stay updated with your project activities</p>
            </div>
          </div>
        </motion.div>

        {/* Stats Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <div className="p-6 rounded-xl border bg-card/50 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-3xl font-bold">{notificationList.length}</p>
              </div>
              <Bell className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </div>
          <div className="p-6 rounded-xl border bg-card/50 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Unread</p>
                <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{unreadCount}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-indigo-500/30" />
            </div>
          </div>
          <div className="p-6 rounded-xl border bg-card/50 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Read</p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {notificationList.length - unreadCount}
                </p>
              </div>
              <Check className="h-8 w-8 text-green-500/30" />
            </div>
          </div>
        </motion.div>

        {/* Controls */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col md:flex-row gap-4"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search notifications..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")} size="sm">
              All
            </Button>
            <Button variant={filter === "unread" ? "default" : "outline"} onClick={() => setFilter("unread")} size="sm">
              Unread
            </Button>
            <Button variant={filter === "read" ? "default" : "outline"} onClick={() => setFilter("read")} size="sm">
              Read
            </Button>
          </div>

          {unreadCount > 0 && (
            <Button onClick={markAllAsRead} variant="outline" size="sm">
              <CheckCheck className="h-4 w-4 mr-2" />
              Mark all read
            </Button>
          )}
        </motion.div>

        {/* Notifications List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-3"
        >
          {filteredNotifications.length === 0 ? (
            <div className="text-center py-12 border rounded-xl bg-card/50 backdrop-blur-sm">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">No notifications found</p>
            </div>
          ) : (
            filteredNotifications.map((notification, index) => (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`group relative p-4 rounded-xl border transition-all duration-300 hover:shadow-lg ${
                  notification.read
                    ? "bg-card/30 backdrop-blur-sm"
                    : "bg-card backdrop-blur-sm border-indigo-500/30 shadow-md"
                }`}
              >
                <div className="flex gap-4">
                  <div className={`p-3 rounded-lg ${getTypeColor(notification.type)} shrink-0`}>
                    {getIcon(notification.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-foreground">{notification.title}</h3>
                          {!notification.read && <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{notification.content}</p>
                      </div>

                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!notification.read && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => markAsRead(notification.id)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:text-destructive"
                          onClick={() => deleteNotification(notification.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                      </div>
                      {notification.actionUrl && (
                        <Link
                          href={notification.actionUrl}
                          className="text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          View details →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </motion.div>
      </div>
    </div>
  )
}
