"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { BookOpen, FileText, Video, Code, Download, ExternalLink, Search, Star, Eye, Upload, Loader2, Trash2, ShieldCheck, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useAuthStore } from "@/lib/stores/auth-store"
import { useMyTeamState } from "@/lib/hooks/use-my-team-state"
import { getResources, createResource, deleteResource } from "@/lib/api/resources"
import { ApiResource } from "@/lib/api/types"
import { toast } from "sonner"

const categories = [
  { value: "all", label: "All Resources", icon: BookOpen },
  { value: "documentation", label: "Documentation", icon: FileText },
  { value: "tutorial", label: "Tutorials", icon: Video },
  { value: "code", label: "Code Samples", icon: Code },
]

export default function ResourcesPage() {
  const currentUser = useAuthStore((state) => state.currentUser)
  const { data: myTeamState, isLoading: teamLoading } = useMyTeamState()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [resources, setResources] = useState<ApiResource[]>([])
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isForbidden, setIsForbidden] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  
  const [uploadForm, setUploadForm] = useState({
    title: "",
    description: "",
    category: "documentation",
    type: "document" as ApiResource["type"],
    url: "",
    tags: "",
  })

  useEffect(() => {
    const fetchResources = async () => {
      try {
        setLoading(true)
        setIsForbidden(false)
        const data = await getResources({ search: searchQuery, category: selectedCategory })
        setResources(data)
      } catch (error: any) {
        console.error("Failed to fetch resources:", error)
        if (error?.code === "RESOURCES_VIEW_FORBIDDEN" || error?.status === 403) {
          setIsForbidden(true)
        } else {
          toast.error("Failed to load resources")
        }
      } finally {
        setLoading(false)
      }
    }

    const timer = setTimeout(() => {
      fetchResources()
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, selectedCategory])

  const handleUpload = async () => {
    if (!uploadForm.title) {
      toast.error("Title is required")
      return
    }

    if (uploadForm.type === "document" && !selectedFile && !uploadForm.url) {
      toast.error("Please provide a file or a URL for the document")
      return
    }

    if ((uploadForm.type === "video" || uploadForm.type === "link" || uploadForm.type === "course") && !uploadForm.url) {
      toast.error("URL is required for this resource type")
      return
    }

    try {
      setIsSubmitting(true)
      
      await createResource({
        ...uploadForm,
        file: selectedFile || undefined,
        author: currentUser?.name || "Anonymous",
        tags: uploadForm.tags.split(",").map((t) => t.trim()).filter(Boolean),
      })
      
      toast.success("Resource uploaded successfully")
      setIsUploadOpen(false)
      setSelectedFile(null)
      setUploadForm({
        title: "",
        description: "",
        category: "documentation",
        type: "document" as const,
        url: "",
        tags: "",
      })
      // Refresh resources
      const data = await getResources({ search: searchQuery, category: selectedCategory })
      setResources(data)
    } catch (error) {
      console.error("Failed to upload resource:", error)
      toast.error("Failed to upload resource")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return

    try {
      setIsDeleting(true)
      await deleteResource(deleteId)
      toast.success("Resource deleted successfully")
      setResources(resources.filter((r) => r.id !== deleteId))
      setDeleteId(null)
    } catch (error) {
      console.error("Failed to delete resource:", error)
      toast.error("Failed to delete resource")
    } finally {
      setIsDeleting(false)
    }
  }

  const getTypeIcon = (type: ApiResource["type"]) => {
    switch (type) {
      case "document":
        return <FileText className="h-5 w-5" />
      case "video":
        return <Video className="h-5 w-5" />
      case "link":
      case "course":
        return <Code className="h-5 w-5" />
      default:
        return <BookOpen className="h-5 w-5" />
    }
  }

  const getTypeColor = (type: ApiResource["type"]) => {
    switch (type) {
      case "document":
        return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
      case "video":
        return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
      case "link":
      case "course":
        return "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20"
      default:
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-purple-600 to-purple-800 border border-purple-500/20">
              <BookOpen className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-purple-800 dark:from-purple-400 dark:to-purple-600 bg-clip-text text-transparent">
                Learning Resources
              </h1>
              <p className="text-muted-foreground">Access tutorials, documentation, and code samples</p>
            </div>
          </div>

          {(currentUser?.role === "doctor" || currentUser?.role === "ta" || currentUser?.role === "admin") && (
            <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Upload className="h-4 w-4" />
                  Upload Resource
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Upload New Resource</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Title</Label>
                      <Input
                        placeholder="Resource title"
                        value={uploadForm.title}
                        onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Category</Label>
                      <Select
                        value={uploadForm.category}
                        onValueChange={(value) => setUploadForm({ ...uploadForm, category: value as any })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="documentation">Documentation</SelectItem>
                          <SelectItem value="tutorial">Tutorial</SelectItem>
                          <SelectItem value="code">Code Sample</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label>Description</Label>
                    <Textarea
                      placeholder="Describe what this resource covers..."
                      value={uploadForm.description}
                      onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Type</Label>
                      <Select
                        value={uploadForm.type}
                        onValueChange={(value) => setUploadForm({ ...uploadForm, type: value as any })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="document">Document (PDF, PPT, DOC, etc.)</SelectItem>
                          <SelectItem value="video">Video Tutorial</SelectItem>
                          <SelectItem value="link">External Link</SelectItem>
                          <SelectItem value="course">Full Course</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>URL or File</Label>
                      <div className="flex flex-col gap-2">
                        {uploadForm.type === "document" ? (
                          <>
                            <Input
                              type="file"
                              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.txt"
                              className="cursor-pointer"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) {
                                  setSelectedFile(file)
                                  // For demo/simple backend, we also set a dummy URL if file is picked
                                  setUploadForm({ ...uploadForm, url: file.name })
                                }
                              }}
                            />
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground uppercase font-bold">OR</span>
                              <Input
                                placeholder="https://external-link.com"
                                value={uploadForm.url}
                                onChange={(e) => setUploadForm({ ...uploadForm, url: e.target.value })}
                                className="flex-1"
                              />
                            </div>
                          </>
                        ) : (
                          <Input
                            placeholder="https://youtube.com/..."
                            value={uploadForm.url}
                            onChange={(e) => setUploadForm({ ...uploadForm, url: e.target.value })}
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label>Tags (comma-separated)</Label>
                    <Input
                      placeholder="React, JavaScript, Frontend"
                      value={uploadForm.tags}
                      onChange={(e) => setUploadForm({ ...uploadForm, tags: e.target.value })}
                    />
                    {uploadForm.tags && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {uploadForm.tags.split(",").map((t) => t.trim()).filter(Boolean).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-[10px] py-0">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 justify-end pt-4">
                    <Button variant="outline" onClick={() => setIsUploadOpen(false)} disabled={isSubmitting}>
                      Cancel
                    </Button>
                    <Button onClick={handleUpload} disabled={isSubmitting}>
                      {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Upload Resource
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </motion.div>

        {/* Search and Filter */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    placeholder="Search resources by title, description, or tags..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full md:w-auto">
                  <TabsList className="grid grid-cols-4 w-full md:w-auto">
                    {categories.map((cat) => (
                      <TabsTrigger key={cat.value} value={cat.value} className="gap-2">
                        <cat.icon className="h-4 w-4" />
                        <span className="hidden md:inline">{cat.label.split(" ")[0]}</span>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Total Resources</p>
              <p className="text-3xl font-bold mt-2">{loading || isForbidden ? "—" : resources.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Documentation</p>
              <p className="text-3xl font-bold mt-2">
                {loading || isForbidden ? "—" : resources.filter((r) => r.category === "documentation").length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Tutorials</p>
              <p className="text-3xl font-bold mt-2">{loading || isForbidden ? "—" : resources.filter((r) => r.category === "tutorial").length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Code Samples</p>
              <p className="text-3xl font-bold mt-2">{loading || isForbidden ? "—" : resources.filter((r) => r.category === "code").length}</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Resources Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="h-[300px] animate-pulse border-2">
                <CardContent className="p-6 space-y-4">
                  <div className="h-10 w-10 bg-muted rounded-xl" />
                  <div className="h-6 w-3/4 bg-muted rounded" />
                  <div className="space-y-2">
                    <div className="h-4 w-full bg-muted rounded" />
                    <div className="h-4 w-5/6 bg-muted rounded" />
                  </div>
                  <div className="flex gap-2">
                    <div className="h-5 w-16 bg-muted rounded-full" />
                    <div className="h-5 w-16 bg-muted rounded-full" />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : isForbidden ? (
            <div className="col-span-full">
              <Card className="border-2 border-dashed bg-amber-500/5 border-amber-500/20">
                <CardContent className="p-12 flex flex-col items-center text-center">
                  <div className="p-4 rounded-full bg-amber-500/10 mb-6">
                    <ShieldCheck className="h-12 w-12 text-amber-600" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">Restricted Learning Materials</h3>
                  <p className="text-muted-foreground max-w-md mx-auto mb-4">
                    Only Doctors and TAs can upload these resources. To access them, your team must first be assigned a Supervisor (Doctor).
                  </p>
                  {myTeamState?.team ? (
                    <div className="space-y-4">
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                        Your team <span className="font-bold">"{myTeamState.team.name}"</span> is currently waiting for a supervisor.
                      </p>
                      <div className="flex flex-wrap gap-4 justify-center">
                        <Button variant="outline" className="border-amber-500/50 hover:bg-amber-500/10" asChild>
                          <a href="/dashboard/proposals">Invite a Supervisor</a>
                        </Button>
                        <Button variant="ghost" asChild>
                          <a href="/dashboard/my-team">View Team Details</a>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        You need to be part of a supervised team to see these materials.
                      </p>
                      <Button variant="outline" asChild>
                        <a href="/dashboard/my-team">Join or Create a Team</a>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : resources.map((resource, index) => (
            <motion.div
              key={resource.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 * index }}
            >
              <Card className="h-full hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 group">
                <CardContent className="p-6 flex flex-col h-full">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-xl border-2 ${getTypeColor(resource.type)}`}>
                      {getTypeIcon(resource.type)}
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="capitalize">
                        {resource.type}
                      </Badge>
                      {currentUser?.id === resource.createdByDoctorId && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                          onClick={() => setDeleteId(resource.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <h3 className="text-lg font-bold mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                    {resource.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-3 flex-1">{resource.description}</p>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {resource.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-sm text-muted-foreground mb-4 pb-4 border-b">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <Eye className="h-4 w-4" />
                        <span>0</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Download className="h-4 w-4" />
                        <span>0</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      <span className="font-semibold">4.5</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">by {resource.author}</p>
                      <p className="text-xs text-muted-foreground">{new Date(resource.uploadedAt).toLocaleDateString()}</p>
                    </div>
                    <Button size="sm" className="gap-2" asChild>
                      <a href={resource.url} target="_blank" rel="noopener noreferrer">
                        {resource.type === "video" || resource.type === "link" || resource.type === "course" ? (
                          <>
                            <ExternalLink className="h-4 w-4" />
                            Open
                          </>
                        ) : (
                          <>
                            <Download className="h-4 w-4" />
                            Download
                          </>
                        )}
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {!loading && resources.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12 border-2 border-dashed rounded-xl"
          >
            <BookOpen className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Resources Found</h3>
            <p className="text-muted-foreground">Try adjusting your search or filter criteria</p>
          </motion.div>
        )}

        {/* Confirmation Dialog */}
        <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Confirm Deletion
              </DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete this resource? This action cannot be undone and will remove it from the learning materials library.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeleteId(null)} disabled={isDeleting}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete Resource
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
