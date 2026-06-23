import { getHelpGuideById } from "@/lib/help-guides"
import { PDFDocument, rgb, StandardFonts, type Color, type PDFFont, type PDFPage } from "pdf-lib"

export const runtime = "nodejs"

const PAGE_W = 595
const PAGE_H = 842
const MARGIN = 46
const CONTENT_W = PAGE_W - MARGIN * 2

const COLORS = {
  ink: rgb(0.12, 0.15, 0.19),
  muted: rgb(0.42, 0.47, 0.54),
  lightText: rgb(0.95, 0.98, 1),
  blue: rgb(0.08, 0.36, 0.55),
  blueSoft: rgb(0.91, 0.96, 0.99),
  border: rgb(0.82, 0.88, 0.92),
  page: rgb(0.98, 0.99, 1),
  white: rgb(1, 1, 1),
}

type Guide = NonNullable<ReturnType<typeof getHelpGuideById>>
type GuideSection = Guide["sections"][number]

type GuideCopy = {
  cardPurpose: string
  projectConnection: string[]
  decisions: string[]
  workflow: string[]
  avoid: string[]
}

const guideCopy: Record<string, GuideCopy> = {
  "getting-started": {
    cardPurpose:
      "This card is the first stop for anyone trying to understand the ProjectHub workspace. It explains what to check first, which pages matter, and how the dashboard, team area, tasks, calendar, submissions, and support pages fit together.",
    projectConnection: [
      "The card points users to the same navigation used in the dashboard sidebar.",
      "It helps new users connect their profile, role, team status, notifications, and day-one workspace setup.",
      "It is most useful before a student or supervisor starts using the project pages heavily.",
    ],
    decisions: [
      "What should I check first after logging in?",
      "Which page do I open when I need tasks, team details, deadlines, or support?",
      "Is my account ready enough for team work and reviews?",
    ],
    workflow: [
      "Open the dashboard and read the current activity before jumping into work.",
      "Confirm your profile and team context so comments, tasks, and submissions show the right identity.",
      "Visit the core pages once so the workspace feels familiar before deadlines start.",
    ],
    avoid: [
      "Skipping profile setup and then appearing with incomplete details in comments or submissions.",
      "Using random pages without understanding how the sidebar is organized.",
      "Waiting until a blocker appears before checking FAQ or support.",
    ],
  },
  teams: {
    cardPurpose:
      "This card explains how teamwork is meant to work inside ProjectHub. It focuses on team membership, leadership responsibilities, supervisor visibility, and how decisions should stay traceable.",
    projectConnection: [
      "It connects directly to My Team, team requests, member roles, task ownership, and supervisor review visibility.",
      "It gives leaders and members a shared reference for how team changes affect submissions and progress tracking.",
      "It helps supervisors understand whether the team is organized enough to move through project phases.",
    ],
    decisions: [
      "Who owns the next action?",
      "Is the team roster stable enough for submissions and reviews?",
      "Where should decisions be recorded so they are not lost in chat?",
    ],
    workflow: [
      "Confirm the team roster, leader, supervisor, and member roles before assigning serious work.",
      "Use tasks and team updates for project decisions that supervisors may need to see later.",
      "Review workload regularly so one member does not silently carry the whole project.",
    ],
    avoid: [
      "Changing members late without checking how it affects contribution tracking.",
      "Keeping important decisions only in outside chats.",
      "Leaving unclear ownership until a deadline exposes the problem.",
    ],
  },
  tasks: {
    cardPurpose:
      "This card is about turning the graduation project into clear, trackable work. It explains how task titles, owners, priorities, deadlines, comments, and evidence make the board useful.",
    projectConnection: [
      "It maps to the Tasks & Boards page and the work that later supports submissions and supervisor reviews.",
      "It connects daily work with GitHub commits, sprint progress, and phase deliverables.",
      "It helps the team prove what was actually done, not just what was discussed.",
    ],
    decisions: [
      "Is this task specific enough to know when it is done?",
      "Who owns the work and when should it be reviewed?",
      "What evidence should be linked before the task moves to Done?",
    ],
    workflow: [
      "Create tasks with a clear outcome, owner, priority, and deadline.",
      "Move tasks only when the work state really changes.",
      "Close work after review, with comments or linked evidence when needed.",
    ],
    avoid: [
      "Writing vague task titles that hide the real deliverable.",
      "Leaving too many tasks in progress until the board stops meaning anything.",
      "Marking work done without proof, notes, or review.",
    ],
  },
  sdlc: {
    cardPurpose:
      "This card explains how ProjectHub keeps the project aligned with the software development lifecycle. It is not just a label for phases; it is a guide for what the team should focus on now.",
    projectConnection: [
      "It relates to SDLC status, phase deliverables, submissions, meetings, tasks, and supervisor approval.",
      "It helps the team keep requirements, design, implementation, testing, and deployment work in the right order.",
      "It gives supervisors a clearer view of whether the team's work matches the current phase.",
    ],
    decisions: [
      "What phase are we really in?",
      "Are our current tasks and submissions matching that phase?",
      "What evidence is needed before moving forward?",
    ],
    workflow: [
      "Check the active phase before planning weekly work.",
      "Review expected deliverables before uploading a submission.",
      "Use supervisor feedback before treating a phase as complete.",
    ],
    avoid: [
      "Starting implementation before requirements or design are stable.",
      "Submitting files that do not match the current phase.",
      "Treating phase progress as cosmetic instead of evidence-based.",
    ],
  },
  submissions: {
    cardPurpose:
      "This card explains how to prepare academic deliverables for review. It focuses on clean files, clear notes, review status, feedback, and resubmission habits.",
    projectConnection: [
      "It connects to the Submissions page, SDLC phases, supervisor comments, TA reviews, and uploaded project evidence.",
      "It helps leaders submit work with enough context for reviewers to understand it quickly.",
      "It keeps feedback tied to the same project flow instead of scattering it across messages.",
    ],
    decisions: [
      "Is this the correct file for the current phase?",
      "Did we explain what changed and what the reviewer should check?",
      "Are all previous comments handled before resubmitting?",
    ],
    workflow: [
      "Prepare the file, version, and short note before uploading.",
      "Check the review status instead of waiting passively for someone to message you.",
      "Use reviewer comments as the checklist for the next version.",
    ],
    avoid: [
      "Uploading the wrong version near the deadline.",
      "Sending a resubmission without explaining what changed.",
      "Ignoring reviewer comments and creating a new disconnected submission.",
    ],
  },
  meetings: {
    cardPurpose:
      "This card explains how meetings should support progress, not just fill the calendar. It covers scheduling, agenda preparation, decisions, owners, and follow-up tasks.",
    projectConnection: [
      "It connects to Meetings, Calendar, Tasks, supervisor check-ins, and team notes.",
      "It helps the team turn a discussion into actions that remain visible in ProjectHub.",
      "It supports better coordination around SDLC deadlines and submission reviews.",
    ],
    decisions: [
      "Do we need a meeting or just a task update?",
      "Who must attend for this decision to move forward?",
      "What tasks should be created after the meeting?",
    ],
    workflow: [
      "Schedule with a clear purpose and enough preparation time.",
      "Bring the task board and current phase context into the discussion.",
      "Convert decisions into tasks, owners, and deadlines before the context fades.",
    ],
    avoid: [
      "Holding broad meetings with no agenda.",
      "Ending with decisions that are not recorded anywhere.",
      "Letting calendar events drift away from real project deadlines.",
    ],
  },
  github: {
    cardPurpose:
      "This card explains how repository activity becomes useful inside ProjectHub. It is about connecting code work to tasks, branches, commits, pull requests, and supervisor-visible progress.",
    projectConnection: [
      "It connects the GitHub page with Tasks & Boards, implementation progress, and contribution tracking.",
      "It helps the team show real engineering movement instead of relying on verbal updates.",
      "It gives supervisors a clearer way to understand who contributed to implementation work.",
    ],
    decisions: [
      "Is the connected repository the correct one for this project?",
      "Does this commit or pull request match a task or phase goal?",
      "Can someone reviewing the project understand the code activity later?",
    ],
    workflow: [
      "Connect the repository that matches the active team and project scope.",
      "Use readable branch names and commit messages.",
      "Link meaningful code changes back to tasks before closing work.",
    ],
    avoid: [
      "Connecting a personal or unrelated repository.",
      "Using vague commit messages that make progress hard to read.",
      "Treating GitHub activity as separate from tasks and submissions.",
    ],
  },
  gamification: {
    cardPurpose:
      "This card explains how XP, badges, and progress signals are meant to motivate steady work. It should support good project habits, not replace actual quality.",
    projectConnection: [
      "It connects to task completion, submissions, meetings, GitHub activity, achievements, and leaderboard progress.",
      "It gives students a visible sense of momentum while the project moves through slower phases.",
      "It can help leaders notice participation gaps early.",
    ],
    decisions: [
      "Which project actions are actually earning progress?",
      "Is the team using rewards as motivation without lowering quality?",
      "Do the visible stats reflect real contribution or just surface activity?",
    ],
    workflow: [
      "Use XP and badges as feedback after meaningful work is complete.",
      "Check progress after important milestones, not every few minutes.",
      "Use leaderboard differences as a signal to review task tracking and workload balance.",
    ],
    avoid: [
      "Chasing points with low-value actions.",
      "Confusing a badge with academic approval.",
      "Ignoring project quality because the visible progress looks good.",
    ],
  },
}

