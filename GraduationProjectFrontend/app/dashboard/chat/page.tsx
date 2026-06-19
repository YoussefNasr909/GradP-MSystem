"use client"

import { Suspense, useState } from "react"
import { Bot, MessageSquare } from "lucide-react"
import { ChatWorkspace } from "@/components/features/chat/chat-workspace"
import { AiAssistantPanel } from "@/components/features/chat/ai-assistant-panel"
import { cn } from "@/lib/utils"

type Tab = "messages" | "ai"

export default function ChatPage() {
  const [activeTab, setActiveTab] = useState<Tab>("messages")

  return (
    <div className="flex h-[calc(100dvh-5rem)] sm:h-[calc(100dvh-5.5rem)] md:h-[calc(100dvh-6rem)] lg:h-[calc(100dvh-6.5rem)] flex-col overflow-hidden rounded-[28px] border border-border/70 bg-card dark:border-zinc-800/70 dark:bg-zinc-950">
      {/* Tab Bar */}
      <div className="flex shrink-0 items-center gap-1 border-b border-border/70 bg-card/80 px-4 py-2 backdrop-blur-xl dark:border-zinc-800/60 dark:bg-zinc-900/80">
        <button
          onClick={() => setActiveTab("messages")}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all",
            activeTab === "messages"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <MessageSquare className="h-4 w-4" />
          Messages
        </button>
        <button
          onClick={() => setActiveTab("ai")}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all",
            activeTab === "ai"
              ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Bot className="h-4 w-4" />
          AI Assistant
          {activeTab !== "ai" && (
            <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
              NEW
            </span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === "messages" ? (
          <Suspense>
            <ChatWorkspace variant="page" className="h-full rounded-none border-none" />
          </Suspense>
        ) : (
          <AiAssistantPanel />
        )}
      </div>
    </div>
  )
}
