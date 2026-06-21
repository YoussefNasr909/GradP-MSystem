"use client"

import { motion } from "framer-motion"
import {
  HelpCircle,
  BookOpen,
  Video,
  ChevronRight,
  GraduationCap,
  Users,
  CheckSquare,
  Calendar,
  MessageSquare,
  GitBranch,
  Award,
  Shield,
  Workflow,
  Upload,
  Star,
  ExternalLink,
  Play,
  Download,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { useAuthStore } from "@/lib/stores/auth-store"
import { getHelpGuideById } from "@/lib/help-guides"
import Link from "next/link"
import Image from "next/image"

const helpCategories = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: GraduationCap,
    color: "from-blue-500 to-cyan-500",
    description: "Learn the basics of ProjectHub",
  },
  {
    id: "teams",
    title: "Teams & Collaboration",
    icon: Users,
    color: "from-purple-500 to-pink-500",
    description: "Work effectively with your team",
  },
  {
    id: "tasks",
    title: "Tasks & Projects",
    icon: CheckSquare,
    color: "from-green-500 to-emerald-500",
    description: "Manage tasks and track progress",
  },
  {
    id: "sdlc",
    title: "SDLC & Workflow",
    icon: Workflow,
    color: "from-orange-500 to-amber-500",
    description: "Follow the software development lifecycle",
  },
  {
    id: "submissions",
    title: "Submissions & Reviews",
    icon: Upload,
    color: "from-red-500 to-rose-500",
    description: "Submit work and get feedback",
  },
  {
    id: "meetings",
    title: "Meetings & Calendar",
    icon: Calendar,
    color: "from-indigo-500 to-violet-500",
    description: "Schedule and manage meetings",
  },
  {
    id: "github",
    title: "GitHub Integration",
    icon: GitBranch,
    color: "from-gray-600 to-gray-800",
    description: "Connect and use GitHub features",
  },
  {
    id: "gamification",
    title: "Gamification & Rewards",
    icon: Award,
    color: "from-yellow-500 to-orange-500",
    description: "Earn XP, badges, and rewards",
  },
]

const videoTutorials = [
  {
    title: "Complete ProjectHub Walkthrough",
    duration: "15:32",
    views: "2.4K",
    thumbnail: "/placeholder.svg",
    category: "Getting Started",
  },
  {
    title: "Team Collaboration Guide",
    duration: "10:45",
    views: "1.8K",
    thumbnail: "/placeholder.svg",
    category: "Teams",
  },
  {
    title: "SDLC Phases Explained",
    duration: "12:20",
    views: "1.5K",
    thumbnail: "/placeholder.svg",
    category: "Workflow",
  },
  {
    title: "GitHub Integration Setup",
    duration: "8:15",
    views: "1.2K",
    thumbnail: "/placeholder.svg",
    category: "GitHub",
  },
  {
    title: "Gamification System Tips",
    duration: "7:30",
    views: "980",
    thumbnail: "/placeholder.svg",
    category: "Gamification",
  },
  {
    title: "Submission & Review Process",
    duration: "9:45",
    views: "1.1K",
    thumbnail: "/placeholder.svg",
    category: "Submissions",
  },
]

