"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Send,
  Search,
  Plus,
  MoreVertical,
  Paperclip,
  Smile,
  Phone,
  Video,
  Bot,
  Pin,
  ArrowLeft,
  MessageSquare,
} from "lucide-react"
import { users } from "@/data/users"
import { useAuthStore } from "@/lib/stores/auth-store"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"

interface Message {
  id: string
  senderId: string
  content: string
  timestamp: string
  isRead: boolean
  type: "text" | "file" | "image" | "system"
  fileUrl?: string
  fileName?: string
  reactions?: { emoji: string; userIds: string[] }[]
  replyTo?: string
}

interface Channel {
  id: string
  name: string
  teamId?: string
  type: "team" | "direct" | "group" | "ai-bot"
  memberIds: string[]
  lastMessage?: Message
  unreadCount: number
  isPinned?: boolean
  avatar?: string
}

const mockChannels: Channel[] = [
  {
    id: "ai-bot",
    name: "ProjectHub AI Assistant",
    type: "ai-bot",
    memberIds: ["u1", "u2", "u3", "u4", "u5", "u6", "u7", "u8", "u9", "u10", "u11", "u12", "u13", "u14", "ai-bot"],
    unreadCount: 0,
    isPinned: true,
    avatar: "/futuristic-helper-robot.png",
    lastMessage: {
      id: "ai-m1",
      senderId: "ai-bot",
      content: "Hi! I'm your AI assistant. Ask me anything about your project!",
      timestamp: new Date(Date.now() - 10 * 60000).toISOString(),
      isRead: true,
      type: "text",
    },
  },
  {
    id: "c1",
    name: "Smart Campus - General",
    teamId: "t1",
    type: "team",
    memberIds: ["u7", "u10", "u11", "u2", "u5"],
    unreadCount: 3,
    isPinned: true,
    lastMessage: {
      id: "m1",
      senderId: "u10",
      content: "The IoT integration is working great!",
      timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
      isRead: false,
      type: "text",
    },
  },
  {
    id: "c2",
    name: "Dr. Ahmed Hassan",
    type: "direct",
    memberIds: ["u7", "u2"],
    unreadCount: 1,
    lastMessage: {
      id: "m2",
      senderId: "u2",
      content: "Please review the latest submission",
      timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
      isRead: false,
      type: "text",
    },
  },
]

const mockMessages: Record<string, Message[]> = {
  "ai-bot": [
    {
      id: "ai-1",
      senderId: "ai-bot",
      content:
        "Hello! I'm ProjectHub AI Assistant. I can help you with project management, coding questions, documentation, and more. How can I assist you today?",
      timestamp: new Date(Date.now() - 60 * 60000).toISOString(),
      isRead: true,
      type: "text",
    },
  ],
  c1: [
    {
      id: "1",
      senderId: "u10",
      content: "Hey team, I've finished the sensor integration module!",
      timestamp: new Date(Date.now() - 2 * 60 * 60000).toISOString(),
      isRead: true,
      type: "text",
      reactions: [{ emoji: "🎉", userIds: ["u7", "u11"] }],
    },
    {
      id: "2",
      senderId: "u7",
      content: "That's awesome! Can you push it to the repo?",
      timestamp: new Date(Date.now() - 1.5 * 60 * 60000).toISOString(),
      isRead: true,
      type: "text",
    },
    {
      id: "3",
      senderId: "u10",
      content: "The IoT integration is working great!",
      timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
      isRead: true,
      type: "text",
    },
  ],
}

const aiResponses = [
  "I'd be happy to help with that! Based on your project requirements, I suggest...",
  "Great question! Here's what I recommend for your graduation project...",
  "Let me analyze that for you. The best approach would be...",
  "I understand your concern. Here are some solutions you might consider...",
  "That's an interesting challenge! Have you tried implementing...",
]