function normalizeText(value: string) {
  return value
    .replace(/â€”/g, "-")
    .replace(/â€“/g, "-")
    .replace(/â€™/g, "'")
    .replace(/â€œ/g, '"')
    .replace(/â€/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2019/g, "'")
    .replace(/\u00a0/g, " ")
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = normalizeText(text).split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ""

  for (const word of words) {
    const trial = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(trial, size) > maxWidth) {
      if (current) lines.push(current)
      current = word
    } else {
      current = trial
    }
  }

  if (current) lines.push(current)
  return lines
}

function drawTextBlock(
  page: PDFPage,
  text: string,
  x: number,
  topY: number,
  font: PDFFont,
  size: number,
  color: Color,
  maxWidth: number,
  lineGap = size + 4,
) {
  let y = topY
  for (const line of wrapText(text, font, size, maxWidth)) {
    page.drawText(line, { x, y: y - size, size, font, color })
    y -= lineGap
  }
  return y
}

function drawBullets(
  page: PDFPage,
  bullets: string[],
  x: number,
  topY: number,
  font: PDFFont,
  size: number,
  maxWidth: number,
  bulletColor = COLORS.blue,
) {
  let y = topY
  for (const bullet of bullets) {
    page.drawCircle({ x: x + 4, y: y - 6, size: 2.2, color: bulletColor })
    y = drawTextBlock(page, bullet, x + 16, y, font, size, COLORS.ink, maxWidth - 16, size + 5)
    y -= 5
  }
  return y
}

