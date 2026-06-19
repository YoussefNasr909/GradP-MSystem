"use client"

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { formatDistanceToNow } from "date-fns"
import { motion } from "framer-motion"
import {
  AlertTriangle,
  ChevronDown,
  CornerDownRight,
  Eye,
  MessageCircle,
  MessageSquare,
  Pin,
  Plus,
  RefreshCw,
  Reply,
  Search,
  Send,
  ShieldAlert,
  ThumbsUp,
  Trash2,
  Sparkles,
  Loader2,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DashboardMetricCard, DashboardStateCard } from "@/components/dashboard/page-shell"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import {
  createDiscussion,
  createDiscussionComment,
  deleteDiscussion as deleteDiscussionRequest,
  deleteDiscussionComment as deleteDiscussionCommentRequest,
  getDiscussionDetail,
  likeDiscussion,
  listDiscussions,
} from "@/lib/api/discussions"
import type {
  ApiDiscussionCategory,
  ApiDiscussionComment,
  ApiDiscussionDetail,
  ApiDiscussionFeed,
  ApiDiscussionSummary,
} from "@/lib/api/types"
import { useAuthStore } from "@/lib/stores/auth-store"
import { cn } from "@/lib/utils"

const filterOptions: Array<{ value: "all" | ApiDiscussionCategory; label: string }> = [
  { value: "all", label: "All" },
  { value: "technical", label: "Technical" },
  { value: "team", label: "Team" },
  { value: "resources", label: "Resources" },
  { value: "general", label: "General" },
]

const createOptions: Array<{ value: ApiDiscussionCategory; label: string }> = [
  { value: "technical", label: "Technical" },
  { value: "team", label: "Team" },
  { value: "resources", label: "Resources" },
  { value: "general", label: "General" },
]

const emptyCreateForm = {
  title: "",
  category: "technical" as ApiDiscussionCategory,
  content: "",
  tags: "",
}

const createTitleMinLength = 3
const createContentMinLength = 10
const createContentMaxLength = 4000
const createTagMaxLength = 40
const createTagMaxCount = 12
const discussionsPerPage = 5

const defaultDiscussionPagination = {
  page: 1,
  limit: discussionsPerPage,
  total: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "U"
}

function parseTags(rawValue: string) {
  return Array.from(
    new Set(
      rawValue
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ).slice(0, 12)
}

type CreateDiscussionForm = typeof emptyCreateForm
type CreateDiscussionErrors = Partial<Record<"title" | "content" | "tags", string>>

function getCreateDiscussionErrors(form: CreateDiscussionForm): CreateDiscussionErrors {
  const title = form.title.trim()
  const content = form.content.trim()
  const tags = form.tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)

  const errors: CreateDiscussionErrors = {}

  if (!title) {
    errors.title = "Enter a title."
  } else if (title.length < createTitleMinLength) {
    errors.title = `Use at least ${createTitleMinLength} characters.`
  }

  if (!content) {
    errors.content = "Enter the discussion content."
  } else if (content.length < createContentMinLength) {
    errors.content = `Use at least ${createContentMinLength} characters.`
  } else if (content.length > createContentMaxLength) {
    errors.content = `Keep it under ${createContentMaxLength} characters.`
  }

  if (tags.length > createTagMaxCount) {
    errors.tags = `Use ${createTagMaxCount} tags or fewer.`
  } else {
    const longTag = tags.find((tag) => tag.length > createTagMaxLength)
    if (longTag) {
      errors.tags = `Keep each tag under ${createTagMaxLength} characters.`
    }
  }

  return errors
}

function formatCategory(category: ApiDiscussionCategory) {
  return createOptions.find((option) => option.value === category)?.label ?? "General"
}

function buildDiscussionPageItems(totalPages: number, currentPage: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const items: Array<number | "ellipsis-left" | "ellipsis-right"> = [1]
  const windowStart = Math.max(2, currentPage - 1)
  const windowEnd = Math.min(totalPages - 1, currentPage + 1)

  if (windowStart > 2) {
    items.push("ellipsis-left")
  }

  for (let page = windowStart; page <= windowEnd; page += 1) {
    items.push(page)
  }

  if (windowEnd < totalPages - 1) {
    items.push("ellipsis-right")
  }

  items.push(totalPages)
  return items
}

function toSummary(discussion: ApiDiscussionDetail): ApiDiscussionSummary {
  return {
    id: discussion.id,
    title: discussion.title,
    content: discussion.content,
    category: discussion.category,
    tags: discussion.tags,
    likeCount: discussion.likeCount,
    viewCount: discussion.viewCount,
    commentCount: discussion.commentCount,
    isPinned: discussion.isPinned,
    createdAt: discussion.createdAt,
    updatedAt: discussion.updatedAt,
    author: discussion.author,
    viewerHasLiked: discussion.viewerHasLiked,
    viewerHasViewed: discussion.viewerHasViewed,
  }
}

function insertCommentIntoTree(
  comments: ApiDiscussionComment[],
  nextComment: ApiDiscussionComment,
): [ApiDiscussionComment[], boolean] {
  if (!nextComment.parentCommentId) {
    return [[...comments, nextComment], true]
  }

  let inserted = false

  const nextComments = comments.map((comment) => {
    if (comment.id === nextComment.parentCommentId) {
      inserted = true
      return {
        ...comment,
        replyCount: comment.replyCount + 1,
        replies: [...comment.replies, nextComment],
      }
    }

    const [nextReplies, replyInserted] = insertCommentIntoTree(comment.replies, nextComment)
    if (!replyInserted) {
      return comment
    }

    inserted = true
    return {
      ...comment,
      replyCount: comment.replyCount + 1,
      replies: nextReplies,
    }
  })

  return [inserted ? nextComments : comments, inserted]
}

function appendCommentToTree(comments: ApiDiscussionComment[], nextComment: ApiDiscussionComment) {
  const [nextComments, inserted] = insertCommentIntoTree(comments, nextComment)
  return inserted ? nextComments : [...comments, nextComment]
}

function upsertDiscussion(items: ApiDiscussionSummary[], nextDiscussion: ApiDiscussionSummary) {
  const hasExisting = items.some((item) => item.id === nextDiscussion.id)

  if (!hasExisting) {
    return [nextDiscussion, ...items].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }

  return items
    .map((item) => (item.id === nextDiscussion.id ? nextDiscussion : item))
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
}

