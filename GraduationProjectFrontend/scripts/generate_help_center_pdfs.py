from __future__ import annotations

import os
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DIR = ROOT / "public" / "help-guides"
PREVIEW_DIR = PUBLIC_DIR / "previews"

PAGE_SIZE = (1240, 1754)
PAGE_MARGIN = 72


GUIDES = [
    {
        "id": "getting-started",
        "filename": "getting-started-guide.pdf",
        "title": "Getting Started",
        "subtitle": "A practical onboarding guide for understanding the ProjectHub workspace from day one.",
        "audience": "Best for new students, team leaders, supervisors, and anyone opening ProjectHub for the first time.",
        "accent": ((29, 111, 241), (18, 197, 226)),
        "outcomes": [
            "Understand the main dashboard areas and what each card means.",
            "Complete the first setup actions that unlock smooth daily use.",
            "Know where to find your team, tasks, meetings, submissions, and support tools.",
        ],
        "actions": [
            "Review your profile and make sure your role, contact details, and team context are correct.",
            "Use the sidebar once to visit Dashboard, My Team, Tasks, Calendar, Submissions, and Help Center.",
            "Enable the notification settings you want before active project work begins.",
        ],
        "sections": [
            {
                "title": "What this card covers",
                "summary": "The Getting Started card is the shortest path to understanding how ProjectHub is organized and how users move through it every day.",
                "bullets": [
                    "It explains the workspace layout, role-based navigation, and core pages you will rely on most often.",
                    "It helps new users avoid confusion by showing where common actions live before deadlines start.",
                    "It acts as the foundation guide before moving to team, task, or submission-specific help cards.",
                ],
            },
            {
                "title": "Your first workflow inside ProjectHub",
                "summary": "A strong start comes from understanding the sequence of actions rather than opening pages randomly.",
                "bullets": [
                    "Start from the dashboard to read recent activity, deadlines, and quick indicators.",
                    "Open My Team to confirm your team membership, leader, supervisor, and workspace status.",
                    "Visit Tasks and Calendar early so your planning and due dates stay aligned from the beginning.",
                ],
            },
            {
                "title": "What success looks like",
                "summary": "After finishing this guide, a new user should feel comfortable moving independently across the platform.",
                "bullets": [
                    "You should know what to check first each day and what pages matter for your role.",
                    "You should understand how ProjectHub connects teamwork, progress tracking, and academic delivery.",
                    "You should know when to continue with the Help Center, FAQs, or direct support contact.",
                ],
            },
            {
                "title": "Recommended habits",
                "summary": "Small habits early on save a lot of rework later in the semester.",
                "bullets": [
                    "Open the dashboard at the start of each session and clear urgent notifications first.",
                    "Keep your profile, team details, and reminders current whenever something changes.",
                    "Use support resources before a blocker becomes a missed deadline.",
                ],
            },
        ],
        "support": "If something still feels unclear after reading the guide, continue to the FAQ page or contact support from the dashboard support area.",
    },
    {
        "id": "teams",
        "filename": "teams-collaboration-guide.pdf",
        "title": "Teams and Collaboration",
        "subtitle": "How to build a healthy team workspace, assign ownership, and keep collaboration visible.",
        "audience": "Best for team leaders, student members, and supervisors coordinating daily project work.",
        "accent": ((147, 51, 234), (236, 72, 153)),
        "outcomes": [
            "Create a clear team structure with visible roles and responsibilities.",
            "Keep communication, ownership, and decisions traceable in one place.",
            "Reduce ambiguity when tasks, meetings, and approvals move between people.",
        ],
        "actions": [
            "Confirm every member is in the right team and has the correct role before assigning work.",
            "Set team expectations for updates, response times, and decision logging.",
            "Review blockers during meetings and document action owners immediately.",
        ],
        "sections": [
            {
                "title": "What this card covers",
                "summary": "The Teams and Collaboration card focuses on the human side of project execution inside ProjectHub.",
                "bullets": [
                    "It explains how teams are formed, how members collaborate, and how leadership stays organized.",
                    "It highlights the shared areas where decisions, requests, and progress become visible to everyone.",
                    "It supports better handoffs between leaders, members, supervisors, and reviewers.",
                ],
            },
            {
                "title": "Core collaboration rules",
                "summary": "Strong collaboration is less about more messages and more about better clarity.",
                "bullets": [
                    "Assign ownership clearly so every important action has one visible responsible person.",
                    "Record key decisions in the workspace instead of leaving them inside private chats only.",
                    "Use shared updates to surface blockers early and keep the team moving together.",
                ],
            },
            {
                "title": "Healthy teamwork signals",
                "summary": "ProjectHub makes healthy collaboration easier when the team uses the same rhythm consistently.",
                "bullets": [
                    "Tasks, meetings, and submissions should all reflect the same priorities and timing.",
                    "Members should be able to see what changed, why it changed, and who owns the next step.",
                    "Leaders should use the platform to remove uncertainty instead of manually repeating information.",
                ],
            },
            {
                "title": "Practical review checklist",
                "summary": "Use this mini checklist before each weekly review or supervisor meeting.",
                "bullets": [
                    "Check whether every active task has an owner and a realistic due date.",
                    "Check whether unresolved team issues are documented with a next action.",
                    "Check whether your supervisor can understand current progress without asking for missing context.",
                ],
            },
        ],
        "support": "If your team workflow feels messy, revisit this guide together and align on one shared way of updating tasks, meetings, and decisions.",
    },
    {
        "id": "tasks",
        "filename": "tasks-projects-guide.pdf",
        "title": "Tasks and Projects",
        "subtitle": "A clear guide to planning, assigning, tracking, and completing project tasks with confidence.",
        "audience": "Best for student teams, leaders, teaching assistants, and supervisors following delivery progress.",
        "accent": ((22, 163, 74), (16, 185, 129)),
        "outcomes": [
            "Break work into clear tasks with ownership and timing.",
            "Track movement from planned work to reviewed completion.",
            "Reduce late surprises by exposing dependencies and blockers early.",
        ],
        "actions": [
            "Write task titles that describe the result, not just the activity.",
            "Add due dates, assignees, and status updates for every important task.",
            "Review the board regularly so blocked work is visible before deadlines slip.",
        ],
        "sections": [
            {
                "title": "What this card covers",
                "summary": "The Tasks and Projects card explains how ProjectHub turns a large graduation project into manageable units of work.",
                "bullets": [
                    "It focuses on task planning, assignment, progress tracking, review states, and completion quality.",
                    "It shows how board movement reflects real project progress instead of cosmetic status updates.",
                    "It helps teams connect daily execution with weekly and milestone-level goals.",
                ],
            },
            {
                "title": "Writing stronger tasks",
                "summary": "Good tasks reduce follow-up questions because the expected outcome is already clear.",
                "bullets": [
                    "Use specific titles, useful descriptions, and realistic deadlines.",
                    "Attach context such as links, dependencies, or notes when another person must continue the work.",
                    "Avoid vague tasks that hide whether a deliverable is actually review-ready.",
                ],
            },
            {
                "title": "Tracking real progress",
                "summary": "Progress should show where work is stuck, not just what looks active.",
                "bullets": [
                    "Move tasks only when the work state has truly changed.",
                    "Use comments and updates to explain blockers, review requests, and scope changes.",
                    "Check for overdue work and task clusters that indicate a weak plan.",
                ],
            },
            {
                "title": "Delivery quality",
                "summary": "A finished task should support the next person in the chain, not create rework for them.",
                "bullets": [
                    "Close tasks after verification, not just after coding or writing ends.",
                    "Link supporting artifacts so reviewers understand what was delivered.",
                    "Keep completed work easy to trace during supervisor reviews and grading discussions.",
                ],
            },
        ],
        "support": "When task boards become crowded, use this guide to reset priorities and rebuild a clean flow from backlog to done.",
    },
    {
        "id": "sdlc",
        "filename": "sdlc-workflow-guide.pdf",
        "title": "SDLC and Workflow",
        "subtitle": "A structured view of how your project should move from requirements to final delivery inside ProjectHub.",
        "audience": "Best for teams that want to align day-to-day work with the academic software lifecycle.",
        "accent": ((249, 115, 22), (245, 158, 11)),
        "outcomes": [
            "Understand the purpose of each SDLC phase used by the project.",
            "Keep team activity aligned with the current workflow stage.",
            "Avoid phase drift where submissions, tasks, and meetings stop matching project reality.",
        ],
        "actions": [
            "Confirm the current project phase before scheduling work for the week.",
            "Review expected deliverables before moving to the next stage.",
            "Use supervisor checkpoints when a phase transition needs validation.",
        ],
        "sections": [
            {
                "title": "What this card covers",
                "summary": "The SDLC and Workflow card explains how ProjectHub supports a disciplined academic delivery process.",
                "bullets": [
                    "It clarifies what teams should focus on during requirements, design, implementation, testing, and release preparation.",
                    "It helps everyone understand why some tasks matter now while others should wait for a later phase.",
                    "It creates a common reference point for leaders, members, and supervisors.",
                ],
            },
            {
                "title": "Phase discipline",
                "summary": "Workflow quality improves when the team stops mixing unrelated phase goals together.",
                "bullets": [
                    "Keep current tasks aligned with the active stage of the project.",
                    "Do not treat workflow stages as labels only; use them to shape planning and evidence.",
                    "Revisit unfinished deliverables before claiming a stage is complete.",
                ],
            },
            {
                "title": "How to move forward safely",
                "summary": "Good transitions rely on evidence, not assumptions.",
                "bullets": [
                    "Check that artifacts, reviews, and approvals for the current stage are complete.",
                    "Make sure the next phase backlog is ready before the team switches focus.",
                    "Keep supervisors informed when changes in scope affect workflow planning.",
                ],
            },
            {
                "title": "Workflow warning signs",
                "summary": "These signals often mean the team is rushing ahead without enough structure.",
                "bullets": [
                    "Testing tasks appear before design decisions are stable.",
                    "Deliverables are submitted without matching task evidence or meeting decisions.",
                    "The team reports progress, but the workflow stage does not explain that progress clearly.",
                ],
            },
        ],
        "support": "Use this guide as your shared reference when the team debates what should happen next in the project lifecycle.",
    },
    {
        "id": "submissions",
        "filename": "submissions-reviews-guide.pdf",
        "title": "Submissions and Reviews",
        "subtitle": "How to submit cleaner work, follow review cycles, and respond to feedback without losing context.",
        "audience": "Best for students, team leaders, supervisors, and reviewers involved in academic deliverables.",
        "accent": ((239, 68, 68), (244, 63, 94)),
        "outcomes": [
            "Submit the right files with the right context the first time.",
            "Track review status clearly and respond to change requests faster.",
            "Reduce confusion between versions, comments, and final approved outputs.",
        ],
        "actions": [
            "Double-check file names, version readiness, and comments before uploading.",
            "Write a short submission note that helps the reviewer understand what changed.",
            "Review feedback line by line before preparing a resubmission.",
        ],
        "sections": [
            {
                "title": "What this card covers",
                "summary": "The Submissions and Reviews card focuses on the academic delivery loop that connects student work with formal feedback.",
                "bullets": [
                    "It explains how to prepare a clean submission, what reviewers need, and how status updates should be interpreted.",
                    "It supports more professional handoffs between teams and supervisors.",
                    "It reduces avoidable delays caused by incomplete files or weak context.",
                ],
            },
            {
                "title": "Before you submit",
                "summary": "Preparation matters because reviewers work faster when the evidence is easy to follow.",
                "bullets": [
                    "Confirm the uploaded version matches the latest approved internal draft.",
                    "Attach supporting files or notes when the deliverable depends on linked material.",
                    "Use clear naming so reviewers can identify the document without opening it first.",
                ],
            },
            {
                "title": "Handling feedback well",
                "summary": "A useful review loop is structured, visible, and easy to trace.",
                "bullets": [
                    "Read comments carefully and map each requested change to an action.",
                    "Resubmit with a short summary of what was fixed and what still needs clarification.",
                    "Keep the team aligned so one reviewer comment does not create conflicting edits.",
                ],
            },
            {
                "title": "Common review mistakes",
                "summary": "Most review delays happen because context gets lost between versions.",
                "bullets": [
                    "Uploading the wrong file after making final changes elsewhere.",
                    "Ignoring previous feedback and sending a new version without response notes.",
                    "Treating approval as expected even when issues remain unresolved in the document.",
                ],
            },
        ],
        "support": "Use this guide before every milestone submission to improve review speed and reduce avoidable back-and-forth.",
    },
    {
        "id": "meetings",
        "filename": "meetings-calendar-guide.pdf",
        "title": "Meetings and Calendar",
        "subtitle": "A practical guide to planning meetings, protecting focus time, and turning discussions into follow-through.",
        "audience": "Best for leaders, members, supervisors, and anyone coordinating scheduled collaboration.",
        "accent": ((99, 102, 241), (139, 92, 246)),
        "outcomes": [
            "Schedule meetings with clearer purpose and better attendance.",
            "Capture decisions, owners, and deadlines before conversations disappear.",
            "Use the calendar as a coordination tool, not just a reminder list.",
        ],
        "actions": [
            "Create meetings early enough for people to prepare meaningful input.",
            "Write a short agenda before the meeting starts.",
            "Update tasks and notes immediately after the meeting ends.",
        ],
        "sections": [
            {
                "title": "What this card covers",
                "summary": "The Meetings and Calendar card explains how ProjectHub supports organized teamwork through planned discussions and visible schedules.",
                "bullets": [
                    "It helps users schedule, run, document, and follow up on meetings with less confusion.",
                    "It links calendar activity with real project execution instead of isolated appointments.",
                    "It supports stronger coordination between students and supervisors.",
                ],
            },
            {
                "title": "Planning stronger meetings",
                "summary": "A good meeting starts before anyone joins the call or enters the room.",
                "bullets": [
                    "Invite only the people who need to contribute or make decisions.",
                    "State the purpose clearly so attendees know what to prepare.",
                    "Choose a time that respects deadlines and current workload peaks.",
                ],
            },
            {
                "title": "Running focused discussions",
                "summary": "Meetings should produce movement, not just conversation.",
                "bullets": [
                    "Keep discussion close to the agenda and note unresolved issues separately.",
                    "Capture decisions, action items, and due dates before closing the session.",
                    "Use ProjectHub notes and calendar details so important outcomes stay visible later.",
                ],
            },
            {
                "title": "Follow-up rhythm",
                "summary": "The value of a meeting appears after it ends.",
                "bullets": [
                    "Update related tasks and owners while context is still fresh.",
                    "Send or record the summary in a place the whole team can revisit.",
                    "Use future calendar events to prevent repeated discussion of the same unresolved issue.",
                ],
            },
        ],
        "support": "If meetings keep feeling repetitive or unproductive, use this guide to reset your preparation and follow-up habits.",
    },
    {
        "id": "github",
        "filename": "github-integration-guide.pdf",
        "title": "GitHub Integration",
        "subtitle": "How to connect your repository, read project activity, and keep development work visible inside ProjectHub.",
        "audience": "Best for development teams, leaders, and supervisors tracking repository progress.",
        "accent": ((51, 65, 85), (17, 24, 39)),
        "outcomes": [
            "Connect the correct repository and understand what data appears in ProjectHub.",
            "Keep branches, commits, and pull requests aligned with team workflow.",
            "Make development progress easier to review during academic follow-up.",
        ],
        "actions": [
            "Verify repository ownership and access permissions before connecting.",
            "Use clean branch names and meaningful pull request titles.",
            "Check integration activity regularly to confirm the workspace reflects real code progress.",
        ],
        "sections": [
            {
                "title": "What this card covers",
                "summary": "The GitHub Integration card explains how source code activity becomes visible inside ProjectHub.",
                "bullets": [
                    "It focuses on connecting repositories, understanding imported activity, and supporting review discussions.",
                    "It helps teams avoid treating GitHub as separate from the rest of the project workflow.",
                    "It gives supervisors a cleaner picture of code progress without leaving the platform.",
                ],
            },
            {
                "title": "Connection basics",
                "summary": "A correct initial setup prevents broken visibility later.",
                "bullets": [
                    "Connect the repository that matches the active team and project scope.",
                    "Confirm that the account used for integration has the permissions the team expects.",
                    "Review whether branches, pull requests, and commits appear after setup.",
                ],
            },
            {
                "title": "Using the integration well",
                "summary": "Repository data becomes more useful when the team applies consistent conventions.",
                "bullets": [
                    "Match branch names and pull requests to tasks or sprint goals where possible.",
                    "Keep commits readable enough that supervisors can understand progress direction.",
                    "Use review-friendly pull requests instead of large unstructured merges.",
                ],
            },
            {
                "title": "Common integration risks",
                "summary": "These issues reduce trust in the workspace view of engineering progress.",
                "bullets": [
                    "Connecting the wrong repository or a repository with shared unrelated work.",
                    "Leaving branches unreviewed so project status becomes misleading.",
                    "Relying on GitHub activity alone without linking it back to tasks and milestones.",
                ],
            },
        ],
        "support": "Use this guide when repository activity exists but the team still struggles to translate it into visible academic progress.",
    },
    {
        "id": "gamification",
        "filename": "gamification-rewards-guide.pdf",
        "title": "Gamification and Rewards",
        "subtitle": "A guide to understanding XP, achievements, rewards, and the role of motivation in ProjectHub.",
        "audience": "Best for all users who want to understand how contribution and consistency are recognized.",
        "accent": ((245, 158, 11), (249, 115, 22)),
        "outcomes": [
            "Understand how XP, badges, and rewards are earned.",
            "Use gamification as motivation without letting it distort work quality.",
            "Recognize how consistent participation supports long-term progress.",
        ],
        "actions": [
            "Review the gamification page to understand current level, streaks, and achievements.",
            "Focus first on meaningful work, then treat rewards as positive reinforcement.",
            "Use daily and weekly challenges to support momentum during slower periods.",
        ],
        "sections": [
            {
                "title": "What this card covers",
                "summary": "The Gamification and Rewards card explains how ProjectHub encourages steady participation and visible contribution.",
                "bullets": [
                    "It introduces XP, badges, progress indicators, and reward-driven engagement.",
                    "It helps users understand that quality work and consistent activity are both recognized.",
                    "It turns progress into something easier to notice over time.",
                ],
            },
            {
                "title": "How rewards should be used",
                "summary": "The goal is healthier momentum, not shallow point collection.",
                "bullets": [
                    "XP should reinforce useful work such as completing tasks, collaborating, and staying engaged.",
                    "Achievements should celebrate milestones that reflect growth or reliability.",
                    "Rewards work best when they support the project journey instead of distracting from it.",
                ],
            },
            {
                "title": "Healthy motivation patterns",
                "summary": "Good gamification keeps people moving without lowering standards.",
                "bullets": [
                    "Use quests and streaks to build consistency when energy drops.",
                    "Keep contribution quality high even when chasing a milestone or badge.",
                    "Celebrate teamwork and shared wins, not only individual numbers.",
                ],
            },
            {
                "title": "What to watch out for",
                "summary": "Motivation systems become weak when users optimize for points only.",
                "bullets": [
                    "Completing low-value work just to increase visible stats.",
                    "Ignoring collaboration quality while focusing only on personal rewards.",
                    "Treating badges as proof of project quality without supporting evidence.",
                ],
            },
        ],
        "support": "This guide is most useful when you want the platform to motivate your team without replacing thoughtful planning and quality work.",
    },
]