function drawHeader(page: PDFPage, guide: Guide, pageNumber: number, fontRegular: PDFFont, fontBold: PDFFont) {
  page.drawRectangle({ x: 0, y: PAGE_H - 60, width: PAGE_W, height: 60, color: COLORS.white })
  page.drawRectangle({ x: 0, y: PAGE_H - 61, width: PAGE_W, height: 1, color: COLORS.border })

  page.drawText("ProjectHub", {
    x: MARGIN,
    y: PAGE_H - 28,
    size: 16,
    font: fontBold,
    color: COLORS.blue,
  })
  page.drawText("Help Center PDF", {
    x: MARGIN,
    y: PAGE_H - 43,
    size: 8.5,
    font: fontRegular,
    color: COLORS.muted,
  })

  const title = normalizeText(guide.title)
  const maxTitleWidth = 230
  const titleLines = wrapText(title, fontRegular, 8.5, maxTitleWidth).slice(0, 2)
  let titleY = PAGE_H - 25
  for (const line of titleLines) {
    const width = fontRegular.widthOfTextAtSize(line, 8.5)
    page.drawText(line, {
      x: PAGE_W - MARGIN - width,
      y: titleY,
      size: 8.5,
      font: fontRegular,
      color: COLORS.muted,
    })
    titleY -= 11
  }

  const label = `Page ${pageNumber} of 2`
  page.drawText(label, {
    x: PAGE_W - MARGIN - fontRegular.widthOfTextAtSize(label, 7.5),
    y: 14,
    size: 7.5,
    font: fontRegular,
    color: COLORS.muted,
  })
  page.drawText("Graduation Project Management System", {
    x: MARGIN,
    y: 14,
    size: 7.5,
    font: fontRegular,
    color: COLORS.muted,
  })
  page.drawRectangle({ x: 0, y: 32, width: PAGE_W, height: 1, color: COLORS.border })
}

