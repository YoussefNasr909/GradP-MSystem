import PDFDocument from "pdfkit";
import { prisma } from "../../loaders/dbLoader.js";
import { AppError } from "../../common/errors/AppError.js";
import { PHASE_WEIGHTS, calculateWeightedFinal } from "../submissions/evaluation-policy.js";
import { getAnalytics, getGradesOverview } from "./admin.service.js";

function fullName(u) {
  return u ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() : "—";
}

function gradeLetter(g) {
  if (g === null || g === undefined) return "—";
  if (g >= 90) return "A";
  if (g >= 80) return "B";
  if (g >= 70) return "C";
  if (g >= 60) return "D";
  return "F";
}

function reportDateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function formatNumber(value, suffix = "") {
  if (value === null || value === undefined || value === "") return "-";
  return `${value}${suffix}`;
}

function truncate(value, max = 36) {
  const text = value === null || value === undefined ? "-" : String(value);
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

function setReportHeaders(res, filename) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
}

function createReportDoc(res, filename, title, subtitle) {
  setReportHeaders(res, filename);
  const doc = new PDFDocument({ size: "A4", margin: 48 });
  doc.pipe(res);

  doc.fontSize(20).font("Helvetica-Bold").fillColor("#111827").text(title);
  doc.moveDown(0.25);
  doc.fontSize(9).font("Helvetica").fillColor("#6b7280").text(subtitle);
  doc.moveDown(0.9);
  doc.strokeColor("#e5e7eb").lineWidth(1).moveTo(48, doc.y).lineTo(547, doc.y).stroke();
  doc.moveDown(0.9);

  return doc;
}

function ensureSpace(doc, height = 80) {
  if (doc.y + height <= doc.page.height - doc.page.margins.bottom) return;
  doc.addPage();
}

function sectionTitle(doc, title) {
  ensureSpace(doc, 45);
  doc.moveDown(0.4);
  doc.x = doc.page.margins.left;
  doc.fontSize(12).font("Helvetica-Bold").fillColor("#111827").text(title, doc.page.margins.left, doc.y, { width: 499 });
  doc.moveDown(0.35);
}

function writeMetricGrid(doc, metrics) {
  const cardWidth = 118;
  const cardHeight = 58;
  const gap = 9;
  const startX = doc.page.margins.left;
  const y = doc.y;

  metrics.forEach((metric, index) => {
    const x = startX + (index % 4) * (cardWidth + gap);
    const rowY = y + Math.floor(index / 4) * (cardHeight + gap);
    doc.roundedRect(x, rowY, cardWidth, cardHeight, 6).fillAndStroke("#f9fafb", "#e5e7eb");
    doc.fillColor("#6b7280").fontSize(8).font("Helvetica").text(metric.label, x + 10, rowY + 10, { width: cardWidth - 20 });
    doc.fillColor("#111827").fontSize(16).font("Helvetica-Bold").text(String(metric.value), x + 10, rowY + 27, { width: cardWidth - 20 });
  });

  doc.x = doc.page.margins.left;
  doc.y = y + Math.ceil(metrics.length / 4) * (cardHeight + gap) + 6;
}

function writeTable(doc, columns, rows) {
  const startX = doc.page.margins.left;
  const rowHeight = 20;

  ensureSpace(doc, rowHeight * 3);
  let y = doc.y;

  const writeHeader = () => {
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#374151");
    let x = startX;
    for (const column of columns) {
      doc.text(column.label, x, y, { width: column.width, align: column.align ?? "left" });
      x += column.width;
    }
    y += 13;
    doc.strokeColor("#e5e7eb").lineWidth(0.5).moveTo(startX, y).lineTo(547, y).stroke();
    y += 5;
    doc.font("Helvetica").fontSize(8).fillColor("#111827");
  };

  writeHeader();

  for (const row of rows) {
    if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      y = doc.y;
      writeHeader();
    }

    let x = startX;
    for (const column of columns) {
      const value = column.render ? column.render(row) : row[column.key];
      doc.text(truncate(value, column.max ?? 32), x, y, { width: column.width, align: column.align ?? "left" });
      x += column.width;
    }
    y += rowHeight;
  }

  doc.x = doc.page.margins.left;
  doc.y = y + 4;
}

