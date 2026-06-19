"use client"

import { useState, Suspense } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { MessageCircle, X, Bot, MessageSquare } from "lucide-react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { ChatWorkspace } from "@/components/features/chat/chat-workspace"
import { AiAssistantPanel } from "@/components/features/chat/ai-assistant-panel"
import { useChat } from "@/components/features/chat/chat-provider"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Tab = "messages" | "ai"

export function ChatLauncher() {
  const pathname = usePathname()
  const { unreadCount } = useChat()
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>("messages")

  if (pathname === "/dashboard/chat") {
    return null
  }

  return (
    <>
      <div className="pointer-events-none fixed bottom-5 right-4 z-[70] sm:bottom-6 sm:right-6">
        <motion.div
          className="pointer-events-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Button
            onClick={() => setOpen((current) => !current)}
            aria-label={open ? "Close chat launcher" : "Open chat launcher"}
            className="relative h-14 w-14 rounded-[22px] shadow-[0_24px_60px_-24px_rgba(37,99,235,0.65)]"
            size="icon"
          >
            {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
            {unreadCount > 0 ? (
              <>
                <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-destructive-foreground">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
                <span className="absolute -right-1 -top-1 h-6 w-6 animate-ping rounded-full bg-destructive/70" />
              </>
            ) : null}
          </Button>
        </motion.div>
      </div>

      <AnimatePresence>
        {open ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[65] bg-background/70 backdrop-blur-sm md:hidden"
            />

            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 280, damping: 28 }}
              className="fixed inset-x-3 bottom-[5.5rem] top-20 z-[68] sm:inset-auto sm:bottom-24 sm:right-6 sm:top-auto sm:h-[min(82vh,720px)] sm:w-[min(92vw,480px)] flex flex-col overflow-hidden rounded-[32px] shadow-[0_32px_80px_-28px_rgba(0,0,0,0.75)] dark:border-zinc-800/60 border border-border/70 bg-card dark:bg-zinc-950"
            >
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/70 bg-card/90 px-3 py-2 backdrop-blur-xl sm:px-5 sm:py-3 dark:border-zinc-800/60 dark:bg-zinc-900/80">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveTab("messages")}
                    className={cn(
                      "flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium transition-all",
                      activeTab === "messages"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <MessageSquare className="h-4 w-4" />
                    <span className="hidden sm:inline">Messages</span>
                  </button>
                  <button
                    onClick={() => setActiveTab("ai")}
                    className={cn(
                      "flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium transition-all",
                      activeTab === "ai"
                        ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Bot className="h-4 w-4" />
                    <span className="hidden sm:inline">AI</span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="hidden rounded-full px-3 text-muted-foreground hover:bg-muted hover:text-foreground md:inline-flex dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                  >
                    <Link href="/dashboard/chat">Open page</Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                    onClick={() => setOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-hidden relative">
                {activeTab === "messages" ? (
                  <Suspense>
                    <ChatWorkspace variant="launcher" hideHeader className="h-full border-none rounded-none shadow-none" onClose={() => setOpen(false)} />
                  </Suspense>
                ) : (
                  <AiAssistantPanel />
                )}
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </>
  )
}