function drawPanel(
  page: PDFPage,
  title: string,
  x: number,
  topY: number,
  width: number,
  height: number,
  fontBold: PDFFont,
) {
  const bottomY = topY - height
  page.drawRectangle({
    x,
    y: bottomY,
    width,
    height,
    color: COLORS.white,
    borderColor: COLORS.border,
    borderWidth: 0.8,
  })
  page.drawRectangle({ x, y: topY - 5, width, height: 5, color: COLORS.blueSoft })
  page.drawText(title, {
    x: x + 14,
    y: topY - 24,
    size: 12,
    font: fontBold,
    color: COLORS.ink,
  })
  return { contentX: x + 14, contentTop: topY - 42, contentWidth: width - 28, bottomY }
}

function drawGuideSection(
  page: PDFPage,
  section: GuideSection,
  index: number,
  x: number,
  topY: number,
  width: number,
  fontRegular: PDFFont,
  fontBold: PDFFont,
) {
  const headingLines = wrapText(section.heading, fontBold, 11, width - 44)
  const tipLines = wrapText(section.tip, fontRegular, 8.5, width - 28)
  const firstBullets = section.bullets.slice(0, 2)
  const bulletLines = firstBullets.reduce((total, bullet) => total + wrapText(bullet, fontRegular, 8.5, width - 44).length, 0)
  const height = 54 + headingLines.length * 13 + tipLines.length * 12 + bulletLines * 12 + firstBullets.length * 5
  const bottomY = topY - height

  page.drawRectangle({ x, y: bottomY, width, height, color: COLORS.white, borderColor: COLORS.border, borderWidth: 0.8 })
  page.drawText(String(index + 1), {
    x: x + 14,
    y: topY - 24,
    size: 10,
    font: fontBold,
    color: COLORS.blue,
  })

  let y = topY - 14
  for (const line of headingLines) {
    page.drawText(line, { x: x + 34, y: y - 10, size: 11, font: fontBold, color: COLORS.ink })
    y -= 13
  }

  y -= 6
  y = drawTextBlock(page, section.tip, x + 14, y, fontRegular, 8.5, COLORS.muted, width - 28, 12)
  y -= 6
  drawBullets(page, firstBullets, x + 14, y, fontRegular, 8.5, width - 28, COLORS.blue)

  return bottomY
}

function createPage(pdfDoc: PDFDocument, guide: Guide, pageNumber: number, fontRegular: PDFFont, fontBold: PDFFont) {
  const page = pdfDoc.addPage()
  page.setSize(PAGE_W, PAGE_H)
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: COLORS.page })
  drawHeader(page, guide, pageNumber, fontRegular, fontBold)
  return page
}