def font_candidates(filename: str) -> Iterable[str]:
    windir = os.environ.get("WINDIR", r"C:\Windows")
    yield str(Path(windir) / "Fonts" / filename)
    yield filename


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    preferred = "segoeuib.ttf" if bold else "segoeui.ttf"
    fallback = "arialbd.ttf" if bold else "arial.ttf"
    for candidate in list(font_candidates(preferred)) + list(font_candidates(fallback)):
        try:
            return ImageFont.truetype(candidate, size=size)
        except OSError:
            continue
    return ImageFont.load_default()


TITLE_FONT = load_font(54, bold=True)
HERO_FONT = load_font(28, bold=True)
BODY_FONT = load_font(24)
SMALL_FONT = load_font(20)
SECTION_TITLE_FONT = load_font(30, bold=True)
SECTION_BODY_FONT = load_font(22)
FOOTER_FONT = load_font(18)
BADGE_FONT = load_font(18, bold=True)
BRAND_FONT = load_font(26, bold=True)


def wrap_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        trial = f"{current} {word}".strip()
        if draw.textbbox((0, 0), trial, font=font)[2] <= max_width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def draw_vertical_gradient(image: Image.Image, top_color: tuple[int, int, int], bottom_color: tuple[int, int, int]) -> None:
    width, height = image.size
    draw = ImageDraw.Draw(image)
    for y in range(height):
        ratio = y / max(height - 1, 1)
        color = tuple(int(top_color[i] + (bottom_color[i] - top_color[i]) * ratio) for i in range(3))
        draw.line((0, y, width, y), fill=color)


