export const FRONTEND_BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
export const API_BASE_URL = process.env.E2E_API_BASE_URL ?? "http://127.0.0.1:4000/api/v1";
export const BACKEND_ORIGIN = API_BASE_URL.replace(/\/api\/v1\/?$/, "");
export const DEFAULT_PASSWORD = "demo123";

export const seedUsers = {
  admin: { email: "admin@university.edu", password: DEFAULT_PASSWORD },
  doctor: { email: "doctor0@university.edu", password: DEFAULT_PASSWORD },
  ta: { email: "ta0@university.edu", password: DEFAULT_PASSWORD },
  leader: { email: "student0@student.edu", password: DEFAULT_PASSWORD },
  member: { email: "student1@student.edu", password: DEFAULT_PASSWORD },
  studentNoTeam: { email: "student160@student.edu", password: DEFAULT_PASSWORD },
};

export const enumValues = {
  department: "COMPUTER_SCIENCE",
  academicYear: "YEAR_4",
  preferredTrack: "FULLSTACK_DEVELOPMENT",
};

export type BackendRole = "STUDENT" | "LEADER" | "DOCTOR" | "TA" | "ADMIN" | "SUPPORT";
export type UiRole = "member" | "leader" | "doctor" | "ta" | "admin" | "support";

export function backendRoleToUiRole(role: BackendRole | string): UiRole {
  switch (role) {
    case "ADMIN":
      return "admin";
    case "LEADER":
      return "leader";
    case "DOCTOR":
      return "doctor";
    case "TA":
      return "ta";
    case "SUPPORT":
      return "support";
    case "STUDENT":
    default:
      return "member";
  }
}

