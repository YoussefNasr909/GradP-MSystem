"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { MessageSquare, Plus, Search, Pin, MessageCircle, ThumbsUp, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatDistanceToNow } from "date-fns"
import { TeamRequiredGuard } from "@/components/team-required-guard"

const discussions = [
  {
    id: "d1",
    title: "Best practices for React component optimization",
    content: "I'm working on optimizing our components for better performance. What are your recommendations?",
    author: { name: "Youssef Ahmed", avatar: "/placeholder.svg?height=40&width=40", role: "Student Leader" },
    category: "Technical",
    tags: ["React", "Performance"],
    replies: 12,
    views: 145,
    likes: 23,
    isPinned: true,
    createdAt: "2025-02-14T09:30:00Z",
  },
  {
    id: "d2",
    title: "Database schema design for graduation projects",
    content: "Looking for advice on structuring the database for a complex project with multiple entities.",
    author: { name: "Sara Mohamed", avatar: "/placeholder.svg?height=40&width=40", role: "Student" },
    category: "Technical",
    tags: ["Database", "Design"],
    replies: 8,
    views: 98,
    likes: 15,
    isPinned: false,
    createdAt: "2025-02-13T14:20:00Z",
  },
  {
    id: "d3",
    title: "How to manage team conflicts during project development?",
    content: "Our team is facing some disagreements on implementation approaches. Any advice?",
    author: { name: "Ahmed Hassan", avatar: "/placeholder.svg?height=40&width=40", role: "Student Leader" },
    category: "Team Management",
    tags: ["Teamwork", "Communication"],
    replies: 15,
    views: 203,
    likes: 31,
    isPinned: false,
    createdAt: "2025-02-12T11:15:00Z",
  },
  {
    id: "d4",
    title: "Recommended resources for learning machine learning",
    content: "Can anyone share good resources for implementing ML algorithms in our project?",
    author: { name: "Mariam Ali", avatar: "/placeholder.svg?height=40&width=40", role: "Student" },
    category: "Resources",
    tags: ["Machine Learning", "Learning"],
    replies: 20,
    views: 312,
    likes: 45,
    isPinned: true,
    createdAt: "2025-02-11T16:40:00Z",
  },
]