def draw_soft_background(draw: ImageDraw.ImageDraw, accent: tuple[int, int, int], canvas: Image.Image) -> None:
    overlay = Image.new("RGBA", canvas.size, (255, 255, 255, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    overlay_draw.ellipse((780, -80, 1320, 420), fill=accent + (35,))
    overlay_draw.ellipse((-180, 1220, 320, 1700), fill=accent + (20,))
    overlay_draw.rounded_rectangle((40, 40, 1200, 1710), radius=42, outline=(255, 255, 255, 90), width=3)
    canvas.alpha_composite(overlay)


def draw_badge(draw: ImageDraw.ImageDraw, x: int, y: int, text: str, fill: tuple[int, int, int]) -> None:
    width = draw.textbbox((0, 0), text, font=BADGE_FONT)[2] + 28
    draw.rounded_rectangle((x, y, x + width, y + 34), radius=17, fill=fill)
    draw.text((x + 14, y + 8), text, font=BADGE_FONT, fill=(255, 255, 255))


def draw_brand_text(draw: ImageDraw.ImageDraw, x: int, y: int, text: str, fill: tuple[int, int, int]) -> None:
    draw.text((x, y), text, font=BRAND_FONT, fill=fill)


def draw_text_block(
    draw: ImageDraw.ImageDraw,
    x: int,
    y: int,
    text: str,
    font: ImageFont.ImageFont,
    fill: tuple[int, int, int],
    max_width: int,
    line_gap: int,
) -> int:
    for line in wrap_text(draw, text, font, max_width):
        draw.text((x, y), line, font=font, fill=fill)
        y += line_gap
    return y


def draw_bullets(
    draw: ImageDraw.ImageDraw,
    x: int,
    y: int,
    bullets: list[str],
    font: ImageFont.ImageFont,
    fill: tuple[int, int, int],
    max_width: int,
    line_gap: int,
    bullet_fill: tuple[int, int, int],
) -> int:
    for bullet in bullets:
        draw.ellipse((x, y + 10, x + 10, y + 20), fill=bullet_fill)
        y = draw_text_block(draw, x + 24, y, bullet, font, fill, max_width - 24, line_gap)
        y += 6
    return y


def draw_card(
    draw: ImageDraw.ImageDraw,
    x: int,
    y: int,
    width: int,
    title: str,
    body: str,
    bullets: list[str],
    accent: tuple[int, int, int],
) -> int:
    inner_width = width - 56
    body_lines = wrap_text(draw, body, SECTION_BODY_FONT, inner_width)
    bullet_lines = sum(len(wrap_text(draw, bullet, SECTION_BODY_FONT, inner_width - 24)) for bullet in bullets)
    height = 94 + len(body_lines) * 30 + bullet_lines * 30 + max(len(bullets) - 1, 0) * 6 + 36
    draw.rounded_rectangle((x, y, x + width, y + height), radius=28, fill=(255, 255, 255), outline=accent + (120,), width=2)
    draw.rounded_rectangle((x, y, x + width, y + 14), radius=28, fill=accent)
    draw.text((x + 28, y + 28), title, font=SECTION_TITLE_FONT, fill=(17, 24, 39))
    cursor = y + 72
    cursor = draw_text_block(draw, x + 28, cursor, body, SECTION_BODY_FONT, (75, 85, 99), inner_width, 30)
    cursor += 8
    cursor = draw_bullets(draw, x + 28, cursor, bullets, SECTION_BODY_FONT, (31, 41, 55), inner_width, 30, accent)
    return y + height


def draw_info_panel(
    draw: ImageDraw.ImageDraw,
    x: int,
    y: int,
    width: int,
    title: str,
    body: str | None,
    bullets: list[str] | None,
    accent: tuple[int, int, int],
) -> int:
    inner_width = width - 52
    body_lines = wrap_text(draw, body, BODY_FONT, inner_width) if body else []
    bullet_lines = sum(len(wrap_text(draw, bullet, SMALL_FONT, inner_width - 24)) for bullet in (bullets or []))
    height = 88 + len(body_lines) * 34 + bullet_lines * 28 + max(len((bullets or [])) - 1, 0) * 6 + 34
    draw.rounded_rectangle((x, y, x + width, y + height), radius=30, fill=(248, 250, 252), outline=(226, 232, 240), width=2)
    draw.text((x + 26, y + 22), title, font=SECTION_TITLE_FONT, fill=(17, 24, 39))
    cursor = y + 70
    if body:
        cursor = draw_text_block(draw, x + 26, cursor, body, BODY_FONT, (75, 85, 99), inner_width, 34)
    if bullets:
        if body:
            cursor += 2
        cursor = draw_bullets(draw, x + 26, cursor, bullets, SMALL_FONT, (31, 41, 55), inner_width, 28, accent)
    return y + height


def build_cover_page(guide: dict) -> Image.Image:
    canvas = Image.new("RGBA", PAGE_SIZE, (255, 255, 255, 255))
    draw_vertical_gradient(canvas, (245, 248, 255), (255, 255, 255))
    draw = ImageDraw.Draw(canvas)
    draw_soft_background(draw, guide["accent"][0], canvas)

    hero_top = 90
    hero_bottom = 760
    header_bottom = 338
    draw.rounded_rectangle((72, hero_top, 1168, hero_bottom), radius=44, fill=(255, 255, 255, 240), outline=(226, 232, 240), width=2)
    draw.rounded_rectangle((72, hero_top, 1168, header_bottom), radius=44, fill=guide["accent"][0])
    draw.rectangle((72, 280, 1168, hero_bottom), fill=(255, 255, 255, 240))
    draw_badge(draw, 114, 122, "PROJECTHUB HELP CENTER", guide["accent"][1])
    draw_brand_text(draw, 922, 124, "ProjectHub", (255, 255, 255))

    title_bottom = draw_text_block(draw, 114, 184, guide["title"], TITLE_FONT, (255, 255, 255), 720, 60)
    draw_text_block(draw, 114, title_bottom + 6, guide["subtitle"], SMALL_FONT, (236, 254, 255), 900, 28)

    left_bottom = draw_info_panel(draw, 114, 390, 412, "Who should read this guide", guide["audience"], None, guide["accent"][0])
    right_bottom = draw_info_panel(draw, 596, 390, 530, "What you will learn", None, guide["outcomes"], guide["accent"][0])
    info_bottom = max(left_bottom, right_bottom)

    actions_top = info_bottom + 54
    draw.rounded_rectangle((72, actions_top, 1168, actions_top + 410), radius=40, fill=(255, 255, 255, 242), outline=(226, 232, 240), width=2)
    draw.text((114, actions_top + 44), "Recommended first actions", font=HERO_FONT, fill=(17, 24, 39))
    draw_bullets(draw, 114, actions_top + 100, guide["actions"], BODY_FONT, (31, 41, 55), 980, 34, guide["accent"][1])

    purpose_top = actions_top + 470
    draw.rounded_rectangle((72, purpose_top, 1168, purpose_top + 330), radius=40, fill=guide["accent"][0] + (255,), outline=guide["accent"][1], width=2)
    draw.text((114, purpose_top + 48), "Why this card matters", font=HERO_FONT, fill=(255, 255, 255))
    description = (
        "This PDF expands the help-center card into a practical reference so users can understand not only where a feature lives, "
        "but also how to use it in a real graduation-project workflow."
    )
    draw_text_block(draw, 114, purpose_top + 102, description, BODY_FONT, (255, 255, 255), 940, 34)
    chip_top = purpose_top + 212
    draw.rounded_rectangle((114, chip_top, 420, chip_top + 92), radius=24, fill=(255, 255, 255))
    draw.text((144, chip_top + 32), "Professional guide", font=BADGE_FONT, fill=guide["accent"][0])
    draw.rounded_rectangle((448, chip_top, 760, chip_top + 92), radius=24, fill=(255, 255, 255))
    draw.text((478, chip_top + 32), "Role-aware structure", font=BADGE_FONT, fill=guide["accent"][0])
    draw.rounded_rectangle((788, chip_top, 1100, chip_top + 92), radius=24, fill=(255, 255, 255))
    draw.text((818, chip_top + 32), "Action-focused tips", font=BADGE_FONT, fill=guide["accent"][0])

    draw.text((PAGE_MARGIN, 1660), "ProjectHub - Help Center Guide", font=FOOTER_FONT, fill=(100, 116, 139))
    draw.text((1090, 1660), "Page 1", font=FOOTER_FONT, fill=(100, 116, 139))
    return canvas


def build_content_page(guide: dict) -> Image.Image:
    canvas = Image.new("RGBA", PAGE_SIZE, (255, 255, 255, 255))
    draw_vertical_gradient(canvas, (255, 255, 255), (247, 250, 252))
    draw = ImageDraw.Draw(canvas)
    draw_soft_background(draw, guide["accent"][1], canvas)

    draw.rounded_rectangle((72, 72, 1168, 220), radius=38, fill=(255, 255, 255, 240), outline=(226, 232, 240), width=2)
    draw_brand_text(draw, 104, 106, "ProjectHub", guide["accent"][0])
    draw.text((306, 106), guide["title"], font=HERO_FONT, fill=(17, 24, 39))
    draw_text_block(draw, 306, 146, "Detailed walkthrough and practical recommendations for using this ProjectHub card well.", SMALL_FONT, (75, 85, 99), 640, 28)
    draw_badge(draw, 980, 112, "PAGE 2", guide["accent"][0])

    y = 270
    for section in guide["sections"]:
        y = draw_card(draw, 72, y, 1096, section["title"], section["summary"], section["bullets"], guide["accent"][0]) + 24

    draw.rounded_rectangle((72, 1514, 1168, 1668), radius=34, fill=(17, 24, 39))
    draw.text((108, 1552), "Support note", font=SECTION_TITLE_FONT, fill=(255, 255, 255))
    draw_text_block(draw, 340, 1556, guide["support"], SMALL_FONT, (226, 232, 240), 760, 28)
    draw.text((PAGE_MARGIN, 1696), "Generated for the ProjectHub Help Center", font=FOOTER_FONT, fill=(100, 116, 139))
    draw.text((1090, 1696), "Page 2", font=FOOTER_FONT, fill=(100, 116, 139))
    return canvas


def generate_guides() -> None:
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    for guide in GUIDES:
        pages = [build_cover_page(guide), build_content_page(guide)]
        rgb_pages = [page.convert("RGB") for page in pages]
        output_path = PUBLIC_DIR / guide["filename"]
        preview_path = PREVIEW_DIR / f"{guide['id']}-page-1.png"
        rgb_pages[0].save(preview_path, "PNG")
        rgb_pages[0].save(output_path, "PDF", resolution=180.0, save_all=True, append_images=rgb_pages[1:])
        print(f"Created {output_path}")


if __name__ == "__main__":
    generate_guides()
