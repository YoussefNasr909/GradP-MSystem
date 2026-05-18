//what does this file do? It defines the main router for the application, currently including a test endpoint that responds with "pong" to a "ping" request.

import { Router } from "express";
import usersRouter from "../modules/users/users.routes.js";
import authRoutes from "../modules/auth/auth.routes.js";
import teamsRouter from "../modules/teams/teams.routes.js";
import githubRouter from "../modules/github/github.routes.js";
import tasksRouter from "../modules/tasks/tasks.routes.js";
import documentsRouter from "../modules/documents/documents.routes.js";
import resourcesRouter from "../modules/resources/resources.routes.js";
import submissionsRouter from "../modules/submissions/submissions.routes.js";
import notificationsRouter from "../modules/notifications/notifications.routes.js";
import meetingsRouter from "../modules/meetings/meetings.routes.js";
import calendarRouter from "../modules/calendar/calendar.routes.js";
import settingsRouter from "../modules/settings/settings.routes.js";
import discussionsRouter from "../modules/discussions/discussions.routes.js";
import chatRouter from "../modules/chat/chat.routes.js";
import teamChatRouter from "../modules/team-chat/team-chat.routes.js";
import risksRouter from "../modules/risks/risks.routes.js";
import adminRouter from "../modules/admin/admin.routes.js";
import proposalsRouter from "../modules/proposals/proposals.routes.js";
import supervisorNotesRouter from "../modules/supervisor-notes/supervisor-notes.routes.js";
import deadlinesRouter from "../modules/deadlines/deadlines.routes.js";
import announcementsRouter from "../modules/announcements/announcements.routes.js";
import submissionCommentsRouter from "../modules/submission-comments/submission-comments.routes.js";
import rubricTemplatesRouter from "../modules/rubric-templates/rubric-templates.routes.js";
import sprintsRouter from "../modules/sprints/sprints.routes.js";
import gamificationRouter from "../modules/gamification/gamification.routes.js";
import economyRouter from "../modules/economy/economy.routes.js";
import weeklyReportsRouter from "../modules/weekly-reports/weekly-reports.routes.js";
const router = Router();

router.get("/ping", (req, res) => {
  res.json({ ok: true, message: "pong" });
});

router.use("/users", usersRouter);
router.use("/auth", authRoutes);
router.use("/teams", teamsRouter);
router.use("/github", githubRouter);
router.use("/tasks", tasksRouter);
router.use("/documents", documentsRouter);
router.use("/resources", resourcesRouter);
router.use("/submissions", submissionsRouter);
router.use("/notifications", notificationsRouter);
router.use("/meetings", meetingsRouter);
router.use("/calendar", calendarRouter);
router.use("/settings", settingsRouter);
router.use("/discussions", discussionsRouter);
router.use("/chat", chatRouter);
router.use("/team-chats", teamChatRouter);
router.use("/risks", risksRouter);
router.use("/admin", adminRouter);
router.use("/proposals", proposalsRouter);
router.use("/supervisor-notes", supervisorNotesRouter);
router.use("/deadlines", deadlinesRouter);
router.use("/announcements", announcementsRouter);
router.use("/submission-comments", submissionCommentsRouter);
router.use("/rubric-templates", rubricTemplatesRouter);
router.use("/sprints", sprintsRouter);
router.use("/gamification", gamificationRouter);
router.use("/economy", economyRouter);
router.use("/weekly-reports", weeklyReportsRouter);
export default router;