export default function ChatPage() {
  const { currentUser } = useAuthStore()
  const [channels, setChannels] = useState<Channel[]>(mockChannels)
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [channelFilter, setChannelFilter] = useState<"all" | "teams" | "direct">("all")
  const [showChannelList, setShowChannelList] = useState(true)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  useEffect(() => {
    if (selectedChannel) {
      setMessages(mockMessages[selectedChannel.id] || [])
      if (isMobile) {
        setShowChannelList(false)
      }
    }
  }, [selectedChannel, isMobile])

  const handleSelectChannel = (channel: Channel) => {
    setSelectedChannel(channel)
    if (isMobile) {
      setShowChannelList(false)
    }
  }

  const handleBackToChannels = () => {
    setShowChannelList(true)
    setSelectedChannel(null)
  }

  const filteredChannels = channels.filter((channel) => {
    const matchesSearch = channel.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter =
      channelFilter === "all" ||
      (channelFilter === "teams" && channel.type === "team") ||
      (channelFilter === "direct" && (channel.type === "direct" || channel.type === "ai-bot"))
    const isMember = channel.memberIds.includes(currentUser?.id || "")
    return matchesSearch && matchesFilter && isMember
  })

  const pinnedChannels = filteredChannels.filter((c) => c.isPinned)
  const regularChannels = filteredChannels.filter((c) => !c.isPinned)

  const sendMessage = () => {
    if (!newMessage.trim() || !selectedChannel) return

    const message: Message = {
      id: `msg-${Date.now()}`,
      senderId: currentUser?.id || "",
      content: newMessage,
      timestamp: new Date().toISOString(),
      isRead: false,
      type: "text",
    }

    setMessages((prev) => [...prev, message])
    setNewMessage("")

    if (selectedChannel.type === "ai-bot") {
      setTimeout(() => {
        const aiResponse: Message = {
          id: `ai-${Date.now()}`,
          senderId: "ai-bot",
          content: aiResponses[Math.floor(Math.random() * aiResponses.length)],
          timestamp: new Date().toISOString(),
          isRead: true,
          type: "text",
        }
        setMessages((prev) => [...prev, aiResponse])
      }, 1000)
    }

    toast.success("Message sent")
  }

  const getUser = (userId: string) => {
    if (userId === "ai-bot") {
      return { name: "ProjectHub AI", avatar: "/futuristic-helper-robot.png" }
    }
    return users.find((u) => u.id === userId)
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-[calc(100dvh-8rem)] sm:h-[calc(100dvh-10rem)]"
    >
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold gradient-text">Chat & Q/A</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">Communicate with your team</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 sm:gap-2 h-8 sm:h-9 text-xs sm:text-sm">
              <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">New Chat</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md mx-4 sm:mx-auto">
            <DialogHeader>
              <DialogTitle>Start New Conversation</DialogTitle>
              <DialogDescription>Search and select a user to start a direct conversation.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Input placeholder="Search users..." className="h-10" />
              <ScrollArea className="h-[200px] sm:h-[300px]">
                {users
                  .filter((u) => u.id !== currentUser?.id)
                  .map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-3 p-2 sm:p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    >
                      <Avatar className="h-8 w-8 sm:h-10 sm:w-10">
                        <AvatarImage src={user.avatar || "/placeholder.svg"} />
                        <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{user.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
                      </div>
                    </div>
                  ))}
              </ScrollArea>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="glass-card h-[calc(100%-3rem)] sm:h-[calc(100%-4rem)] overflow-hidden">
        <div className="flex h-full">
          {/* Channel List - Hidden on mobile when chat is open */}
          <AnimatePresence>
            {(showChannelList || !isMobile) && (
              <motion.div
                initial={isMobile ? { x: -300, opacity: 0 } : false}
                animate={{ x: 0, opacity: 1 }}
                exit={isMobile ? { x: -300, opacity: 0 } : undefined}
                className={`${isMobile ? "absolute inset-0 z-10 bg-background" : "w-72 lg:w-80"} border-r flex flex-col`}
              >
                <div className="p-2 sm:p-3 border-b space-y-2 sm:space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search chats..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-9 sm:h-10 text-sm"
                    />
                  </div>
                  <Tabs value={channelFilter} onValueChange={(v) => setChannelFilter(v as any)}>
                    <TabsList className="w-full h-8 sm:h-9">
                      <TabsTrigger value="all" className="flex-1 text-xs sm:text-sm">
                        All
                      </TabsTrigger>
                      <TabsTrigger value="teams" className="flex-1 text-xs sm:text-sm">
                        Teams
                      </TabsTrigger>
                      <TabsTrigger value="direct" className="flex-1 text-xs sm:text-sm">
                        Direct
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                <ScrollArea className="flex-1">
                  {pinnedChannels.length > 0 && (
                    <div className="p-2">
                      <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase px-2 mb-1 sm:mb-2">
                        Pinned
                      </p>
                      {pinnedChannels.map((channel) => (
                        <ChannelItem
                          key={channel.id}
                          channel={channel}
                          isSelected={selectedChannel?.id === channel.id}
                          onClick={() => handleSelectChannel(channel)}
                          formatTime={formatTime}
                        />
                      ))}
                    </div>
                  )}
                  <div className="p-2">
                    <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase px-2 mb-1 sm:mb-2">
                      Recent
                    </p>
                    {regularChannels.map((channel) => (
                      <ChannelItem
                        key={channel.id}
                        channel={channel}
                        isSelected={selectedChannel?.id === channel.id}
                        onClick={() => handleSelectChannel(channel)}
                        formatTime={formatTime}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Chat Area */}
          <div className={`flex-1 flex flex-col ${isMobile && showChannelList ? "hidden" : ""}`}>
            {selectedChannel ? (
              <>
                {/* Chat Header */}
                <div className="h-12 sm:h-14 border-b flex items-center justify-between px-2 sm:px-4">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    {isMobile && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleBackToChannels}>
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                    )}
                    <Avatar className="h-8 w-8 shrink-0">
                      {selectedChannel.type === "ai-bot" ? (
                        <div className="h-full w-full rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                          <Bot className="h-4 w-4 text-white" />
                        </div>
                      ) : (
                        <>
                          <AvatarImage src={selectedChannel.avatar || "/placeholder.svg"} />
                          <AvatarFallback>{selectedChannel.name.charAt(0)}</AvatarFallback>
                        </>
                      )}
                    </Avatar>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm truncate">{selectedChannel.name}</h3>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">
                        {selectedChannel.type === "ai-bot"
                          ? "AI Assistant"
                          : `${selectedChannel.memberIds.length} members`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 hidden sm:flex">
                      <Phone className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hidden sm:flex">
                      <Video className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-2 sm:p-4">
                  <div className="space-y-3 sm:space-y-4">
                    {messages.map((message) => {
                      const sender = getUser(message.senderId)
                      const isOwn = message.senderId === currentUser?.id
                      const isAI = message.senderId === "ai-bot"

                      return (
                        <motion.div
                          key={message.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`flex gap-2 sm:gap-3 ${isOwn ? "flex-row-reverse" : ""}`}
                        >
                          <Avatar className="h-7 w-7 sm:h-8 sm:w-8 shrink-0">
                            {isAI ? (
                              <div className="h-full w-full rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                                <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                              </div>
                            ) : (
                              <>
                                <AvatarImage src={sender?.avatar || "/placeholder.svg"} />
                                <AvatarFallback className="text-xs">{sender?.name?.charAt(0)}</AvatarFallback>
                              </>
                            )}
                          </Avatar>
                          <div className={`max-w-[75%] sm:max-w-[70%] ${isOwn ? "items-end" : ""}`}>
                            <div className="flex items-center gap-2 mb-0.5 sm:mb-1">
                              <span className="text-xs sm:text-sm font-medium">{isOwn ? "You" : sender?.name}</span>
                              <span className="text-[10px] sm:text-xs text-muted-foreground">
                                {formatTime(message.timestamp)}
                              </span>
                            </div>
                            <div
                              className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl text-xs sm:text-sm ${
                                isOwn
                                  ? "bg-primary text-primary-foreground"
                                  : isAI
                                    ? "bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20"
                                    : "bg-muted"
                              }`}
                            >
                              {message.content}
                            </div>
                            {message.reactions && message.reactions.length > 0 && (
                              <div className="flex gap-1 mt-1">
                                {message.reactions.map((reaction, i) => (
                                  <span key={i} className="text-xs bg-muted px-1.5 py-0.5 rounded-full">
                                    {reaction.emoji} {reaction.userIds.length}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </ScrollArea>

                {/* Message Input */}
                <div className="p-2 sm:p-4 border-t">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 hidden sm:flex">
                      <Paperclip className="h-4 w-4" />
                    </Button>
                    <Input
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                      className="flex-1 h-9 sm:h-10 text-sm"
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 hidden sm:flex">
                      <Smile className="h-4 w-4" />
                    </Button>
                    <Button size="icon" onClick={sendMessage} className="h-8 w-8 sm:h-9 sm:w-9 shrink-0">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center p-4">
                <div className="text-center">
                  <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3 sm:mb-4">
                    <MessageSquare className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold mb-1 sm:mb-2">Select a conversation</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground max-w-xs mx-auto">
                    Choose a chat to start messaging or create a new conversation
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

function ChannelItem({
  channel,
  isSelected,
  onClick,
  formatTime,
}: {
  channel: any
  isSelected: boolean
  onClick: () => void
  formatTime: (timestamp: string) => string
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-xl cursor-pointer transition-all ${
        isSelected ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/50 active:bg-muted/70"
      }`}
      style={{ minHeight: 44 }}
    >
      <div className="relative shrink-0">
        <Avatar className="h-10 w-10 sm:h-12 sm:w-12">
          {channel.type === "ai-bot" ? (
            <div className="h-full w-full rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center animate-pulse">
              <Bot className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
          ) : (
            <>
              <AvatarImage src={channel.avatar || "/placeholder.svg"} />
              <AvatarFallback className="text-sm">{channel.name.charAt(0)}</AvatarFallback>
            </>
          )}
        </Avatar>
        {channel.type === "ai-bot" && (
          <span className="absolute -top-0.5 -right-0.5 text-[8px] sm:text-[10px] bg-gradient-to-r from-purple-500 to-pink-500 text-white px-1 sm:px-1.5 py-0.5 rounded-full font-bold">
            AI
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-semibold text-xs sm:text-sm truncate">{channel.name}</h4>
          {channel.lastMessage && (
            <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0">
              {formatTime(channel.lastMessage.timestamp)}
            </span>
          )}
        </div>
        {channel.lastMessage && (
          <p className="text-[10px] sm:text-xs text-muted-foreground truncate mt-0.5">{channel.lastMessage.content}</p>
        )}
      </div>
      {channel.unreadCount > 0 && (
        <Badge className="h-4 w-4 sm:h-5 sm:w-5 p-0 flex items-center justify-center text-[10px] sm:text-xs shrink-0">
          {channel.unreadCount}
        </Badge>
      )}
      {channel.isPinned && <Pin className="h-3 w-3 text-muted-foreground shrink-0" />}
    </motion.div>
  )
}