function drawFirstPage(pdfDoc: PDFDocument, guide: Guide, copy: GuideCopy, fontRegular: PDFFont, fontBold: PDFFont) {
  const page = createPage(pdfDoc, guide, 1, fontRegular, fontBold)

  page.drawText(normalizeText(guide.title), {
    x: MARGIN,
    y: PAGE_H - 106,
    size: 24,
    font: fontBold,
    color: COLORS.ink,
  })
  drawTextBlock(page, guide.summary, MARGIN, PAGE_H - 132, fontRegular, 10.5, COLORS.muted, CONTENT_W, 15)

  const purpose = drawPanel(page, "What this card is really for", MARGIN, PAGE_H - 190, CONTENT_W, 138, fontBold)
  drawTextBlock(page, copy.cardPurpose, purpose.contentX, purpose.contentTop, fontRegular, 9.5, COLORS.ink, purpose.contentWidth, 14)

  const leftWidth = (CONTENT_W - 14) / 2
  const project = drawPanel(page, "Where it connects in ProjectHub", MARGIN, PAGE_H - 352, leftWidth, 202, fontBold)
  drawBullets(page, copy.projectConnection, project.contentX, project.contentTop, fontRegular, 8.8, project.contentWidth)

  const decisions = drawPanel(page, "What this card helps you decide", MARGIN + leftWidth + 14, PAGE_H - 352, leftWidth, 202, fontBold)
  drawBullets(page, copy.decisions, decisions.contentX, decisions.contentTop, fontRegular, 8.8, decisions.contentWidth)

  const use = drawPanel(page, "A simple way to use it", MARGIN, PAGE_H - 584, CONTENT_W, 138, fontBold)
  drawBullets(page, copy.workflow, use.contentX, use.contentTop, fontRegular, 9, use.contentWidth)
}

function drawSecondPage(pdfDoc: PDFDocument, guide: Guide, copy: GuideCopy, fontRegular: PDFFont, fontBold: PDFFont) {
  const page = createPage(pdfDoc, guide, 2, fontRegular, fontBold)

  page.drawText("Card details", {
    x: MARGIN,
    y: PAGE_H - 102,
    size: 20,
    font: fontBold,
    color: COLORS.ink,
  })
  page.drawText("The notes below follow the same sections shown in this Help Center guide.", {
    x: MARGIN,
    y: PAGE_H - 122,
    size: 9.5,
    font: fontRegular,
    color: COLORS.muted,
  })

  let y = PAGE_H - 154
  for (let index = 0; index < guide.sections.length; index += 1) {
    y = drawGuideSection(page, guide.sections[index], index, MARGIN, y, CONTENT_W, fontRegular, fontBold) - 12
  }

  const lowerTop = Math.min(y - 10, 250)
  const leftWidth = (CONTENT_W - 14) / 2
  const avoid = drawPanel(page, "Common mistakes to avoid", MARGIN, lowerTop, leftWidth, 156, fontBold)
  drawBullets(page, copy.avoid, avoid.contentX, avoid.contentTop, fontRegular, 8.8, avoid.contentWidth)

  const close = drawPanel(page, "When to come back to this card", MARGIN + leftWidth + 14, lowerTop, leftWidth, 156, fontBold)
  drawTextBlock(
    page,
    "Come back to this PDF when the team is about to use the related ProjectHub page, when a reviewer asks for clearer evidence, or when the card title sounds familiar but the next action is not obvious.",
    close.contentX,
    close.contentTop,
    fontRegular,
    8.8,
    COLORS.ink,
    close.contentWidth,
    13,
  )
}

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params
  const guide = getHelpGuideById(slug)

  if (!guide) {
    return new Response("Guide not found", { status: 404 })
  }

  const copy = guideCopy[guide.id] ?? guideCopy["getting-started"]
  const pdfDoc = await PDFDocument.create()
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  drawFirstPage(pdfDoc, guide, copy, fontRegular, fontBold)
  drawSecondPage(pdfDoc, guide, copy, fontRegular, fontBold)

  const pdfBytes = await pdfDoc.save()

  return new Response(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${guide.filename}"`,
      "Cache-Control": "public, max-age=3600",
    },
  })
}
