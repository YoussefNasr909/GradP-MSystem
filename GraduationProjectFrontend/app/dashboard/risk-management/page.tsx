"use client"

import { useAuthStore } from "@/lib/stores/auth-store"
import { useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Plus, TrendingUp, AlertTriangle, Edit, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { teams } from "@/data/teams"
import { TeamRequiredGuard } from "@/components/team-required-guard"

export default function RiskManagementPage() {
  const { currentUser } = useAuthStore()
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [selectedRisk, setSelectedRisk] = useState<any>(null)

  const isStudent = currentUser?.role === "member" || currentUser?.role === "leader"
  const myTeam = isStudent
    ? teams.find((t) => t.leaderId === currentUser?.id || t.memberIds.includes(currentUser?.id || ""))
    : null

  // Show TeamRequiredGuard for students without a team
  if (isStudent && !myTeam) {
    return (
      <TeamRequiredGuard
        pageName="Risk Management"
        pageDescription="Identify, assess, and mitigate project risks with your team"
        icon={<AlertTriangle className="h-12 w-12" />}
      >
        <>
        </>
      </TeamRequiredGuard>
    )
  }

  const risks = [
    {
      id: "r1",
      title: "Team Member Availability",
      description: "Risk of team member leaving or becoming unavailable during critical phase",
      category: "People",
      probability: "medium",
      impact: "high",
      severity: "high",
      status: "active",
      mitigation: "Cross-train team members on critical tasks",
      owner: "Team Leader",
      createdDate: "2024-01-15",
    },
    {
      id: "r2",
      title: "Technology Stack Changes",
      description: "Risk of required technology becoming deprecated or unsupported",
      category: "Technical",
      probability: "low",
      impact: "medium",
      severity: "low",
      status: "monitoring",
      mitigation: "Use stable, well-supported technologies",
      owner: "Tech Lead",
      createdDate: "2024-01-18",
    },
    {
      id: "r3",
      title: "Scope Creep",
      description: "Risk of project scope expanding beyond initial requirements",
      category: "Project",
      probability: "high",
      impact: "high",
      severity: "critical",
      status: "active",
      mitigation: "Strict change control process and regular scope reviews",
      owner: "Project Manager",
      createdDate: "2024-01-20",
    },
  ]

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "text-red-500"
      case "high":
        return "text-orange-500"
      case "medium":
        return "text-yellow-500"
      case "low":
        return "text-green-500"
      default:
        return "text-gray-500"
    }
  }

  const getSeverityBg = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-500/10 border-red-500/20"
      case "high":
        return "bg-orange-500/10 border-orange-500/20"
      case "medium":
        return "bg-yellow-500/10 border-yellow-500/20"
      case "low":
        return "bg-green-500/10 border-green-500/20"
      default:
        return "bg-gray-500/10 border-gray-500/20"
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 bg-clip-text text-transparent">
              Risk Management
            </h1>
            <p className="text-muted-foreground mt-2">Identify, assess, and mitigate project risks</p>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Risk
          </Button>
        </div>

        {/* Risk Matrix */}
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Risk Matrix
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-red-500/10 border-red-500/20">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-red-500">1</div>
                  <div className="text-sm text-muted-foreground">Critical</div>
                </CardContent>
              </Card>
              <Card className="bg-orange-500/10 border-orange-500/20">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-orange-500">1</div>
                  <div className="text-sm text-muted-foreground">High</div>
                </CardContent>
              </Card>
              <Card className="bg-yellow-500/10 border-yellow-500/20">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-yellow-500">1</div>
                  <div className="text-sm text-muted-foreground">Medium</div>
                </CardContent>
              </Card>
              <Card className="bg-green-500/10 border-green-500/20">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-green-500">0</div>
                  <div className="text-sm text-muted-foreground">Low</div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        {/* Risk List */}
        <div className="space-y-4">
          {risks.map((risk, index) => (
            <motion.div
              key={risk.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className={`border-2 ${getSeverityBg(risk.severity)}`}>
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-shrink-0">
                      <div
                        className={`w-12 h-12 rounded-full ${getSeverityBg(risk.severity)} flex items-center justify-center`}
                      >
                        <AlertTriangle className={`w-6 h-6 ${getSeverityColor(risk.severity)}`} />
                      </div>
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-lg">{risk.title}</h3>
                          <p className="text-sm text-muted-foreground">{risk.description}</p>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant="outline">{risk.category}</Badge>
                          <Badge className={getSeverityColor(risk.severity)}>{risk.severity}</Badge>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Probability: </span>
                          <span className="font-medium">{risk.probability}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Impact: </span>
                          <span className="font-medium">{risk.impact}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Owner: </span>
                          <span className="font-medium">{risk.owner}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Status: </span>
                          <Badge variant="secondary">{risk.status}</Badge>
                        </div>
                      </div>
                      <div className="bg-background/50 rounded-lg p-3">
                        <p className="text-sm font-medium mb-1">Mitigation Strategy:</p>
                        <p className="text-sm text-muted-foreground">{risk.mitigation}</p>
                      </div>
                    </div>
                    <div className="flex md:flex-col gap-2">
                      <Button variant="outline" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Add Risk Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Risk</DialogTitle>
              <DialogDescription>Identify and document a project risk</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="risk-title">Risk Title</Label>
                <Input id="risk-title" placeholder="Brief description of the risk" className="mt-2" />
              </div>
              <div>
                <Label htmlFor="risk-desc">Description</Label>
                <Textarea id="risk-desc" placeholder="Detailed risk description" className="mt-2" rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select>
                    <SelectTrigger id="category" className="mt-2">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="technical">Technical</SelectItem>
                      <SelectItem value="people">People</SelectItem>
                      <SelectItem value="project">Project</SelectItem>
                      <SelectItem value="external">External</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="probability">Probability</Label>
                  <Select>
                    <SelectTrigger id="probability" className="mt-2">
                      <SelectValue placeholder="Select probability" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="impact">Impact</Label>
                  <Select>
                    <SelectTrigger id="impact" className="mt-2">
                      <SelectValue placeholder="Select impact" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="owner">Owner</Label>
                  <Input id="owner" placeholder="Risk owner" className="mt-2" />
                </div>
              </div>
              <div>
                <Label htmlFor="mitigation">Mitigation Strategy</Label>
                <Textarea id="mitigation" placeholder="How will you mitigate this risk?" className="mt-2" rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  toast.success("Risk added successfully!")
                  setShowAddDialog(false)
                }}
              >
                Add Risk
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </div>
  )
}