export default function HelpPage() {
  const { currentUser } = useAuthStore()

  return (
    <div className="space-y-6 pb-8">
      <Tabs defaultValue="categories" className="space-y-6">
        {/* Categories Tab */}
        <TabsContent value="categories" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {helpCategories.map((category, index) => {
              const guide = getHelpGuideById(category.id)

              return (
                <motion.div
                  key={category.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="h-full hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group">
                    <CardHeader className="pb-3">
                      <div
                        className={`w-12 h-12 rounded-xl bg-gradient-to-br ${category.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}
                      >
                        <category.icon className="h-6 w-6 text-white" />
                      </div>
                      <CardTitle className="text-lg">{category.title}</CardTitle>
                      <CardDescription>{category.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-xl border border-dashed border-primary/25 bg-primary/5 p-4">
                        <p className="text-sm text-muted-foreground">{guide?.summary ?? "Download the full PDF guide for this topic."}</p>
                        <a
                          href={`/help-guides/${category.id}`}
                          download={guide?.filename || `${category.id}-guide.pdf`}
                          className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-primary/80 hover:underline"
                        >
                          <Download className="h-4 w-4" />
                          Download full guide PDF
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        </TabsContent>

        {/* Videos Tab */}
        <TabsContent value="videos" className="space-y-6" id="videos">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videoTutorials.map((video, index) => (
              <motion.div
                key={video.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group cursor-pointer">
                  <div className="relative aspect-video bg-muted">
                    <Image
                      src={video.thumbnail || "/placeholder.svg"}
                      alt={video.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
                        <Play className="h-8 w-8 text-primary fill-primary ml-1" />
                      </div>
                    </div>
                    <Badge className="absolute top-2 right-2 bg-black/70">{video.duration}</Badge>
                  </div>
                  <CardContent className="p-4">
                    <Badge variant="secondary" className="mb-2">
                      {video.category}
                    </Badge>
                    <h3 className="font-semibold group-hover:text-primary transition-colors">{video.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{video.views} views</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        {/* Guides Tab */}
        <TabsContent value="guides" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Role-specific guides */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  {currentUser?.role === "doctor" || currentUser?.role === "ta"
                    ? "Supervisor Guide"
                    : currentUser?.role === "admin"
                      ? "Admin Guide"
                      : "Student Guide"}
                </CardTitle>
                <CardDescription>Complete guide for your role</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {currentUser?.role === "doctor" || currentUser?.role === "ta" ? (
                  <>
                    <GuideItem title="Managing supervised teams" />
                    <GuideItem title="Reviewing submissions" />
                    <GuideItem title="Providing feedback" />
                    <GuideItem title="Scheduling meetings" />
                    <GuideItem title="Grading and evaluations" />
                  </>
                ) : currentUser?.role === "admin" ? (
                  <>
                    <GuideItem title="User management" />
                    <GuideItem title="System configuration" />
                    <GuideItem title="Analytics and reports" />
                    <GuideItem title="Security settings" />
                    <GuideItem title="Backup and recovery" />
                  </>
                ) : (
                  <>
                    <GuideItem title="Joining or creating a team" />
                    <GuideItem title="Working on tasks" />
                    <GuideItem title="Making submissions" />
                    <GuideItem title="Communicating with supervisors" />
                    <GuideItem title="Tracking your progress" />
                  </>
                )}
                <Button className="w-full mt-4 gap-2">
                  <Download className="h-4 w-4" />
                  Download PDF Guide
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500" />
                  Best Practices
                </CardTitle>
                <CardDescription>Tips for success in ProjectHub</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <GuideItem title="Daily check-in routine" />
                <GuideItem title="Effective communication" />
                <GuideItem title="Time management tips" />
                <GuideItem title="Documentation standards" />
                <GuideItem title="Code review guidelines" />
                <Button variant="outline" className="w-full mt-4 gap-2 bg-transparent">
                  <ExternalLink className="h-4 w-4" />
                  View All Best Practices
                </Button>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-green-500" />
                  Security & Privacy
                </CardTitle>
                <CardDescription>Keep your account safe</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-muted/50">
                    <h4 className="font-medium mb-2">Two-Factor Authentication</h4>
                    <p className="text-sm text-muted-foreground">Add an extra layer of security to your account</p>
                    <Button variant="link" className="px-0 mt-2">
                      Learn more
                    </Button>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/50">
                    <h4 className="font-medium mb-2">Password Security</h4>
                    <p className="text-sm text-muted-foreground">Best practices for creating strong passwords</p>
                    <Button variant="link" className="px-0 mt-2">
                      Learn more
                    </Button>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/50">
                    <h4 className="font-medium mb-2">Data Privacy</h4>
                    <p className="text-sm text-muted-foreground">How we protect your personal information</p>
                    <Button variant="link" className="px-0 mt-2">
                      Learn more
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Still need help? */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/20">
                  <MessageSquare className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Still need help?</h3>
                  <p className="text-muted-foreground">Our support team is here to assist you</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Link href="/dashboard/faq">
                  <Button variant="outline" className="gap-2 bg-transparent">
                    <HelpCircle className="h-4 w-4" />
                    View FAQs
                  </Button>
                </Link>
                <Link href="/dashboard/support">
                  <Button className="gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Contact Support
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

function GuideItem({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group">
      <div className="flex items-center gap-3">
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
        <span className="text-sm">{title}</span>
      </div>
      <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  )
}