export default function DiscussionsPage() {
  const { currentUser, accessToken, hasHydrated } = useAuthStore()
  const { toast } = useToast()

  const [feed, setFeed] = useState<ApiDiscussionFeed | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<"all" | ApiDiscussionCategory>("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [refreshSeed, setRefreshSeed] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(emptyCreateForm)
  const [isCreating, setIsCreating] = useState(false)
  const [createSubmitAttempted, setCreateSubmitAttempted] = useState(false)

  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [selectedDiscussion, setSelectedDiscussion] = useState<ApiDiscussionDetail | null>(null)
  const [selectedDiscussionId, setSelectedDiscussionId] = useState<string | null>(null)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const [isSummarizing, setIsSummarizing] = useState(false)
  const [discussionSummary, setDiscussionSummary] = useState<{ keyArguments: string[], finalDecision: string } | null>(null)
  const [isEnhancing, setIsEnhancing] = useState(false)
  
  const [summarizingCardId, setSummarizingCardId] = useState<string | null>(null)
  const [cardSummaryData, setCardSummaryData] = useState<{ id: string, title: string, summary: { keyArguments: string[], finalDecision: string } } | null>(null)

  const [commentContent, setCommentContent] = useState("")
  const [replyTargetId, setReplyTargetId] = useState<string | null>(null)
  const [isReplyComposerOpen, setIsReplyComposerOpen] = useState(false)
  const [expandedReplyIds, setExpandedReplyIds] = useState<string[]>([])
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [likePendingIds, setLikePendingIds] = useState<string[]>([])
  const [deleteDiscussionPendingIds, setDeleteDiscussionPendingIds] = useState<string[]>([])
  const [deleteCommentPendingIds, setDeleteCommentPendingIds] = useState<string[]>([])
  const [discussionDeleteTarget, setDiscussionDeleteTarget] = useState<ApiDiscussionSummary | ApiDiscussionDetail | null>(null)
  const [commentDeleteTarget, setCommentDeleteTarget] = useState<ApiDiscussionComment | null>(null)
  const hasLoadedFeedRef = useRef(false)
  const replyTextareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchQuery.trim())
    }, 250)

    return () => window.clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    if (!hasHydrated) {
      return
    }

    if (!accessToken || currentUser?.role === "admin") {
      hasLoadedFeedRef.current = false
      setIsLoading(false)
      setFeed(null)
      return
    }

    const controller = new AbortController()
    let cancelled = false

    async function loadFeed() {
      if (hasLoadedFeedRef.current) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }

      setErrorMessage(null)

      try {
        const nextFeed = await listDiscussions(
          {
            search: debouncedSearch,
            category: categoryFilter,
            page: currentPage,
            limit: discussionsPerPage,
          },
          controller.signal,
        )

        if (cancelled) {
          return
        }

        setFeed(nextFeed)
      } catch (error) {
        if (cancelled || controller.signal.aborted) {
          return
        }

        const message = error instanceof Error ? error.message : "Failed to load discussions."
        setErrorMessage(message)
      } finally {
        if (!cancelled) {
          hasLoadedFeedRef.current = true
          setIsLoading(false)
          setIsRefreshing(false)
        }
      }
    }

    loadFeed()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [accessToken, categoryFilter, currentPage, currentUser?.role, debouncedSearch, hasHydrated, refreshSeed])

  useEffect(() => {
    if (!isReplyComposerOpen) {
      return
    }

    const timer = window.setTimeout(() => {
      replyTextareaRef.current?.focus()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [isReplyComposerOpen, replyTargetId])

  const selectedDiscussionSummary = useMemo(() => {
    if (!selectedDiscussionId) return null
    return feed?.items.find((item) => item.id === selectedDiscussionId) ?? null
  }, [feed?.items, selectedDiscussionId])

  const feedMeta = feed?.meta ?? defaultDiscussionPagination
  const createErrors = useMemo(() => getCreateDiscussionErrors(createForm), [createForm])
  const hasCreateErrors = Object.keys(createErrors).length > 0
  const showCreateErrors = createSubmitAttempted && hasCreateErrors

  const paginationItems = useMemo(() => {
    return buildDiscussionPageItems(feedMeta.totalPages, feedMeta.page)
  }, [feedMeta.page, feedMeta.totalPages])

  function mergeDiscussion(nextDiscussion: ApiDiscussionSummary | ApiDiscussionDetail) {
    setFeed((currentFeed) => {
      if (!currentFeed) return currentFeed

      return {
        ...currentFeed,
        items: upsertDiscussion(currentFeed.items, "comments" in nextDiscussion ? toSummary(nextDiscussion) : nextDiscussion),
      }
    })

    if ("comments" in nextDiscussion) {
      setSelectedDiscussion(nextDiscussion)
    } else {
      setSelectedDiscussion((currentDiscussion) => {
        if (!currentDiscussion || currentDiscussion.id !== nextDiscussion.id) {
          return currentDiscussion
        }

        return {
          ...currentDiscussion,
          ...nextDiscussion,
        }
      })
    }
  }

  async function openDiscussion(discussionId: string) {
    setIsDetailOpen(true)
    setSelectedDiscussionId(discussionId)
    setSelectedDiscussion((currentDiscussion) => (currentDiscussion?.id === discussionId ? currentDiscussion : null))
    setDetailError(null)
    setReplyTargetId(null)
    setIsReplyComposerOpen(false)
    setExpandedReplyIds([])
    setCommentContent("")
    setIsDetailLoading(true)

    try {
      const detail = await getDiscussionDetail(discussionId)
      mergeDiscussion(detail)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load this discussion."
      setDetailError(message)
    } finally {
      setIsDetailLoading(false)
    }
  }

  async function refreshDiscussionDetail(discussionId: string) {
    const detail = await getDiscussionDetail(discussionId)
    mergeDiscussion(detail)
    return detail
  }

  async function handleEnhanceDiscussion() {
    if (!createForm.content.trim()) return
    setIsEnhancing(true)
    try {
      const res = await fetch("/api/enhance-discussion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: createForm.content,
          category: createForm.category,
        }),
      })
      if (!res.ok) throw new Error("Failed to enhance text")
      const data = await res.json()
      if (data.enhancedText) {
        setCreateForm((prev) => ({ ...prev, content: data.enhancedText }))
        toast({ title: "Enhanced!", description: "Your discussion text has been professionally polished.", variant: "default" })
      }
    } catch (err) {
      toast({ title: "Enhancement Failed", description: "Could not polish text at this time.", variant: "destructive" })
    } finally {
      setIsEnhancing(false)
    }
  }

  async function handleSummarizeDiscussion() {
    if (!selectedDiscussion) return
    setIsSummarizing(true)
    setDiscussionSummary(null)
    try {
      // Use the detail object if available (it has comments) or fall back
      const detail = (selectedDiscussion as ApiDiscussionDetail).comments 
        ? (selectedDiscussion as ApiDiscussionDetail) 
        : await refreshDiscussionDetail(selectedDiscussion.id)
      
      const res = await fetch("/api/summarize-discussion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discussionTitle: detail.title,
          discussionContent: detail.content,
          comments: detail.comments?.map(c => ({ author: c.author.fullName, content: c.content })) || [],
        }),
      })
      if (!res.ok) throw new Error("Failed to summarize thread")
      const data = await res.json()
      if (data.keyArguments && data.finalDecision) {
        setDiscussionSummary(data)
      }
    } catch (err) {
      toast({ title: "Summarization Failed", description: "Could not summarize the thread at this time.", variant: "destructive" })
    } finally {
      setIsSummarizing(false)
    }
  }

  async function handleSummarizeFromCard(discussionId: string, title: string) {
    setSummarizingCardId(discussionId)
    try {
      const detail = await refreshDiscussionDetail(discussionId)
      
      const res = await fetch("/api/summarize-discussion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discussionTitle: detail.title,
          discussionContent: detail.content,
          comments: detail.comments?.map(c => ({ author: c.author.fullName, content: c.content })) || [],
        }),
      })
      if (!res.ok) throw new Error("Failed to summarize thread from card")
      const data = await res.json()
      if (data.keyArguments && data.finalDecision) {
        setCardSummaryData({ id: discussionId, title: detail.title, summary: data })
      }
    } catch (err) {
      toast({ title: "Summarization Failed", description: "Could not summarize the thread at this time.", variant: "destructive" })
    } finally {
      setSummarizingCardId(null)
    }
  }

  async function handleCreateDiscussion() {
    const title = createForm.title.trim()
    const content = createForm.content.trim()
    const tags = parseTags(createForm.tags)

    setCreateSubmitAttempted(true)

    if (hasCreateErrors) {
      toast({
        variant: "destructive",
        title: "Check the discussion details",
        description: createErrors.title ?? createErrors.content ?? createErrors.tags ?? "Please review the form.",
      })
      return
    }

    setIsCreating(true)

    try {
      await createDiscussion({
        title,
        category: createForm.category,
        content,
        tags,
      })

      setIsCreateOpen(false)
      setCreateForm(emptyCreateForm)
      setCreateSubmitAttempted(false)
      setCurrentPage(1)
      setRefreshSeed((currentValue) => currentValue + 1)

      toast({
        title: "Discussion created",
        description: "Your discussion is now visible to students, leaders, doctors, and TAs.",
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Could not create discussion",
        description: error instanceof Error ? error.message : "Please try again.",
      })
    } finally {
      setIsCreating(false)
    }
  }

  async function handleCommentSubmit() {
    const activeDiscussion = selectedDiscussion
    const content = commentContent.trim()
    const parentCommentId = replyTargetId

    if (!activeDiscussion || !content) {
      return
    }

    setIsSubmittingComment(true)

    try {
      const createdComment = await createDiscussionComment(activeDiscussion.id, content, parentCommentId)

      setSelectedDiscussion((currentDiscussion) => {
        if (!currentDiscussion || currentDiscussion.id !== activeDiscussion.id) {
          return currentDiscussion
        }

        return {
          ...currentDiscussion,
          commentCount: currentDiscussion.commentCount + 1,
          comments: appendCommentToTree(currentDiscussion.comments, createdComment),
        }
      })

      setFeed((currentFeed) => {
        if (!currentFeed) return currentFeed

        return {
          ...currentFeed,
          items: currentFeed.items.map((item) =>
            item.id === activeDiscussion.id ? { ...item, commentCount: item.commentCount + 1 } : item,
          ),
          stats: {
            ...currentFeed.stats,
            replies: currentFeed.stats.replies + 1,
          },
        }
      })

      setCommentContent("")
      setReplyTargetId(null)
      setIsReplyComposerOpen(false)
      if (parentCommentId) {
        setExpandedReplyIds((currentIds) =>
          currentIds.includes(parentCommentId) ? currentIds : [...currentIds, parentCommentId],
        )
      }
      toast({
        title: parentCommentId ? "Reply added" : "Comment added",
        description: parentCommentId
          ? "Your reply was posted under the selected comment."
          : "Your reply was posted successfully.",
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Could not post comment",
        description: error instanceof Error ? error.message : "Please try again.",
      })
    } finally {
      setIsSubmittingComment(false)
    }
  }

  async function handleLikeDiscussion(discussionId: string) {
    const activeSummary =
      selectedDiscussion?.id === discussionId ? selectedDiscussion : feed?.items.find((item) => item.id === discussionId)

    if (!activeSummary || likePendingIds.includes(discussionId)) {
      return
    }

    setLikePendingIds((currentIds) => [...currentIds, discussionId])

    try {
      const updatedDiscussion = await likeDiscussion(discussionId)
      mergeDiscussion(updatedDiscussion)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Could not register like",
        description: error instanceof Error ? error.message : "Please try again.",
      })
    } finally {
      setLikePendingIds((currentIds) => currentIds.filter((id) => id !== discussionId))
    }
  }

  async function handleDeleteDiscussion(discussionId: string) {
    if (deleteDiscussionPendingIds.includes(discussionId)) {
      return
    }

    const shouldStepBackPage = feedMeta.page > 1 && (feed?.items.length ?? 0) === 1

    setDeleteDiscussionPendingIds((currentIds) => [...currentIds, discussionId])

    try {
      await deleteDiscussionRequest(discussionId)

      if (selectedDiscussion?.id === discussionId || selectedDiscussionId === discussionId) {
        setIsDetailOpen(false)
        setSelectedDiscussion(null)
        setSelectedDiscussionId(null)
        setCommentContent("")
        setReplyTargetId(null)
        setIsReplyComposerOpen(false)
        setExpandedReplyIds([])
        setDiscussionDeleteTarget(null)
        setDetailError(null)
      }

      if (shouldStepBackPage) {
        setCurrentPage((page) => Math.max(1, page - 1))
      } else {
        setRefreshSeed((value) => value + 1)
      }

      toast({
        title: "Discussion deleted",
        description: "Your discussion was removed successfully.",
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Could not delete discussion",
        description: error instanceof Error ? error.message : "Please try again.",
      })
    } finally {
      setDeleteDiscussionPendingIds((currentIds) => currentIds.filter((id) => id !== discussionId))
    }
  }

  function requestDeleteDiscussion(discussion: ApiDiscussionSummary | ApiDiscussionDetail) {
    setDiscussionDeleteTarget(discussion)
  }

  function requestDeleteComment(comment: ApiDiscussionComment) {
    setCommentDeleteTarget(comment)
  }

  async function confirmDeleteDiscussion() {
    if (!discussionDeleteTarget) {
      return
    }

    await handleDeleteDiscussion(discussionDeleteTarget.id)
    setDiscussionDeleteTarget(null)
  }

  async function confirmDeleteComment() {
    if (!commentDeleteTarget) {
      return
    }

    await handleDeleteComment(commentDeleteTarget)
    setCommentDeleteTarget(null)
  }

  async function handleDeleteComment(comment: ApiDiscussionComment) {
    const activeDiscussion = selectedDiscussion

    if (!activeDiscussion || deleteCommentPendingIds.includes(comment.id)) {
      return
    }

    setDeleteCommentPendingIds((currentIds) => [...currentIds, comment.id])

    try {
      await deleteDiscussionCommentRequest(activeDiscussion.id, comment.id)
      await refreshDiscussionDetail(activeDiscussion.id)
      setRefreshSeed((value) => value + 1)

      if (replyTargetId === comment.id) {
        setReplyTargetId(null)
        setIsReplyComposerOpen(false)
        setCommentContent("")
      }
      setExpandedReplyIds((currentIds) => currentIds.filter((id) => id !== comment.id))

      toast({
        title: "Comment deleted",
        description: "Your comment was removed successfully.",
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Could not delete comment",
        description: error instanceof Error ? error.message : "Please try again.",
      })
    } finally {
      setDeleteCommentPendingIds((currentIds) => currentIds.filter((id) => id !== comment.id))
    }
  }

  function openRootReplyComposer() {
    if (replyTargetId !== null || !isReplyComposerOpen) {
      setCommentContent("")
    }
    setReplyTargetId(null)
    setIsReplyComposerOpen(true)
  }

  function openCommentReplyComposer(commentId: string) {
    if (replyTargetId !== commentId || !isReplyComposerOpen) {
      setCommentContent("")
    }
    setReplyTargetId(commentId)
    setIsReplyComposerOpen(true)
  }

  function closeReplyComposer() {
    setIsReplyComposerOpen(false)
    setReplyTargetId(null)
    setCommentContent("")
  }

  function toggleCommentReplies(commentId: string) {
    setExpandedReplyIds((currentIds) =>
      currentIds.includes(commentId) ? currentIds.filter((id) => id !== commentId) : [...currentIds, commentId],
    )
  }

  function renderInlineReplyComposer(targetComment: ApiDiscussionComment | null) {
    const isNestedReply = Boolean(targetComment)

    return (
      <div
        className={cn(
          "rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.055] via-background to-background p-3 shadow-sm ring-1 ring-primary/5 sm:p-4",
          isNestedReply && "ml-12 sm:ml-[52px]",
        )}
      >
        {targetComment ? (
          <div className="mb-3 flex items-start gap-2 rounded-xl border border-primary/15 bg-background/85 px-3 py-2.5 text-sm shadow-xs">
            <CornerDownRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="font-medium text-foreground">Replying to {targetComment.author.fullName}</p>
              <p className="line-clamp-2 break-words text-muted-foreground [overflow-wrap:anywhere]">
                {targetComment.content}
              </p>
            </div>
          </div>
        ) : null}

        <div className="flex gap-3">
          <Avatar className="h-9 w-9 shrink-0 border border-border/70">
            <AvatarImage src={currentUser?.avatar} alt={currentUser?.name ?? "You"} />
            <AvatarFallback>{getInitials(currentUser?.name ?? "You")}</AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1 space-y-3">
            <Textarea
              ref={replyTextareaRef}
              id={isNestedReply ? `discussion-comment-${targetComment?.id}` : "discussion-comment"}
              rows={3}
              value={commentContent}
              placeholder={targetComment ? `Reply to ${targetComment.author.fullName}...` : "Write a reply..."}
              className="min-h-[104px] resize-y rounded-xl border-border/80 bg-background/95 text-[15px] leading-7 shadow-inner shadow-muted/30"
              onChange={(event) => setCommentContent(event.target.value)}
              onKeyDown={handleCommentComposerKeyDown}
            />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-muted-foreground">{commentCharacterCount}/2000</span>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={closeReplyComposer} disabled={isSubmittingComment}>
                  Cancel
                </Button>
                <Button size="sm" className="gap-2" onClick={handleCommentSubmit} disabled={!canSubmitComment}>
                  {isSubmittingComment ? (
                    <>
                      <Spinner className="size-4" />
                      Posting...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Reply
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  function renderCommentThread(comment: ApiDiscussionComment, depth = 0) {
    const isOwnComment = comment.author.id === currentUser?.id
    const isDeletingComment = deleteCommentPendingIds.includes(comment.id)
    const isReplyTarget = isReplyComposerOpen && replyTargetId === comment.id
    const hasReplies = comment.replies.length > 0
    const replyTotal = Math.max(comment.replyCount, comment.replies.length)
    const areRepliesExpanded = expandedReplyIds.includes(comment.id)

    return (
      <div key={comment.id} className={cn("space-y-2.5", depth > 0 && "ml-5 border-l border-border/70 pl-4 sm:ml-10 sm:pl-6")}>
        <article
          className={cn(
            "group relative rounded-2xl py-1 transition-colors",
            isReplyTarget && "bg-primary/[0.04] px-2 ring-1 ring-primary/15",
          )}
        >
          <div className="flex gap-3">
            <Avatar className="h-9 w-9 shrink-0 border border-border/70">
              <AvatarImage src={comment.author.avatarUrl ?? undefined} alt={comment.author.fullName} />
              <AvatarFallback>{getInitials(comment.author.fullName)}</AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1 space-y-2">
              <div
                className={cn(
                  "max-w-3xl rounded-2xl border px-4 py-3.5 shadow-sm transition-colors",
                  isOwnComment ? "border-primary/20 bg-primary/[0.045]" : "border-border/70 bg-background",
                  isReplyTarget && "border-primary/45 bg-background shadow-md shadow-primary/5",
                )}
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{comment.author.fullName}</span>
                  <span>{comment.author.roleLabel}</span>
                  <span className="text-border">/</span>
                  <span>{formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}</span>
                  {isOwnComment ? (
                    <Badge variant="outline" className="h-6 rounded-full border-primary/20 bg-primary/10 px-2">
                      You
                    </Badge>
                  ) : null}
                </div>

                <p className="mt-2 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[15px] leading-7 text-foreground">
                  {comment.content}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 pl-1">
                <Button
                  variant={isReplyTarget ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 gap-2 px-2.5 text-xs"
                  onClick={() => openCommentReplyComposer(comment.id)}
                >
                  <Reply className="h-3.5 w-3.5" />
                  {isReplyTarget ? "Replying" : "Reply"}
                </Button>
                {isOwnComment ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-2 rounded-lg border-destructive/30 bg-background px-2.5 text-xs text-destructive shadow-xs transition-colors hover:border-destructive hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => requestDeleteComment(comment)}
                    disabled={isDeletingComment}
                  >
                    {isDeletingComment ? <Spinner className="size-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
                    Delete
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </article>

        {isReplyTarget ? renderInlineReplyComposer(comment) : null}

        {hasReplies ? (
          <div className="ml-12 space-y-2 sm:ml-[52px]">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-2 px-2 text-xs font-medium text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              onClick={() => toggleCommentReplies(comment.id)}
              aria-expanded={areRepliesExpanded}
            >
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !areRepliesExpanded && "-rotate-90")} />
              {areRepliesExpanded
                ? "Hide replies"
                : `View ${replyTotal} ${replyTotal === 1 ? "reply" : "replies"}`}
            </Button>

            {areRepliesExpanded ? (
              <div className="space-y-3">
                {comment.replies.map((reply) => renderCommentThread(reply, depth + 1))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    )
  }

  const trimmedCommentContent = commentContent.trim()
  const commentCharacterCount = commentContent.length
  const canSubmitComment = Boolean(selectedDiscussion) && Boolean(trimmedCommentContent) && !isSubmittingComment

  function handleCommentComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault()

      if (canSubmitComment) {
        void handleCommentSubmit()
      }
    }
  }

  if (!hasHydrated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Spinner className="size-4" />
          <span>Loading discussions...</span>
        </div>
      </div>
    )
  }

  if (!accessToken) {
    return (
      <div className="mx-auto max-w-3xl">
        <DashboardStateCard
          icon={AlertTriangle}
          title="Sign in required"
          description="You need to sign in before you can view discussions."
          tone="rose"
        />
      </div>
    )
  }

  if (currentUser?.role === "admin") {
    return (
      <div className="mx-auto max-w-3xl">
        <DashboardStateCard
          icon={ShieldAlert}
          title="Discussions are not available for admins"
          description="This shared discussion space is scoped to students, team leaders, doctors, and teaching assistants."
          tone="slate"
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="space-y-5">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-5 rounded-[28px] border border-border/60 bg-gradient-to-br from-primary/[0.07] via-background to-primary/[0.03] p-5 shadow-sm sm:p-6 lg:flex-row lg:items-end lg:justify-between"
        >
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500 text-white shadow-sm">
                <MessageSquare className="h-5 w-5" />
              </span>
              <Badge variant="outline" className="rounded-md border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300">
                Shared academic forum
              </Badge>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Discussions</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                Ask questions, share blockers, and keep supervisor guidance visible to the people who need it.
              </p>
            </div>
          </div>

          <Dialog
            open={isCreateOpen}
            onOpenChange={(open) => {
              setIsCreateOpen(open)
              if (!open) {
                setCreateSubmitAttempted(false)
              }
            }}
          >
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Discussion
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Start a New Discussion</DialogTitle>
                <DialogDescription>Provide a title, category, content, and tags for your discussion.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="discussion-title">Title</Label>
                  <Input
                    id="discussion-title"
                    value={createForm.title}
                    placeholder="What would you like to discuss?"
                    maxLength={160}
                    aria-invalid={Boolean(createSubmitAttempted && createErrors.title)}
                    className={cn(createSubmitAttempted && createErrors.title && "border-destructive focus-visible:ring-destructive")}
                    onChange={(event) => setCreateForm((current) => ({ ...current, title: event.target.value }))}
                  />
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className={cn("text-muted-foreground", createSubmitAttempted && createErrors.title && "text-destructive")}>
                      {createSubmitAttempted && createErrors.title ? createErrors.title : `Minimum ${createTitleMinLength} characters.`}
                    </span>
                    <span className="shrink-0 text-muted-foreground">{createForm.title.trim().length}/160</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="discussion-category">Category</Label>
                  <Select
                    value={createForm.category}
                    onValueChange={(value: ApiDiscussionCategory) =>
                      setCreateForm((current) => ({ ...current, category: value }))
                    }
                  >
                    <SelectTrigger id="discussion-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {createOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="discussion-content">Content</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleEnhanceDiscussion}
                      disabled={isEnhancing || !createForm.content.trim()}
                      className="h-7 text-xs border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/50 dark:hover:text-indigo-200"
                    >
                      {isEnhancing ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1.5 h-3 w-3" />}
                      AI Polish
                    </Button>
                  </div>
                  <Textarea
                    id="discussion-content"
                    rows={7}
                    value={createForm.content}
                    placeholder="Describe your question or topic..."
                    maxLength={createContentMaxLength}
                    aria-invalid={Boolean(createSubmitAttempted && createErrors.content)}
                    className={cn(createSubmitAttempted && createErrors.content && "border-destructive focus-visible:ring-destructive")}
                    onChange={(event) => setCreateForm((current) => ({ ...current, content: event.target.value }))}
                  />
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className={cn("text-muted-foreground", createSubmitAttempted && createErrors.content && "text-destructive")}>
                      {createSubmitAttempted && createErrors.content
                        ? createErrors.content
                        : `Minimum ${createContentMinLength} characters.`}
                    </span>
                    <span className="shrink-0 text-muted-foreground">{createForm.content.trim().length}/{createContentMaxLength}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="discussion-tags">Tags (comma separated)</Label>
                  <Input
                    id="discussion-tags"
                    value={createForm.tags}
                    placeholder="e.g. React, Performance, Design"
                    aria-invalid={Boolean(createSubmitAttempted && createErrors.tags)}
                    className={cn(createSubmitAttempted && createErrors.tags && "border-destructive focus-visible:ring-destructive")}
                    onChange={(event) => setCreateForm((current) => ({ ...current, tags: event.target.value }))}
                  />
                  <p className={cn("text-xs text-muted-foreground", createSubmitAttempted && createErrors.tags && "text-destructive")}>
                    {createSubmitAttempted && createErrors.tags
                      ? createErrors.tags
                      : `Optional. Up to ${createTagMaxCount} tags, ${createTagMaxLength} characters each.`}
                  </p>
                </div>

                {showCreateErrors ? (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Discussion is not ready yet</AlertTitle>
                    <AlertDescription>{createErrors.title ?? createErrors.content ?? createErrors.tags}</AlertDescription>
                  </Alert>
                ) : null}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isCreating}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateDiscussion} disabled={isCreating}>
                    {isCreating ? (
                      <>
                        <Spinner className="size-4" />
                        Creating...
                      </>
                    ) : (
                      "Create Discussion"
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 gap-4 xl:grid-cols-4"
        >
          <DashboardMetricCard label="Total discussions" value={feed?.stats.totalDiscussions ?? 0} icon={MessageSquare} tone="violet" loading={isLoading && !feed} />
          <DashboardMetricCard label="Active today" value={feed?.stats.activeToday ?? 0} icon={RefreshCw} tone="emerald" loading={isLoading && !feed} />
          <DashboardMetricCard label="Your posts" value={feed?.stats.yourPosts ?? 0} icon={Pin} tone="blue" loading={isLoading && !feed} />
          <DashboardMetricCard label="Replies" value={feed?.stats.replies ?? 0} icon={Reply} tone="amber" loading={isLoading && !feed} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="flex flex-col gap-4"
        >
          <Card className="rounded-[20px] border-border/60 bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value)
                  setCurrentPage(1)
                }}
                placeholder="Search discussions..."
                className="pl-10"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {filterOptions.map((option) => (
                <Button
                  key={option.value}
                  size="sm"
                  variant={categoryFilter === option.value ? "default" : "outline"}
                  onClick={() => {
                    setCategoryFilter(option.value)
                    setCurrentPage(1)
                  }}
                >
                  {option.label}
                </Button>
              ))}
              <Button size="sm" variant="ghost" onClick={() => setRefreshSeed((value) => value + 1)} disabled={isRefreshing}>
                {isRefreshing ? <Spinner className="size-4" /> : <RefreshCw className="h-4 w-4" />}
                Refresh
              </Button>
            </div>
          </div>
          </Card>

          {errorMessage ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Could not load discussions</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}
        </motion.div>

        {isLoading ? (
          <div className="flex min-h-[240px] items-center justify-center rounded-2xl border bg-card">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              <span>Loading discussions...</span>
            </div>
          </div>
        ) : feed?.items.length ? (
          <div className="space-y-5">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="space-y-4"
            >
              {feed.items.map((discussion) => {
                const isLikePending = likePendingIds.includes(discussion.id)
                const isDeletingDiscussion = deleteDiscussionPendingIds.includes(discussion.id)
                const canDeleteDiscussion = discussion.author.id === currentUser?.id

                return (
                  <Card
                    key={discussion.id}
                    className="group overflow-hidden rounded-[22px] border-border/70 bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg"
                  >
                    <CardContent className="p-4 sm:p-5">
                      <div className="grid min-w-0 gap-4 md:grid-cols-[auto_minmax(0,1fr)]">
                        <Avatar className="h-11 w-11 shrink-0 border border-border/70 bg-muted">
                          <AvatarImage src={discussion.author.avatarUrl ?? undefined} alt={discussion.author.fullName} />
                          <AvatarFallback>{getInitials(discussion.author.fullName)}</AvatarFallback>
                        </Avatar>

                        <div className="min-w-0 flex-1 space-y-3">
                          <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                {discussion.isPinned ? <Pin className="h-4 w-4 text-amber-500" /> : null}
                                <h2 className="min-w-0 break-words text-lg font-semibold leading-tight transition-colors [overflow-wrap:anywhere] group-hover:text-primary">
                                  {discussion.title}
                                </h2>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                <Badge variant="outline" className="rounded-full bg-background">
                                  {formatCategory(discussion.category)}
                                </Badge>
                                <span>{discussion.author.fullName}</span>
                                <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                                <span>{discussion.author.roleLabel}</span>
                                <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                                <span>{formatDistanceToNow(new Date(discussion.createdAt), { addSuffix: true })}</span>
                              </div>
                            </div>

                            <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
                              <Button
                                variant="outline"
                                className="rounded-xl border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/50 dark:hover:text-indigo-200 px-4 shadow-xs"
                                onClick={() => handleSummarizeFromCard(discussion.id, discussion.title)}
                                disabled={summarizingCardId === discussion.id}
                              >
                                {summarizingCardId === discussion.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                Summarize
                              </Button>
                              <Button
                                variant="outline"
                                className="rounded-xl bg-background px-4 shadow-xs"
                                onClick={() => openDiscussion(discussion.id)}
                              >
                                Open Discussion
                              </Button>
                              {canDeleteDiscussion ? (
                                <Button
                                  variant="outline"
                                  className="gap-2 rounded-xl border-destructive/30 bg-background px-4 text-destructive shadow-xs transition-colors hover:border-destructive hover:bg-destructive hover:text-destructive-foreground"
                                  onClick={() => requestDeleteDiscussion(discussion)}
                                  disabled={isDeletingDiscussion}
                                >
                                  {isDeletingDiscussion ? <Spinner className="size-4" /> : <Trash2 className="h-4 w-4" />}
                                  Delete
                                </Button>
                              ) : null}
                            </div>
                          </div>

                          <p className="line-clamp-3 break-words [overflow-wrap:anywhere] text-sm leading-6 text-muted-foreground">
                            {discussion.content}
                          </p>

                          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-2 rounded-full px-2.5"
                              onClick={() => openDiscussion(discussion.id)}
                            >
                              <MessageCircle className="h-4 w-4" />
                              {discussion.commentCount}
                            </Button>
                            <span className="inline-flex h-8 items-center gap-2 rounded-full px-2.5">
                              <Eye className="h-4 w-4" />
                              {discussion.viewCount}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              className={cn(
                                "h-8 gap-2 rounded-full px-2.5 text-xs font-medium",
                                discussion.viewerHasLiked &&
                                  "border-primary/25 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
                              )}
                              aria-label={
                                discussion.viewerHasLiked
                                  ? `Remove your like. ${discussion.likeCount} likes`
                                  : `Like this discussion. ${discussion.likeCount} likes`
                              }
                              title={discussion.viewerHasLiked ? "Click to remove your like" : "Like this discussion"}
                              onClick={() => handleLikeDiscussion(discussion.id)}
                              disabled={isLikePending}
                            >
                              {isLikePending ? <Spinner className="size-4" /> : <ThumbsUp className="h-4 w-4" />}
                              <span className="tabular-nums">{discussion.likeCount}</span>
                              <span>{discussion.viewerHasLiked ? "Liked" : "Like"}</span>
                            </Button>
                          </div>

                          {discussion.tags.length ? (
                            <div className="flex flex-wrap gap-2">
                              {discussion.tags.map((tag) => (
                                <Badge key={`${discussion.id}-${tag}`} variant="secondary" className="rounded-full">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </motion.div>

            {feedMeta.totalPages > 1 ? (
              <Card className="border-border/70 bg-card/90">
                <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-muted-foreground">
                    Showing {(feedMeta.page - 1) * feedMeta.limit + 1}-
                    {Math.min(feedMeta.page * feedMeta.limit, feedMeta.total)} of {feedMeta.total} discussions
                  </div>

                  <Pagination className="mx-0 w-auto justify-start sm:justify-end">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          className={cn(!feedMeta.hasPreviousPage && "pointer-events-none opacity-50")}
                          onClick={(event) => {
                            event.preventDefault()
                            if (!feedMeta.hasPreviousPage) return
                            setCurrentPage(feedMeta.page - 1)
                          }}
                        />
                      </PaginationItem>

                      {paginationItems.map((item, index) => (
                        <PaginationItem key={`${item}-${index}`}>
                          {typeof item === "number" ? (
                            <PaginationLink
                              href="#"
                              isActive={item === feedMeta.page}
                              onClick={(event) => {
                                event.preventDefault()
                                if (item === feedMeta.page) return
                                setCurrentPage(item)
                              }}
                            >
                              {item}
                            </PaginationLink>
                          ) : (
                            <PaginationEllipsis />
                          )}
                        </PaginationItem>
                      ))}

                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          className={cn(!feedMeta.hasNextPage && "pointer-events-none opacity-50")}
                          onClick={(event) => {
                            event.preventDefault()
                            if (!feedMeta.hasNextPage) return
                            setCurrentPage(feedMeta.page + 1)
                          }}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </CardContent>
              </Card>
            ) : null}
          </div>
        ) : (
          <DashboardStateCard
            icon={MessageSquare}
            title="No discussions found"
            description={
              searchQuery || categoryFilter !== "all"
                ? "No posts match the current search or category."
                : "Start the first thread so your team and supervisors have a clear place to respond."
            }
            action={
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New Discussion
              </Button>
            }
            tone="violet"
          />
        )}
      </div>

      <Dialog
        open={isDetailOpen}
        onOpenChange={(open) => {
          setIsDetailOpen(open)
          if (!open) {
            setDetailError(null)
            setCommentContent("")
            setReplyTargetId(null)
            setIsReplyComposerOpen(false)
            setExpandedReplyIds([])
          }
        }}
      >
        <DialogContent className="grid h-[min(94vh,920px)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-3xl border border-border/70 bg-background/95 p-0 shadow-2xl ring-1 ring-primary/10 sm:max-w-[min(1280px,96vw)] [&_[data-slot=dialog-close]]:right-4 [&_[data-slot=dialog-close]]:top-4 [&_[data-slot=dialog-close]]:z-20 [&_[data-slot=dialog-close]]:rounded-full [&_[data-slot=dialog-close]]:border [&_[data-slot=dialog-close]]:border-border/70 [&_[data-slot=dialog-close]]:bg-background/95 [&_[data-slot=dialog-close]]:p-2 [&_[data-slot=dialog-close]]:opacity-100 [&_[data-slot=dialog-close]]:shadow-sm [&_[data-slot=dialog-close]]:hover:bg-muted">
          <DialogHeader className="relative border-b border-border/70 bg-gradient-to-br from-primary/[0.075] via-background to-background px-5 py-5 pr-20 shadow-sm sm:px-7 sm:py-6 sm:pr-24">
            <div className="absolute inset-x-6 top-0 h-1 rounded-b-full bg-primary/70 sm:inset-x-8" aria-hidden="true" />
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  <span>{selectedDiscussion ? formatCategory(selectedDiscussion.category) : "Discussion"}</span>
                  {selectedDiscussion ? (
                    <>
                      <span className="text-border">/</span>
                      <span>{formatDistanceToNow(new Date(selectedDiscussion.createdAt), { addSuffix: true })}</span>
                    </>
                  ) : null}
                </div>
                <DialogTitle className="max-w-4xl break-words pr-2 text-2xl font-semibold leading-tight tracking-tight [overflow-wrap:anywhere] sm:text-3xl">
                  {selectedDiscussion?.title ?? selectedDiscussionSummary?.title ?? "Discussion details"}
                </DialogTitle>
                {selectedDiscussion ? (
                  <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span>{selectedDiscussion.author.fullName}</span>
                    <span className="text-border">/</span>
                    <span>{selectedDiscussion.author.roleLabel}</span>
                  </DialogDescription>
                ) : (
                  <DialogDescription>Loading discussion details...</DialogDescription>
                )}
              </div>

              {selectedDiscussion ? (
                <div className="flex shrink-0 flex-wrap items-center gap-2 pr-2 lg:max-w-[48%] lg:justify-end lg:pr-8 xl:pr-10">
                  <Badge variant="secondary" className="h-9 gap-1.5 rounded-full px-3">
                    <MessageCircle className="h-3.5 w-3.5" />
                    <span className="tabular-nums">{selectedDiscussion.commentCount}</span>
                    <span className="hidden sm:inline">replies</span>
                  </Badge>
                  <Badge variant="outline" className="h-9 gap-1.5 rounded-full border-border/70 bg-background/80 px-3">
                    <Eye className="h-3.5 w-3.5" />
                    <span className="tabular-nums">{selectedDiscussion.viewCount}</span>
                    <span className="hidden sm:inline">views</span>
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-9 gap-2 rounded-full border-border/70 bg-background/80 px-3 font-medium shadow-xs",
                      selectedDiscussion.viewerHasLiked &&
                        "border-primary/25 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
                    )}
                    aria-label={
                      selectedDiscussion.viewerHasLiked
                        ? `Remove your like. ${selectedDiscussion.likeCount} likes`
                        : `Like this discussion. ${selectedDiscussion.likeCount} likes`
                    }
                    title={selectedDiscussion.viewerHasLiked ? "Click to remove your like" : "Like this discussion"}
                    onClick={() => handleLikeDiscussion(selectedDiscussion.id)}
                    disabled={likePendingIds.includes(selectedDiscussion.id)}
                  >
                    {likePendingIds.includes(selectedDiscussion.id) ? (
                      <Spinner className="size-4" />
                    ) : (
                      <ThumbsUp className="h-4 w-4" />
                    )}
                    <span className="tabular-nums">{selectedDiscussion.likeCount}</span>
                    <span className="hidden sm:inline">{selectedDiscussion.viewerHasLiked ? "Liked" : "Like"}</span>
                  </Button>
                  {selectedDiscussion.author.id === currentUser?.id ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 gap-2 rounded-full border-destructive/30 bg-background px-3 text-destructive shadow-xs transition-colors hover:border-destructive hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => requestDeleteDiscussion(selectedDiscussion)}
                      disabled={deleteDiscussionPendingIds.includes(selectedDiscussion.id)}
                    >
                      {deleteDiscussionPendingIds.includes(selectedDiscussion.id) ? (
                        <Spinner className="size-4" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      Delete
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </DialogHeader>

          {isDetailLoading ? (
            <div className="flex min-h-[320px] items-center justify-center p-6">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Spinner className="size-4" />
                <span>Loading discussion...</span>
              </div>
            </div>
          ) : detailError ? (
            <div className="p-6">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Could not load this discussion</AlertTitle>
                <AlertDescription>{detailError}</AlertDescription>
              </Alert>
            </div>
          ) : selectedDiscussion ? (
            <div className="h-full min-h-0 bg-gradient-to-b from-muted/20 to-background">
              <ScrollArea className="h-full min-h-0">
                <main className="mx-auto max-w-5xl space-y-7 px-4 py-5 sm:px-7 lg:py-8">
                  <article className="overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/[0.07] via-background to-background shadow-lg shadow-primary/5 ring-1 ring-primary/10">
                    <div className="border-b border-primary/15 bg-background/65 px-4 py-3 backdrop-blur sm:px-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <Badge variant="outline" className="h-7 gap-1.5 rounded-full border-primary/25 bg-background/80 px-2.5 text-primary">
                          <MessageSquare className="h-3.5 w-3.5" />
                          Original post
                        </Badge>
                        <span className="text-xs font-medium text-muted-foreground">
                          Started {formatDistanceToNow(new Date(selectedDiscussion.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 sm:p-6">
                      <div className="flex gap-4">
                        <Avatar className="h-12 w-12 shrink-0 border border-primary/20 bg-background shadow-sm">
                          <AvatarImage
                            src={selectedDiscussion.author.avatarUrl ?? undefined}
                            alt={selectedDiscussion.author.fullName}
                          />
                          <AvatarFallback>{getInitials(selectedDiscussion.author.fullName)}</AvatarFallback>
                        </Avatar>

                        <div className="min-w-0 flex-1 space-y-4">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                            <span className="font-semibold text-foreground">{selectedDiscussion.author.fullName}</span>
                            <span>{selectedDiscussion.author.roleLabel}</span>
                          </div>

                          <div className="rounded-2xl border border-border/70 bg-background/95 px-4 py-4 shadow-sm">
                            <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-base leading-8 text-foreground">
                              {selectedDiscussion.content}
                            </p>
                          </div>

                          {selectedDiscussion.tags.length ? (
                            <div className="flex flex-wrap gap-2">
                              {selectedDiscussion.tags.map((tag) => (
                                <Badge key={`${selectedDiscussion.id}-detail-${tag}`} variant="secondary" className="rounded-full">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </article>

                  {/* AI Summarize Section */}
                  <div className="space-y-4">
                    {!discussionSummary && (
                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleSummarizeDiscussion}
                          disabled={isSummarizing}
                          className="border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/50 dark:hover:text-indigo-200"
                        >
                          {isSummarizing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                          Summarize Thread
                        </Button>
                      </div>
                    )}

                    {discussionSummary && (
                      <Alert className="bg-indigo-50/50 border-indigo-200 dark:bg-indigo-950/20 dark:border-indigo-800">
                        <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                        <AlertTitle className="text-indigo-800 dark:text-indigo-300 font-semibold flex items-center justify-between">
                          AI Thread Summary
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setDiscussionSummary(null)}>
                            <Trash2 className="h-3 w-3 text-indigo-500" />
                          </Button>
                        </AlertTitle>
                        <AlertDescription className="mt-3 text-indigo-900 dark:text-indigo-200 space-y-3 text-sm">
                          <div>
                            <strong className="block mb-1">Key Arguments:</strong>
                            <ul className="list-disc pl-5 space-y-1">
                              {discussionSummary.keyArguments.map((arg, i) => (
                                <li key={i}>{arg}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <strong className="block mb-1">Final Decision / Consensus:</strong>
                            <p>{discussionSummary.finalDecision}</p>
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>


                  <section className="space-y-4 rounded-3xl border border-border/70 bg-background/80 p-4 shadow-sm sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold">Replies</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {selectedDiscussion.commentCount
                            ? `${selectedDiscussion.commentCount} ${selectedDiscussion.commentCount === 1 ? "reply" : "replies"} in this thread`
                            : "No replies yet"}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 rounded-full bg-background"
                        onClick={openRootReplyComposer}
                      >
                        <Reply className="h-4 w-4" />
                        Add reply
                      </Button>
                    </div>

                    {isReplyComposerOpen && !replyTargetId ? renderInlineReplyComposer(null) : null}

                    <div className="space-y-3">
                      {selectedDiscussion.comments.length ? (
                        selectedDiscussion.comments.map((comment) => renderCommentThread(comment))
                      ) : (
                        <div className="rounded-2xl border border-dashed border-border/80 bg-muted/30 p-8 text-center">
                          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-background shadow-sm">
                            <MessageCircle className="h-6 w-6 text-muted-foreground" />
                          </span>
                          <h4 className="mt-3 text-base font-semibold">No replies yet</h4>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Be the first to respond to this discussion.
                          </p>
                        </div>
                      )}
                    </div>
                  </section>
                </main>
              </ScrollArea>
            </div>
          ) : (
            <div className="flex min-h-[320px] items-center justify-center p-6 text-sm text-muted-foreground">
              Select a discussion to see its details.
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(cardSummaryData)} onOpenChange={(open) => !open && setCardSummaryData(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400">
              <Sparkles className="h-5 w-5" />
              AI Thread Summary
            </DialogTitle>
            <DialogDescription>
              Summary for: <span className="font-medium text-foreground">{cardSummaryData?.title}</span>
            </DialogDescription>
          </DialogHeader>
          {cardSummaryData && (
            <div className="space-y-4 mt-2">
              <div className="rounded-lg bg-indigo-50/50 p-4 border border-indigo-100 dark:bg-indigo-950/20 dark:border-indigo-800">
                <h4 className="font-semibold text-indigo-900 dark:text-indigo-300 mb-2">Key Arguments</h4>
                <ul className="list-disc pl-5 space-y-1 text-sm text-indigo-800 dark:text-indigo-200">
                  {cardSummaryData.summary.keyArguments.map((arg, i) => (
                    <li key={i}>{arg}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg bg-indigo-50/50 p-4 border border-indigo-100 dark:bg-indigo-950/20 dark:border-indigo-800">
                <h4 className="font-semibold text-indigo-900 dark:text-indigo-300 mb-1">Final Decision / Consensus</h4>
                <p className="text-sm text-indigo-800 dark:text-indigo-200">{cardSummaryData.summary.finalDecision}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(discussionDeleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDiscussionDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this discussion?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {discussionDeleteTarget?.title ?? "this discussion"} and all replies under it. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(discussionDeleteTarget && deleteDiscussionPendingIds.includes(discussionDeleteTarget.id))}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={Boolean(discussionDeleteTarget && deleteDiscussionPendingIds.includes(discussionDeleteTarget.id))}
              onClick={(event) => {
                event.preventDefault()
                void confirmDeleteDiscussion()
              }}
            >
              {discussionDeleteTarget && deleteDiscussionPendingIds.includes(discussionDeleteTarget.id) ? (
                <>
                  <Spinner className="size-4" />
                  Deleting...
                </>
              ) : (
                "Delete discussion"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(commentDeleteTarget)}
        onOpenChange={(open) => {
          if (!open) setCommentDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this reply?</AlertDialogTitle>
            <AlertDialogDescription>
              This reply will be removed from the discussion. You cannot undo this action.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(commentDeleteTarget && deleteCommentPendingIds.includes(commentDeleteTarget.id))}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={Boolean(commentDeleteTarget && deleteCommentPendingIds.includes(commentDeleteTarget.id))}
              onClick={(event) => {
                event.preventDefault()
                void confirmDeleteComment()
              }}
            >
              {commentDeleteTarget && deleteCommentPendingIds.includes(commentDeleteTarget.id) ? (
                <>
                  <Spinner className="size-4" />
                  Deleting...
                </>
              ) : (
                "Delete reply"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
