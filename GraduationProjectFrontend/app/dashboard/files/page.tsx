"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  FileText,
  ImageIcon,
  Video,
  FileArchive,
  File,
  Upload,
  Search,
  Download,
  Trash2,
  FolderOpen,
  Loader2,
  AlertTriangle,
  Users,
} from "lucide-react"
import { useAuthStore } from "@/lib/stores/auth-store"
import { TeamRequiredGuard } from "@/components/team-required-guard"
import { useMyTeamState } from "@/lib/hooks/use-my-team-state"
import {
  getTeamDocuments,
  getDocumentsForSupervisor,
  deleteTeamDocument,
  createTeamDocument,
} from "@/lib/api/resources"
import { ApiDocument } from "@/lib/api/types"
import { toast } from "sonner"

const fileIcons = {
  document: FileText,
  image: ImageIcon,
  video: Video,
  archive: FileArchive,
  code: File,
  other: File,
}

const fileTypeColors = {
  document: "text-blue-500",
  image: "text-green-500",
  video: "text-purple-500",
  archive: "text-orange-500",
  code: "text-cyan-500",
  other: "text-gray-500",
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

export default function FilesPage() {
  const { currentUser } = useAuthStore()
  const { data: myTeamState, isLoading: teamLoading } = useMyTeamState()

  const isLeader = currentUser?.role === "leader"
  const isMember = currentUser?.role === "member" || currentUser?.role === "leader"
  const isSupervisor = currentUser?.role === "doctor" || currentUser?.role === "ta"

  const [documents, setDocuments] = useState<ApiDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("all")
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [selectedSupervisedTeamId, setSelectedSupervisedTeamId] = useState<string>("")

  const [uploadForm, setUploadForm] = useState({
    title: "",
    description: "",
    category: "deliverable" as "deliverable" | "documentation" | "other",
    tags: "",
  })

  // For team members, use their own team; for supervisors, use selected supervised team
  const memberTeamId = myTeamState?.team?.id
  const supervisedTeams = myTeamState?.supervisedTeams ?? []
  const effectiveTeamId = isSupervisor ? selectedSupervisedTeamId || undefined : memberTeamId

  // Auto-select first supervised team
  useEffect(() => {
    if (isSupervisor && supervisedTeams.length > 0 && !selectedSupervisedTeamId) {
      setSelectedSupervisedTeamId(supervisedTeams[0].id)
    }
  }, [isSupervisor, supervisedTeams, selectedSupervisedTeamId])

  useEffect(() => {
    const fetchDocuments = async () => {
      if (!effectiveTeamId) {
        setLoading(false)
        setDocuments([])
        return
      }

      try {
        setLoading(true)
        const data = isSupervisor
          ? await getDocumentsForSupervisor({
              teamId: effectiveTeamId,
              search: searchQuery,
              category: activeTab === "all" ? undefined : activeTab,
            })
          : await getTeamDocuments(effectiveTeamId, {
              search: searchQuery,
              category: activeTab === "all" ? undefined : activeTab,
            })
        setDocuments(data)
      } catch (error) {
        console.error("Failed to fetch documents:", error)
        toast.error("Failed to load documents")
      } finally {
        setLoading(false)
      }
    }

    const timer = setTimeout(fetchDocuments, 300)
    return () => clearTimeout(timer)
  }, [effectiveTeamId, searchQuery, activeTab, isSupervisor])

  const refreshDocuments = async () => {
    if (!effectiveTeamId) return
    try {
      const data = isSupervisor
        ? await getDocumentsForSupervisor({
            teamId: effectiveTeamId,
            search: searchQuery,
            category: activeTab === "all" ? undefined : activeTab,
          })
        : await getTeamDocuments(effectiveTeamId, {
            search: searchQuery,
            category: activeTab === "all" ? undefined : activeTab,
          })
      setDocuments(data)
    } catch {
      // Silently fail on refresh
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return

    try {
      setIsDeleting(true)
      await deleteTeamDocument(deleteId)
      toast.success("Document deleted successfully")
      setDocuments(documents.filter((d) => d.id !== deleteId))
      setDeleteId(null)
    } catch (error) {
      console.error("Failed to delete document:", error)
      toast.error("Failed to delete document")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleUpload = async () => {
    setFormErrors({})

    const errors: Record<string, string> = {}
    if (!uploadForm.title.trim()) errors.title = "Title is required"
    else if (uploadForm.title.trim().length < 3) errors.title = "Title must be at least 3 characters"

    if (!uploadForm.description.trim()) errors.description = "Description is required"
    else if (uploadForm.description.trim().length < 8) errors.description = "Description must be at least 8 characters"

    if (!selectedFile) errors.file = "Please select a document file"

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      toast.error("Please fix the validation errors")
      return
    }

    try {
      setIsSubmitting(true)
      await createTeamDocument({
        ...uploadForm,
        file: selectedFile!,
        tags: uploadForm.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      })
      toast.success("Document uploaded successfully")
      setIsUploadOpen(false)
      setSelectedFile(null)
      setUploadForm({ title: "", description: "", category: "deliverable", tags: "" })
      await refreshDocuments()
    } catch (error: any) {
      console.error("Failed to upload document:", error)
      if (error?.status === 400 && error?.errors) setFormErrors(error.errors)
      toast.error(error?.message || "Failed to upload document")
    } finally {
      setIsSubmitting(false)
    }
  }

  const deliverables = documents.filter((f) => f.category === "deliverable")
  const documentation = documents.filter((f) => f.category === "documentation")
  const totalSize = documents.reduce((acc, f) => acc + (f.fileSize || 0), 0)

  return (
    <TeamRequiredGuard
      pageName="Documents"
      pageDescription="Manage your team's non-code deliverables, reports, and shared resources."
      icon={<FolderOpen className="h-10 w-10 text-primary" />}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Documents</h1>
            <p className="text-muted-foreground mt-1">
              Keep reports, deliverables, and supporting files organized in one place
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Team selector for supervisors */}
            {isSupervisor && supervisedTeams.length > 0 && (
              <Select value={selectedSupervisedTeamId} onValueChange={setSelectedSupervisedTeamId}>
                <SelectTrigger className="w-48">
                  <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Select a team" />
                </SelectTrigger>
                <SelectContent>
                  {supervisedTeams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Upload button for team members only */}
            {isMember && (
              <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Document
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Upload Team Document</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className={formErrors.title ? "text-destructive" : ""}>Title</Label>
                        <Input
                          placeholder="e.g. SRS Document"
                          value={uploadForm.title}
                          onChange={(e) => {
                            setUploadForm({ ...uploadForm, title: e.target.value })
                            if (formErrors.title) setFormErrors({ ...formErrors, title: "" })
                          }}
                          className={formErrors.title ? "border-destructive focus-visible:ring-destructive" : ""}
                        />
                        {formErrors.title && (
                          <p className="text-[10px] font-medium text-destructive">{formErrors.title}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Select
                          value={uploadForm.category}
                          onValueChange={(value: "deliverable" | "documentation" | "other") =>
                            setUploadForm({ ...uploadForm, category: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="deliverable">Deliverable</SelectItem>
                            <SelectItem value="documentation">Documentation</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className={formErrors.description ? "text-destructive" : ""}>Description</Label>
                      <Textarea
                        placeholder="What is this document about?"
                        value={uploadForm.description}
                        onChange={(e) => {
                          setUploadForm({ ...uploadForm, description: e.target.value })
                          if (formErrors.description) setFormErrors({ ...formErrors, description: "" })
                        }}
                        rows={3}
                        className={
                          formErrors.description ? "border-destructive focus-visible:ring-destructive" : ""
                        }
                      />
                      {formErrors.description && (
                        <p className="text-[10px] font-medium text-destructive">{formErrors.description}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className={formErrors.file ? "text-destructive" : ""}>Document File</Label>
                      <Input
                        type="file"
                        className={cn(
                          "cursor-pointer",
                          formErrors.file ? "border-destructive focus-visible:ring-destructive" : ""
                        )}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            setSelectedFile(file)
                            if (formErrors.file) setFormErrors({ ...formErrors, file: "" })
                          }
                        }}
                      />
                      {formErrors.file && (
                        <p className="text-[10px] font-medium text-destructive">{formErrors.file}</p>
                      )}
                      {selectedFile && (
                        <p className="text-[10px] text-muted-foreground">
                          Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Tags (comma-separated)</Label>
                      <Input
                        placeholder="SRS, Frontend, Design"
                        value={uploadForm.tags}
                        onChange={(e) => setUploadForm({ ...uploadForm, tags: e.target.value })}
                      />
                      {uploadForm.tags && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {uploadForm.tags
                            .split(",")
                            .map((t) => t.trim())
                            .filter(Boolean)
                            .map((tag) => (
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
                        Upload
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Supervisor no supervised teams notice */}
        {isSupervisor && supervisedTeams.length === 0 && !teamLoading && (
          <Card className="p-6 text-center border-dashed">
            <Users className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-medium">No supervised teams</p>
            <p className="text-sm text-muted-foreground mt-1">
              You are not assigned as a supervisor to any team yet.
            </p>
          </Card>
        )}

        <div className="grid gap-4 sm:gap-6 grid-cols-2 md:grid-cols-4">
          <Card className="p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-2">
              <FolderOpen className="h-5 w-5 text-primary" />
              <span className="font-medium text-sm">Total Documents</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold">{loading ? "..." : documents.length}</p>
          </Card>
          <Card className="p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="h-5 w-5 text-blue-500" />
              <span className="font-medium text-sm">Deliverables</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold">{loading ? "..." : deliverables.length}</p>
          </Card>
          <Card className="p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-2">
              <File className="h-5 w-5 text-green-500" />
              <span className="font-medium text-sm">Documentation</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold">{loading ? "..." : documentation.length}</p>
          </Card>
          <Card className="p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-2">
              <FileArchive className="h-5 w-5 text-amber-500" />
              <span className="font-medium text-sm">Storage Used</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold">{loading ? "..." : formatFileSize(totalSize)}</p>
          </Card>
        </div>

        <Card className="p-4 sm:p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="all" className="text-xs sm:text-sm">
                All ({loading ? "..." : documents.length})
              </TabsTrigger>
              <TabsTrigger value="deliverable" className="text-xs sm:text-sm">
                Deliverables ({loading ? "..." : deliverables.length})
              </TabsTrigger>
              <TabsTrigger value="documentation" className="text-xs sm:text-sm">
                Docs ({loading ? "..." : documentation.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-6">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin mb-4" />
                  <p>Loading documents...</p>
                </div>
              ) : !effectiveTeamId ? (
                <div className="text-center py-12 border-2 border-dashed rounded-xl">
                  <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground">
                    {isSupervisor ? "Select a team to view documents." : "No team found."}
                  </p>
                </div>
              ) : (
                <FileTable
                  files={documents}
                  onDelete={(id) => setDeleteId(id)}
                  isLeader={isLeader}
                  showTeam={isSupervisor}
                />
              )}
            </TabsContent>
          </Tabs>
        </Card>

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
                Are you sure you want to delete this document? This action cannot be undone and will remove
                the file from the team&apos;s storage.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDeleteId(null)} disabled={isDeleting}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete Document
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TeamRequiredGuard>
  )
}

function FileTable({
  files,
  onDelete,
  isLeader,
  showTeam,
}: {
  files: ApiDocument[]
  onDelete: (id: string) => void
  isLeader: boolean
  showTeam: boolean
}) {
  if (files.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed rounded-xl">
        <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground">No documents found.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            {showTeam && <TableHead className="hidden sm:table-cell">Team</TableHead>}
            <TableHead className="hidden sm:table-cell">Type</TableHead>
            <TableHead className="hidden lg:table-cell">Tags</TableHead>
            <TableHead className="hidden md:table-cell">Size</TableHead>
            <TableHead className="hidden md:table-cell">Uploaded by</TableHead>
            <TableHead className="hidden md:table-cell">Date</TableHead>
            <TableHead className="text-right"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((file) => {
            const rawType = (file.fileType || "other").toLowerCase()
            const fileType = (rawType in fileIcons ? rawType : "other") as keyof typeof fileIcons
            const Icon = fileIcons[fileType]
            const colorClass = fileTypeColors[fileType]

            return (
              <TableRow key={file.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Icon className={`h-5 w-5 ${colorClass}`} />
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium text-sm truncate max-w-[150px] sm:max-w-none">
                        {file.title}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{file.fileName}</span>
                    </div>
                  </div>
                </TableCell>
                {showTeam && (
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    {file.teamName}
                  </TableCell>
                )}
                <TableCell className="hidden sm:table-cell">
                  <Badge variant="outline" className="capitalize">
                    {file.fileType}
                  </Badge>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {file.tags && file.tags.length > 0 ? (
                      file.tags.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-[9px] px-1.5 py-0">
                          {tag}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                    {file.tags && file.tags.length > 2 && (
                      <span className="text-[9px] text-muted-foreground">+{file.tags.length - 2}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground hidden md:table-cell">
                  {formatFileSize(file.fileSize)}
                </TableCell>
                <TableCell className="text-muted-foreground hidden md:table-cell text-xs">
                  {file.uploadedByName}
                </TableCell>
                <TableCell className="text-muted-foreground hidden md:table-cell text-xs">
                  {new Date(file.uploadedAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" asChild>
                      <a href={file.url} target="_blank" rel="noopener noreferrer">
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                    {isLeader && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => onDelete(file.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
