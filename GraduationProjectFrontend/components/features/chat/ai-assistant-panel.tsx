"use client"

import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Bot,
  Send,
  Sparkles,
  Trash2,
  User,
  Loader2,
  ChevronDown,
} from "lucide-react"
import { useAuthStore } from "@/lib/stores/auth-store"
import { useMyTeamState } from "@/lib/hooks/use-my-team-state"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { getFullName } from "@/lib/team-display"
import ReactMarkdown from "react-markdown"

const STORAGE_KEY_PREFIX = "gpms_ai_history_"

type Message = {
  id: string
  role: "user" | "assistant"
  content: string
}

const SUGGESTED_QUESTIONS: Record<string, string[]> = {
  leader: [
    "How do I invite a new member to my team?",
    "How do I request a doctor supervisor?",
    "How do I create tasks for my team?",
    "How do I submit a proposal?",
  ],
  member: [
    "How do I find my team's tasks?",
    "How can I track my time on a task?",
    "How do I join a team?",
    "How do I chat with my supervisor?",
  ],
  doctor: [
    "How do I review a student proposal?",
    "How do I schedule a meeting with my team?",
    "How do I evaluate a submission?",
    "How do I generate an AI rubric?",
  ],
  ta: [
    "How do I review a task?",
    "How do I see my assigned teams?",
    "How do I give feedback on a submission?",
    "How do I schedule a meeting?",
  ],
  admin: [
    "How do I create a new user?",
    "How do I view system logs?",
    "How do I manage all teams?",
    "How do I post an announcement?",
  ],
  default: [
    "What can I do on this platform?",
    "How does the gamification system work?",
    "How do I update my profile?",
    "What is a graduation project sprint?",
  ],
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
        <Bot className="h-4 w-4" />
      </div>
      <div className="rounded-2xl rounded-bl-sm bg-muted/60 px-4 py-3">
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-indigo-400"
              animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ message, isNew }: { message: Message; isNew?: boolean }) {
  const isUser = message.role === "user"

  return (
    <motion.div
      initial={isNew ? { opacity: 0, y: 10 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className={cn("flex items-end gap-3", isUser && "flex-row-reverse")}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-gradient-to-br from-indigo-500 to-purple-600 text-white"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Bubble */}
      <div
        className={cn(
          "max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "rounded-br-sm bg-primary text-primary-foreground"
            : "rounded-bl-sm bg-muted/70 text-foreground dark:bg-zinc-800/80"
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-headings:my-2">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </motion.div>
  )
}

export function AiAssistantPanel() {
  const { currentUser } = useAuthStore()
  const { data: teamData } = useMyTeamState()
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const storageKey = currentUser?.id ? `${STORAGE_KEY_PREFIX}${currentUser.id}` : null

  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === "undefined" || !storageKey) return []
    try {
      const raw = localStorage.getItem(storageKey)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })
  const [input, setInput] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)

  const userContext = useMemo(() => ({
    role: currentUser?.role ?? "unknown",
    teamName: teamData?.team?.name ?? null,
    hasDoctor: !!teamData?.team?.doctor,
    hasTA: !!teamData?.team?.ta,
    doctorName: teamData?.team?.doctor ? getFullName(teamData.team.doctor as any) : null,
    taName: teamData?.team?.ta ? getFullName(teamData.team.ta as any) : null,
    isLeader: teamData?.teamRole === "LEADER",
  }), [
    currentUser?.role,
    teamData,
  ])

  // Persist messages
  useEffect(() => {
    if (!storageKey || messages.length === 0) return
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages))
    } catch { /* ignore full storage */ }
  }, [messages, storageKey])

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior, block: "end" })
  }, [])

  useEffect(() => {
    scrollToBottom("auto")
  }, [messages.length, scrollToBottom])

  const handleClearHistory = () => {
    setMessages([])
    if (storageKey) localStorage.removeItem(storageKey)
  }

  const handleSend = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isStreaming) return

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: trimmed }
    const assistantId = (Date.now() + 1).toString()
    const assistantMsg: Message = { id: assistantId, role: "assistant", content: "" }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setInput("")
    setIsStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }))

      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, userContext }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) throw new Error("Request failed")

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        accumulated += chunk
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: accumulated } : m))
        )
      }

      if (!accumulated) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: "Sorry, I couldn't generate a response. Please try again." } : m
          )
        )
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "Something went wrong. Please try again." }
            : m
        )
      )
    } finally {
      setIsStreaming(false)
      abortRef.current = null
      scrollToBottom()
    }
  }, [isStreaming, messages, userContext, scrollToBottom])

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    void handleSend(input)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void handleSend(input)
    }
  }

  const handleSuggestedQuestion = (question: string) => {
    void handleSend(question)
  }

  const roleKey = currentUser?.role && SUGGESTED_QUESTIONS[currentUser.role] ? currentUser.role : "default"
  const suggestions = SUGGESTED_QUESTIONS[roleKey]
  const showSuggestions = messages.length === 0

  return (
    <div className="flex h-full min-h-0 flex-col bg-background dark:bg-zinc-950">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border/70 px-5 py-3.5 dark:border-zinc-800/70">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20">
          <Bot className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-foreground">AI Assistant</h2>
          <p className="text-xs text-muted-foreground truncate">
            Knows your platform, your team &amp; everything in between
          </p>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive"
            onClick={handleClearHistory}
            title="Clear chat history"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="flex flex-col gap-4 px-5 py-5">
            {/* Welcome message */}
            {showSuggestions && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-4"
              >
                <div className="flex items-end gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="max-w-[78%] rounded-2xl rounded-bl-sm bg-muted/70 px-4 py-3 text-sm dark:bg-zinc-800/80">
                    <p className="font-medium">
                      Hi{currentUser?.firstName ? `, ${currentUser.firstName}` : ""}! 👋
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      I&apos;m your ProjectHub AI Assistant. I know everything about this platform, your team, and can answer general software engineering questions too.
                    </p>
                    {teamData?.team && (
                      <p className="mt-1.5 text-xs text-indigo-500 dark:text-indigo-400">
                        I can see you&apos;re{" "}
                        {userContext.isLeader ? "the Leader" : "a Member"} of{" "}
                        <strong>{teamData.team.name}</strong>.
                        {!userContext.hasDoctor && " You don't have a Doctor yet — ask me how to get one!"}
                      </p>
                    )}
                  </div>
                </div>

                {/* Suggested questions */}
                <div className="flex flex-col gap-2 pl-11">
                  <p className="text-xs font-medium text-muted-foreground">Suggested questions:</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((q) => (
                      <button
                        key={q}
                        onClick={() => handleSuggestedQuestion(q)}
                        disabled={isStreaming}
                        className="rounded-full border border-border/70 bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Chat messages */}
            {messages.map((message, i) => {
              if (isStreaming && i === messages.length - 1 && message.content === "") {
                return <TypingIndicator key="typing" />
              }
              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isNew={i >= messages.length - 2}
                />
              )
            })}

            <div ref={bottomRef} className="h-1" />
          </div>
        </ScrollArea>
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border/70 p-4 dark:border-zinc-800/70">
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <div className="relative flex-1">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything about the platform or your project…"
              rows={1}
              className="max-h-32 min-h-[44px] resize-none rounded-2xl border-border/70 bg-muted/40 pr-4 py-3 text-sm leading-relaxed placeholder:text-muted-foreground/60 focus-visible:ring-indigo-400/50 dark:bg-zinc-800/50"
            />
          </div>
          <Button
            type="submit"
            disabled={!input.trim() || isStreaming}
            size="icon"
            className="h-11 w-11 shrink-0 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 transition-all hover:scale-105 active:scale-95"
          >
            {isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
        <p className="mt-2 text-center text-[10px] text-muted-foreground/60">
          <Sparkles className="mb-0.5 mr-1 inline h-2.5 w-2.5" />
          Powered by Gemini · Knows your team data · History saved locally
        </p>
      </div>
    </div>
  )
}