function rowsFromRecord(record) {
  return Object.entries(record ?? {}).map(([label, value]) => ({ label, value }));
}

function humanizeEnum(value) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value)
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return `${Math.round(Number(value))}%`;
}

function formatMetricValue(value, suffix = "") {
  if (value === null || value === undefined || value === "") return "-";
  return `${value}${suffix}`;
}

function writeParagraph(doc, text) {
  ensureSpace(doc, 46);
  doc.x = doc.page.margins.left;
  doc.font("Helvetica").fontSize(9).fillColor("#4b5563").text(text, doc.page.margins.left, doc.y, {
    width: 499,
    lineGap: 2,
  });
  doc.moveDown(0.7);
}

function writeInfoBox(doc, title, lines) {
  const safeLines = Array.isArray(lines) ? lines.filter(Boolean) : [String(lines ?? "")];
  const text = safeLines.join("\n");
  doc.font("Helvetica").fontSize(8.5);
  const textHeight = doc.heightOfString(text, { width: 463, lineGap: 2 });
  const boxHeight = Math.max(58, textHeight + 42);
  ensureSpace(doc, boxHeight + 14);

  const x = doc.page.margins.left;
  const y = doc.y;
  doc.roundedRect(x, y, 499, boxHeight, 8).fillAndStroke("#f8fafc", "#e5e7eb");
  doc.fillColor("#111827").font("Helvetica-Bold").fontSize(10).text(title, x + 16, y + 13, { width: 463 });
  doc.fillColor("#4b5563").font("Helvetica").fontSize(8.5).text(text, x + 16, y + 31, {
    width: 463,
    lineGap: 2,
  });
  doc.x = doc.page.margins.left;
  doc.y = y + boxHeight + 12;
}

function writeEmptyState(doc, message) {
  ensureSpace(doc, 46);
  const x = doc.page.margins.left;
  const y = doc.y;
  doc.roundedRect(x, y, 499, 42, 8).fillAndStroke("#f9fafb", "#e5e7eb");
  doc.fillColor("#6b7280").font("Helvetica").fontSize(9).text(message, x + 14, y + 14, { width: 471 });
  doc.x = doc.page.margins.left;
  doc.y = y + 52;
}

function writeTableOrEmpty(doc, columns, rows, emptyMessage) {
  if (!rows || rows.length === 0) {
    writeEmptyState(doc, emptyMessage);
    return;
  }
  writeTable(doc, columns, rows);
}

function writeProgressList(doc, rows, options = {}) {
  if (!rows || rows.length === 0) {
    writeEmptyState(doc, options.emptyMessage ?? "No data available for this section.");
    return;
  }

  const labelFor = options.label ?? ((row) => row.label ?? row.stage ?? row.status ?? "-");
  const valueFor = options.value ?? ((row) => row.value ?? row.count ?? 0);
  const total = options.total ?? Math.max(...rows.map((row) => Number(valueFor(row)) || 0), 1);
  const color = options.color ?? "#2563eb";
  const x = doc.page.margins.left;
  const barWidth = 360;

  for (const row of rows) {
    ensureSpace(doc, 34);
    const y = doc.y;
    const rawValue = Number(valueFor(row)) || 0;
    const width = total > 0 ? Math.max(0, Math.min(barWidth, (rawValue / total) * barWidth)) : 0;

    doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#111827").text(truncate(labelFor(row), 38), x, y, { width: 290 });
    doc.font("Helvetica").fontSize(8.5).fillColor("#6b7280").text(options.valueLabel ? options.valueLabel(row) : String(rawValue), x + 380, y, {
      width: 119,
      align: "right",
    });
    doc.roundedRect(x, y + 15, barWidth, 6, 3).fill("#e5e7eb");
    doc.roundedRect(x, y + 15, width, 6, 3).fill(color);
    doc.y = y + 31;
  }

  doc.x = doc.page.margins.left;
  doc.moveDown(0.35);
}

/**
 * Streams a one-page PDF "Project Report Card" for a team to `res`.
 */