export default function DiscussionsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const filteredDiscussions = discussions
    .filter((d) => {
      if (categoryFilter !== "all" && d.category !== categoryFilter) return false
      if (searchQuery && !d.title.toLowerCase().includes(searchQuery.toLowerCase())) return false
      return true
    })
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      return 0
    })

  return (
    <TeamRequiredGuard
      pageName="Discussions"
      pageDescription="Connect with peers and supervisors to discuss project topics."
      icon={<MessageSquare className="h-10 w-10 text-primary" />}
    >
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20">
                <MessageSquare className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
                  Discussions
                </h1>
                <p className="text-sm text-muted-foreground">Connect with peers and supervisors</p>
              </div>
            </div>

            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">New Discussion</span>
                  <span className="sm:hidden">New</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl mx-4 sm:mx-auto">
                <DialogHeader>
                  <DialogTitle>Start a New Discussion</DialogTitle>
                  <DialogDescription>Provide a title, category, content, and tags for your discussion.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div>
                    <Label>Title</Label>
                    <Input placeholder="What would you like to discuss?" />
                  </div>
                  <div>
                    <Label>Category</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="technical">Technical</SelectItem>
                        <SelectItem value="team">Team Management</SelectItem>
                        <SelectItem value="resources">Resources</SelectItem>
                        <SelectItem value="general">General</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Content</Label>
                    <Textarea placeholder="Describe your question or topic..." rows={6} />
                  </div>
                  <div>
                    <Label>Tags (comma separated)</Label>
                    <Input placeholder="e.g. React, Performance, Design" />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={() => setIsCreateOpen(false)}>Create Discussion</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4"
          >
            <div className="p-3 sm:p-4 rounded-xl border bg-card/50 backdrop-blur-sm">
              <p className="text-xs sm:text-sm text-muted-foreground mb-1">Total Discussions</p>
              <p className="text-xl sm:text-2xl font-bold">124</p>
            </div>
            <div className="p-3 sm:p-4 rounded-xl border bg-card/50 backdrop-blur-sm">
              <p className="text-xs sm:text-sm text-muted-foreground mb-1">Active Today</p>
              <p className="text-xl sm:text-2xl font-bold text-purple-600 dark:text-purple-400">18</p>
            </div>
            <div className="p-3 sm:p-4 rounded-xl border bg-card/50 backdrop-blur-sm">
              <p className="text-xs sm:text-sm text-muted-foreground mb-1">Your Posts</p>
              <p className="text-xl sm:text-2xl font-bold">7</p>
            </div>
            <div className="p-3 sm:p-4 rounded-xl border bg-card/50 backdrop-blur-sm">
              <p className="text-xs sm:text-sm text-muted-foreground mb-1">Replies</p>
              <p className="text-xl sm:text-2xl font-bold">23</p>
            </div>
          </motion.div>

          {/* Filters */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col md:flex-row gap-4"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search discussions..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button
                variant={categoryFilter === "all" ? "default" : "outline"}
                onClick={() => setCategoryFilter("all")}
                size="sm"
              >
                All
              </Button>
              <Button
                variant={categoryFilter === "Technical" ? "default" : "outline"}
                onClick={() => setCategoryFilter("Technical")}
                size="sm"
              >
                Technical
              </Button>
              <Button
                variant={categoryFilter === "Team Management" ? "default" : "outline"}
                onClick={() => setCategoryFilter("Team Management")}
                size="sm"
                className="hidden sm:flex"
              >
                Team
              </Button>
              <Button
                variant={categoryFilter === "Resources" ? "default" : "outline"}
                onClick={() => setCategoryFilter("Resources")}
                size="sm"
                className="hidden sm:flex"
              >
                Resources
              </Button>
            </div>
          </motion.div>

          {/* Discussions List */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-4"
          >
            {filteredDiscussions.map((discussion, index) => (
              <motion.div
                key={discussion.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="group p-4 sm:p-6 rounded-xl border bg-card/50 backdrop-blur-sm hover:shadow-lg transition-all duration-300 cursor-pointer"
              >
                <div className="flex gap-3 sm:gap-4">
                  <Avatar className="h-10 w-10 sm:h-12 sm:w-12 shrink-0">
                    <AvatarImage src={discussion.author.avatar || "/placeholder.svg"} />
                    <AvatarFallback>{discussion.author.name[0]}</AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 sm:gap-4 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {discussion.isPinned && <Pin className="h-4 w-4 text-yellow-500 shrink-0" />}
                          <h3 className="font-semibold text-sm sm:text-lg group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors line-clamp-1">
                            {discussion.title}
                          </h3>
                        </div>
                        <Badge variant="outline" className="text-[10px] sm:text-xs">
                          {discussion.category}
                        </Badge>
                        <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 mt-2">
                          {discussion.content}
                        </p>

                        <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground mt-2 flex-wrap">
                          <span className="font-medium">{discussion.author.name}</span>
                          <span className="hidden sm:inline">·</span>
                          <span className="hidden sm:inline">{discussion.author.role}</span>
                          <span>·</span>
                          <span>{formatDistanceToNow(new Date(discussion.createdAt), { addSuffix: true })}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 sm:gap-6 mt-3 sm:mt-4">
                      <div className="flex items-center gap-1.5 text-xs sm:text-sm">
                        <MessageCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                        <span>{discussion.replies}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs sm:text-sm">
                        <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                        <span>{discussion.views}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs sm:text-sm">
                        <ThumbsUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
                        <span>{discussion.likes}</span>
                      </div>

                      <div className="hidden sm:flex gap-2 ml-auto flex-wrap">
                        {discussion.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </TeamRequiredGuard>
  )
}
