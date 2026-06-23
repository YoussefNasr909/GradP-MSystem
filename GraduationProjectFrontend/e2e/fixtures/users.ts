export type AppRole = "admin" | "doctor" | "ta" | "leader" | "student"

export type TestUserCandidate = {
  email: string
  password: string
  role: AppRole
  label: string
}

const password = process.env.E2E_DEMO_PASSWORD ?? "demo123"

export const testUserCandidates: Record<AppRole, TestUserCandidate[]> = {
  admin: [
    { email: "admin@university.edu", password, role: "admin", label: "Seeded admin" },
  ],
  doctor: [
    { email: "ahmed.hassan@university.edu", password, role: "doctor", label: "Seeded doctor" },
    { email: "mona.zaki@university.edu", password, role: "doctor", label: "Seeded doctor fallback" },
  ],
  ta: [
    { email: "layla.ibrahim@university.edu", password, role: "ta", label: "Seeded TA" },
    { email: "omar.kamal@university.edu", password, role: "ta", label: "Seeded TA fallback" },
  ],
  leader: [
    { email: "student0@student.edu", password, role: "leader", label: "Huge-seed team leader" },
    { email: "student100@student.edu", password, role: "leader", label: "Huge-seed team leader fallback" },
    { email: "mariam.salah@student.edu", password, role: "leader", label: "Small-seed team leader" },
    { email: "nour.hassan@student.edu", password, role: "leader", label: "Small-seed team leader fallback" },
  ],
  student: [
    { email: "student1@student.edu", password, role: "student", label: "Huge-seed student member" },
    { email: "student199@student.edu", password, role: "student", label: "Huge-seed student member fallback" },
    { email: "ali.mahmoud@student.edu", password, role: "student", label: "Small-seed student member" },
    { email: "salma.youssef@student.edu", password, role: "student", label: "Small-seed student member fallback" },
  ],
}

export const expectedRoleNavigation: Record<AppRole, string[]> = {
  admin: ["User Management", "System Logs", "Reports"],
  doctor: ["Supervision", "My Teams", "Reports"],
  ta: ["Supervision", "Review Tasks", "My Teams"],
  leader: ["My Team", "Tasks & Boards", "Time Tracker"],
  student: ["My Team", "Tasks & Boards", "Time Tracker"],
}