export async function streamTeamReportCardPdf(teamId, res) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      id: true, name: true, stage: true, bio: true, createdAt: true,
      leader:  { select: { firstName: true, lastName: true, email: true } },
      doctor:  { select: { firstName: true, lastName: true, email: true } },
      ta:      { select: { firstName: true, lastName: true, email: true } },
      members: { select: { user: { select: { firstName: true, lastName: true, email: true } } } },
      proposal: { select: { title: true, status: true, version: true } },
      submissions: {
        select: {
          deliverableType: true, sdlcPhase: true, status: true, grade: true,
          taRecommendedGrade: true, version: true, submittedAt: true, reviewedAt: true,
        },
        orderBy: [{ sdlcPhase: "asc" }, { submittedAt: "desc" }],
      },
    },
  });

  if (!team) throw new AppError("Team not found.", 404, "TEAM_NOT_FOUND");

  // Compute weighted grade (same algorithm as Grades Overview)
  const graded = team.submissions.filter((s) => s.status === "APPROVED" && s.grade !== null);
  const phaseAverages = {};
  for (const s of graded) {
    if (!phaseAverages[s.sdlcPhase]) phaseAverages[s.sdlcPhase] = { total: 0, count: 0 };
    phaseAverages[s.sdlcPhase].total += s.grade;
    phaseAverages[s.sdlcPhase].count += 1;
  }
  const phaseAvg = {};
  Object.entries(phaseAverages).forEach(([p, { total, count }]) => { phaseAvg[p] = Math.round(total / count); });

  const { weightedFinal, isFinalComplete } = calculateWeightedFinal(phaseAvg);
  const avgGrade = graded.length
    ? Math.round(graded.reduce((s, x) => s + x.grade, 0) / graded.length)
    : null;
  const final = weightedFinal ?? avgGrade;

  // ── PDF setup ────────────────────────────────────────────────────────────
  const filename = `report-card-${team.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  const doc = new PDFDocument({ size: "A4", margin: 48 });
  doc.pipe(res);

  // Header
  doc.fontSize(20).font("Helvetica-Bold").text("Project Report Card", { align: "left" });
  doc.moveDown(0.2);
  doc.fontSize(10).font("Helvetica").fillColor("#666")
     .text(`Generated ${new Date().toLocaleString()}`, { align: "left" });
  doc.moveDown(1);

  // Divider
  doc.strokeColor("#e2e8f0").lineWidth(1).moveTo(48, doc.y).lineTo(547, doc.y).stroke();
  doc.moveDown(0.8);

  // Team identity block
  doc.fillColor("#111").fontSize(16).font("Helvetica-Bold").text(team.name);
  doc.moveDown(0.2);
  doc.fontSize(10).font("Helvetica").fillColor("#555")
     .text(`SDLC Phase: ${team.stage}    ·    Created ${new Date(team.createdAt).toLocaleDateString()}`);
  if (team.bio) {
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor("#444").text(team.bio, { width: 500 });
  }
  doc.moveDown(0.8);

  // Big grade block
  const gradeY = doc.y;
  doc.rect(48, gradeY, 160, 110).fillAndStroke("#fef3c7", "#fbbf24");
  doc.fillColor("#111").fontSize(48).font("Helvetica-Bold")
     .text(gradeLetter(final), 48, gradeY + 18, { width: 160, align: "center" });
  doc.fontSize(20).font("Helvetica-Bold").fillColor("#666")
     .text(final !== null ? `${final}/100` : "Not graded", 48, gradeY + 75, { width: 160, align: "center" });

  // Stats block on right
  const statsX = 230;
  doc.fillColor("#111").fontSize(11).font("Helvetica-Bold").text("Summary", statsX, gradeY);
  doc.fontSize(10).font("Helvetica").fillColor("#444");
  doc.text(`Submissions graded: ${graded.length} / ${team.submissions.length}`, statsX, gradeY + 22);
  doc.text(`Average grade: ${avgGrade !== null ? avgGrade + "/100" : "—"}`, statsX, gradeY + 38);
  doc.text(`${isFinalComplete ? "Final grade" : "Current weighted score"}: ${weightedFinal !== null ? weightedFinal + "/100" : "—"}`, statsX, gradeY + 54);
  doc.text(`Team size: ${team.members.length + 1} members`, statsX, gradeY + 70);
  doc.text(`Proposal: ${team.proposal ? team.proposal.status : "Not started"}`, statsX, gradeY + 86);

  doc.y = gradeY + 130;
  doc.moveDown(0.5);

  // Supervisors
  doc.fillColor("#111").fontSize(12).font("Helvetica-Bold").text("Team & Supervisors");
  doc.moveDown(0.3);
  doc.fontSize(10).font("Helvetica").fillColor("#444");
  doc.text(`Leader:  ${fullName(team.leader)}    ${team.leader?.email ?? ""}`);
  doc.text(`Doctor:  ${fullName(team.doctor)}    ${team.doctor?.email ?? ""}`);
  doc.text(`TA:      ${fullName(team.ta)}    ${team.ta?.email ?? ""}`);
  doc.text(`Members: ${team.members.map((m) => fullName(m.user)).join(", ") || "—"}`);
  doc.moveDown(1);

  // Phase averages table
  doc.fillColor("#111").fontSize(12).font("Helvetica-Bold").text("SDLC Phase Performance");
  doc.moveDown(0.3);

  const phases = ["REQUIREMENTS", "DESIGN", "IMPLEMENTATION", "TESTING", "DEPLOYMENT", "MAINTENANCE"];
  const colWidths = [200, 60, 80, 80, 80];
  const tableX = 48;
  let tableY = doc.y;

  doc.fontSize(9).font("Helvetica-Bold").fillColor("#666");
  doc.text("Phase", tableX, tableY);
  doc.text("Weight", tableX + colWidths[0], tableY, { width: colWidths[1], align: "right" });
  doc.text("Approved", tableX + colWidths[0] + colWidths[1], tableY, { width: colWidths[2], align: "right" });
  doc.text("Avg Grade", tableX + colWidths[0] + colWidths[1] + colWidths[2], tableY, { width: colWidths[3], align: "right" });
  doc.text("Letter", tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], tableY, { width: colWidths[4], align: "right" });

  tableY += 14;
  doc.strokeColor("#e2e8f0").lineWidth(0.5).moveTo(tableX, tableY).lineTo(tableX + 500, tableY).stroke();
  tableY += 6;

  doc.font("Helvetica").fontSize(10).fillColor("#222");
  for (const p of phases) {
    const avg = phaseAvg[p];
    const approvedCount = team.submissions.filter((s) => s.sdlcPhase === p && s.status === "APPROVED").length;
    const totalCount    = team.submissions.filter((s) => s.sdlcPhase === p).length;
    doc.text(p, tableX, tableY);
    doc.text(`${Math.round(PHASE_WEIGHTS[p] * 100)}%`, tableX + colWidths[0], tableY, { width: colWidths[1], align: "right" });
    doc.text(`${approvedCount}/${totalCount}`, tableX + colWidths[0] + colWidths[1], tableY, { width: colWidths[2], align: "right" });
    doc.text(avg !== undefined ? `${avg}/100` : "—", tableX + colWidths[0] + colWidths[1] + colWidths[2], tableY, { width: colWidths[3], align: "right" });
    doc.text(gradeLetter(avg), tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], tableY, { width: colWidths[4], align: "right" });
    tableY += 18;
  }
  doc.y = tableY + 8;

  // Submission detail
  doc.moveDown(0.5);
  doc.fillColor("#111").fontSize(12).font("Helvetica-Bold").text("Submission Detail");
  doc.moveDown(0.3);
  doc.fontSize(9).font("Helvetica").fillColor("#444");
  if (team.submissions.length === 0) {
    doc.text("No submissions yet.");
  } else {
    for (const s of team.submissions.slice(0, 12)) {
      const gradeStr = s.grade !== null ? `${s.grade}/100` : (s.taRecommendedGrade !== null ? `TA: ${s.taRecommendedGrade}` : "—");
      const dateStr = s.reviewedAt
        ? new Date(s.reviewedAt).toLocaleDateString()
        : (s.submittedAt ? new Date(s.submittedAt).toLocaleDateString() : "—");
      doc.text(`• ${s.deliverableType} (v${s.version}) — ${s.status} — ${gradeStr} — ${dateStr}`);
    }
    if (team.submissions.length > 12) {
      doc.fillColor("#888").text(`…and ${team.submissions.length - 12} more`);
    }
  }

  // Footer
  doc.moveDown(2);
  doc.fontSize(8).fillColor("#999").text("Generated by Graduation Project Management System", { align: "center" });

  doc.end();
}

export async function streamGradesOverviewPdf(actor, res) {
  const report = await getGradesOverview({ actor });
  const filename = `grades-report-${reportDateStamp()}.pdf`;
  const scopeLabel = actor?.role === "DOCTOR" ? "Supervised teams" : "All teams";
  const doc = createReportDoc(
    res,
    filename,
    "Team Grades Report",
    `${scopeLabel} - generated ${formatDateTime(new Date())}`,
  );

  writeMetricGrid(doc, [
    { label: "Teams", value: report.summary.totalTeams },
    { label: "Teams with grades", value: report.summary.teamsWithGrades },
    { label: "Average grade", value: `${report.summary.globalAverage}/100` },
    { label: "Approved submissions", value: report.summary.totalApproved },
    { label: "Pending review", value: report.summary.totalPendingReview },
    { label: "Under review", value: report.summary.totalUnderReview },
    { label: "Needs revision", value: report.summary.totalNeedsRevision },
  ]);

  sectionTitle(doc, "Per-team Grades");
  writeTable(
    doc,
    [
      { label: "Team", key: "teamName", width: 116, max: 26 },
      { label: "Stage", key: "stage", width: 86, max: 18 },
      { label: "Leader", render: (r) => r.leader?.fullName ?? "-", width: 94, max: 22 },
      { label: "Doctor", render: (r) => r.doctor?.fullName ?? "-", width: 86, max: 20 },
      { label: "Avg", render: (r) => formatNumber(r.averageGrade, "/100"), width: 42, align: "right" },
      { label: "Final", render: (r) => formatNumber(r.weightedFinal, "/100"), width: 42, align: "right" },
      { label: "Subs", render: (r) => r.stats.total, width: 34, align: "right" },
    ],
    report.rows,
  );

  doc.moveDown(1);
  doc.fontSize(8).fillColor("#9ca3af").text("Generated by Graduation Project Management System", { align: "center" });
  doc.end();
}

export async function streamSdlcPhasesPdf(actor, res) {
  const analytics = await getAnalytics({ actor });
  const filename = `sdlc-phases-report-${reportDateStamp()}.pdf`;
  const scopeLabel = actor?.role === "DOCTOR" ? "Supervised teams" : "All teams";
  const doc = createReportDoc(
    res,
    filename,
    "SDLC Phases Report",
    `${scopeLabel} - generated ${formatDateTime(new Date())}`,
  );

  writeMetricGrid(doc, [
    { label: "Teams", value: analytics.overview.totalTeams },
    { label: "Submissions", value: analytics.submissions.total },
    { label: "Approved", value: analytics.submissions.byStatus.APPROVED ?? 0 },
    { label: "Average grade", value: `${analytics.submissions.averageGrade}/100` },
    { label: "On-time rate", value: `${analytics.submissions.onTimeRate}%` },
    { label: "Late submissions", value: analytics.submissions.lateSubmissions },
  ]);

  sectionTitle(doc, "Phase Performance");
  writeTable(
    doc,
    [
      { label: "Phase", key: "stage", width: 160, max: 28 },
      { label: "Total", key: "total", width: 70, align: "right" },
      { label: "Approved", key: "approved", width: 80, align: "right" },
      { label: "Avg grade", render: (r) => formatNumber(r.averageGrade, "/100"), width: 90, align: "right" },
      { label: "Approval rate", render: (r) => (r.total ? `${Math.round((r.approved / r.total) * 100)}%` : "-"), width: 100, align: "right" },
    ],
    analytics.submissions.byPhase,
  );

  sectionTitle(doc, "Submission Status");
  writeTable(
    doc,
    [
      { label: "Status", key: "label", width: 250, max: 32 },
      { label: "Count", key: "value", width: 250, align: "right" },
    ],
    rowsFromRecord(analytics.submissions.byStatus),
  );

  doc.moveDown(1);
  doc.fontSize(8).fillColor("#9ca3af").text("Generated by Graduation Project Management System", { align: "center" });
  doc.end();
}

export async function streamAnalyticsReportPdf(actor, res) {
  const [analytics, actorUser, sprintRecords] = await Promise.all([
    getAnalytics({ actor }),
    actor?.id
      ? prisma.user.findUnique({
          where: { id: actor.id },
          select: { firstName: true, lastName: true, email: true, role: true },
        })
      : null,
    prisma.sprint.findMany({
      where: actor?.role === "DOCTOR" ? { team: { doctorId: actor.id } } : {},
      select: {
        id: true,
        name: true,
        status: true,
        startDate: true,
        endDate: true,
        team: { select: { name: true, stage: true } },
        tasks: { select: { status: true, storyPoints: true } },
      },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    }),
  ]);
  const filename = `analytics-report-${reportDateStamp()}.pdf`;
  const scopeLabel = actor?.role === "DOCTOR" ? "Supervised teams" : "System-wide";
  const requestedBy = actorUser ? `${fullName(actorUser)} (${humanizeEnum(actorUser.role)})` : humanizeEnum(actor?.role ?? "system");
  const sprintSummaries = sprintRecords.map((sprint) => {
    const totalTasks = sprint.tasks.length;
    const completedTasks = sprint.tasks.filter((task) => ["DONE", "APPROVED"].includes(task.status)).length;
    const totalStoryPoints = sprint.tasks.reduce((sum, task) => sum + (task.storyPoints ?? 0), 0);
    const completedStoryPoints = sprint.tasks
      .filter((task) => ["DONE", "APPROVED"].includes(task.status))
      .reduce((sum, task) => sum + (task.storyPoints ?? 0), 0);
    const progress = totalStoryPoints > 0
      ? Math.round((completedStoryPoints / totalStoryPoints) * 100)
      : totalTasks > 0
        ? Math.round((completedTasks / totalTasks) * 100)
        : 0;

    return {
      ...sprint,
      totalTasks,
      completedTasks,
      totalStoryPoints,
      completedStoryPoints,
      progress,
    };
  });
  const sprintProgressAverage = sprintSummaries.length
    ? Math.round(sprintSummaries.reduce((sum, sprint) => sum + sprint.progress, 0) / sprintSummaries.length)
    : 0;
  const sprintStatusRows = rowsFromRecord(
    sprintSummaries.reduce((acc, sprint) => {
      acc[sprint.status] = (acc[sprint.status] ?? 0) + 1;
      return acc;
    }, {}),
  ).map((row) => ({ ...row, label: humanizeEnum(row.label) }));
  const trendRows = analytics.trend.submissions.map((week, index) => ({
    label: week.label,
    submissions: week.count,
    tasks: analytics.trend.tasks[index]?.count ?? 0,
    meetings: analytics.trend.meetings[index]?.count ?? 0,
  }));
  const doc = createReportDoc(
    res,
    filename,
    "Graduation Project Management System - Analytics Report",
    `${scopeLabel} snapshot - generated ${formatDateTime(analytics.generatedAt)} - requested by ${requestedBy}`,
  );

  writeInfoBox(doc, "Report Context", [
    `Scope: ${scopeLabel}.`,
    `Generated date/time: ${formatDateTime(analytics.generatedAt)}.`,
    `Requested by: ${requestedBy}${actorUser?.email ? ` - ${actorUser.email}` : ""}.`,
    "Percentages are rounded for readability. Empty sections mean no matching records were found for this scope.",
  ]);

  sectionTitle(doc, "Overview / Summary");
  writeParagraph(
    doc,
    "This report summarizes project health across teams, tasks, submissions, sprints, meetings, proposals, and risks. It is designed for a quick academic supervision review, with the highest-signal metrics first and detailed tables below.",
  );

  writeMetricGrid(doc, [
    { label: actor?.role === "DOCTOR" ? "Students" : "Users", value: analytics.overview.totalUsers },
    { label: "Teams", value: analytics.overview.totalTeams },
    { label: "Tasks", value: analytics.tasks.total },
    { label: "Submissions", value: analytics.submissions.total },
    { label: "Average grade", value: formatMetricValue(analytics.overview.averageGrade, "/100") },
    { label: "Completion rate", value: formatPercent(analytics.overview.completionRate) },
    { label: "On-time rate", value: formatPercent(analytics.overview.onTimeRate) },
    { label: "Active critical risks", value: analytics.risks.criticalActive ?? analytics.risks.criticalOpen },
  ]);

  sectionTitle(doc, "Team Distribution");
  writeParagraph(doc, "Shows how teams are distributed across SDLC phases. A heavy concentration in early phases may need planning follow-up.");
  writeProgressList(doc, analytics.overview.teamsByStage, {
    label: (row) => humanizeEnum(row.stage),
    value: (row) => row.count,
    total: analytics.overview.totalTeams || undefined,
    valueLabel: (row) => `${row.count} team${row.count === 1 ? "" : "s"}`,
    color: "#2563eb",
    emptyMessage: "No team distribution data is available.",
  });
  writeTableOrEmpty(
    doc,
    [
      { label: "SDLC phase", render: (r) => humanizeEnum(r.stage), width: 350, max: 40 },
      { label: "Teams", key: "count", width: 150, align: "right" },
    ],
    analytics.overview.teamsByStage,
    "No team distribution data is available.",
  );

  sectionTitle(doc, "Task Progress");
  writeParagraph(doc, "Task progress combines backlog, in-progress, review, approved, and completed work. GitHub-linked tasks are included when repository integration is active.");
  writeMetricGrid(doc, [
    { label: "Overdue", value: analytics.tasks.overdue },
    { label: "GitHub linked", value: analytics.tasks.githubLinked },
    { label: "Completion rate", value: formatPercent(analytics.tasks.completionRate) },
  ]);
  writeProgressList(doc, rowsFromRecord(analytics.tasks.byStatus).map((row) => ({ ...row, label: humanizeEnum(row.label) })), {
    total: analytics.tasks.total || undefined,
    valueLabel: (row) => `${row.value} task${row.value === 1 ? "" : "s"}`,
    color: "#16a34a",
    emptyMessage: "No task status data is available.",
  });
  writeTableOrEmpty(
    doc,
    [
      { label: "Status", key: "label", width: 250 },
      { label: "Count", key: "value", width: 250, align: "right" },
    ],
    rowsFromRecord(analytics.tasks.byStatus).map((row) => ({ ...row, label: humanizeEnum(row.label) })),
    "No task status data is available.",
  );

  sectionTitle(doc, "Sprint Progress");
  writeParagraph(doc, "Sprint progress is calculated from completed story points where available, falling back to completed task count when story points are empty.");
  writeMetricGrid(doc, [
    { label: "Sprints", value: sprintSummaries.length },
    { label: "Active", value: sprintSummaries.filter((sprint) => sprint.status === "ACTIVE").length },
    { label: "Completed", value: sprintSummaries.filter((sprint) => sprint.status === "COMPLETED").length },
    { label: "Avg progress", value: formatPercent(sprintProgressAverage) },
  ]);
  writeTableOrEmpty(
    doc,
    [
      { label: "Sprint", key: "name", width: 112, max: 24 },
      { label: "Team", render: (r) => r.team?.name ?? "-", width: 98, max: 22 },
      { label: "Status", render: (r) => humanizeEnum(r.status), width: 72, max: 16 },
      { label: "Tasks", render: (r) => `${r.completedTasks}/${r.totalTasks}`, width: 54, align: "right" },
      { label: "Story points", render: (r) => `${r.completedStoryPoints}/${r.totalStoryPoints}`, width: 80, align: "right" },
      { label: "Progress", render: (r) => formatPercent(r.progress), width: 80, align: "right" },
    ],
    sprintSummaries.slice(0, 16),
    "No sprint data is available for this report scope.",
  );
  if (sprintSummaries.length > 16) {
    writeParagraph(doc, `${sprintSummaries.length - 16} additional sprints are included in the summary metrics but omitted from the detail table to keep the PDF readable.`);
  }
  writeProgressList(doc, sprintStatusRows, {
    total: sprintSummaries.length || undefined,
    valueLabel: (row) => `${row.value} sprint${row.value === 1 ? "" : "s"}`,
    color: "#7c3aed",
    emptyMessage: "No sprint status distribution is available.",
  });

  sectionTitle(doc, "Submissions / Documents / Resources");
  writeParagraph(doc, "Submission metrics describe academic deliverable flow by SDLC phase and review status. Documents and resources are represented through submission availability when detailed content counts are not part of the analytics payload.");
  writeMetricGrid(doc, [
    { label: "Total submissions", value: analytics.submissions.total },
    { label: "Graded", value: analytics.submissions.graded },
    { label: "Average grade", value: formatMetricValue(analytics.submissions.averageGrade, "/100") },
    { label: "On-time rate", value: formatPercent(analytics.submissions.onTimeRate) },
    { label: "Late submissions", value: analytics.submissions.lateSubmissions },
  ]);
  writeTableOrEmpty(
    doc,
    [
      { label: "Phase", render: (r) => humanizeEnum(r.stage), width: 160, max: 28 },
      { label: "Total", key: "total", width: 70, align: "right" },
      { label: "Approved", key: "approved", width: 80, align: "right" },
      { label: "Avg grade", render: (r) => formatMetricValue(r.averageGrade, "/100"), width: 90, align: "right" },
      { label: "Approval rate", render: (r) => (r.total ? formatPercent((r.approved / r.total) * 100) : "-"), width: 100, align: "right" },
    ],
    analytics.submissions.byPhase,
    "No submission phase data is available.",
  );
  writeTableOrEmpty(
    doc,
    [
      { label: "Submission status", key: "label", width: 250 },
      { label: "Count", key: "value", width: 250, align: "right" },
    ],
    rowsFromRecord(analytics.submissions.byStatus).map((row) => ({ ...row, label: humanizeEnum(row.label) })),
    "No submission status data is available.",
  );

  sectionTitle(doc, "Governance and Risk");
  writeParagraph(doc, "These tables summarize proposal review, meeting activity, and open risk signals. Active critical risks should be reviewed first.");
  writeTableOrEmpty(
    doc,
    [
      { label: "Proposal status", key: "label", width: 250 },
      { label: "Count", key: "value", width: 250, align: "right" },
    ],
    rowsFromRecord(analytics.proposals.byStatus).map((row) => ({ ...row, label: humanizeEnum(row.label) })),
    "No proposal status data is available.",
  );
  writeTableOrEmpty(
    doc,
    [
      { label: "Meeting status", key: "label", width: 250 },
      { label: "Count", key: "value", width: 250, align: "right" },
    ],
    rowsFromRecord(analytics.meetings.byStatus).map((row) => ({ ...row, label: humanizeEnum(row.label) })),
    "No meeting status data is available.",
  );
  writeTableOrEmpty(
    doc,
    [
      { label: "Risk status", key: "label", width: 250 },
      { label: "Count", key: "value", width: 250, align: "right" },
    ],
    rowsFromRecord(analytics.risks.byStatus).map((row) => ({ ...row, label: humanizeEnum(row.label) })),
    "No risk status data is available.",
  );

  sectionTitle(doc, "12-week Trend Snapshot");
  writeParagraph(doc, "The trend table helps identify recent delivery rhythm across submissions, task movement, and meetings.");
  writeTableOrEmpty(
    doc,
    [
      { label: "Week", key: "label", width: 100 },
      { label: "Submissions", key: "submissions", width: 130, align: "right" },
      { label: "Tasks", key: "tasks", width: 130, align: "right" },
      { label: "Meetings", key: "meetings", width: 140, align: "right" },
    ],
    trendRows,
    "No trend data is available.",
  );

  sectionTitle(doc, "Insights and Notes");
  writeInfoBox(doc, "How to read this report", [
    `Overall task completion is ${formatPercent(analytics.tasks.completionRate)} and sprint progress averages ${formatPercent(sprintProgressAverage)} for the current scope.`,
    `Submission on-time rate is ${formatPercent(analytics.submissions.onTimeRate)} with ${analytics.submissions.lateSubmissions} late submission${analytics.submissions.lateSubmissions === 1 ? "" : "s"}.`,
    `Critical active risks: ${analytics.risks.criticalActive ?? analytics.risks.criticalOpen}. Review these before routine status items.`,
  ]);

  doc.moveDown(1);
  doc.fontSize(8).fillColor("#9ca3af").text("Generated by Graduation Project Management System", { align: "center" });
  doc.end();
}
