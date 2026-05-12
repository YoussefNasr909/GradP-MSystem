import { redirect } from "next/navigation"

export default function WeeklyProgressRedirectPage() {
  redirect("/dashboard/sprints")
}
