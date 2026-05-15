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
  doc.fontSize(12).font("Helvetica-Bold").fillColor("#111827").text(title);
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

  doc.y = y + 4;
}

function rowsFromRecord(record) {
  return Object.entries(record ?? {}).map(([label, value]) => ({ label, value }));
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
  const analytics = await getAnalytics({ actor });
  const filename = `analytics-report-${reportDateStamp()}.pdf`;
  const scopeLabel = actor?.role === "DOCTOR" ? "Supervised teams" : "System-wide";
  const doc = createReportDoc(
    res,
    filename,
    "Full Analytics Report",
    `${scopeLabel} analytics snapshot - generated ${formatDateTime(analytics.generatedAt)}`,
  );

  writeMetricGrid(doc, [
    { label: actor?.role === "DOCTOR" ? "Students" : "Users", value: analytics.overview.totalUsers },
    { label: "Teams", value: analytics.overview.totalTeams },
    { label: "Tasks", value: analytics.tasks.total },
    { label: "Submissions", value: analytics.submissions.total },
    { label: "Average grade", value: `${analytics.overview.averageGrade}/100` },
    { label: "Completion rate", value: `${analytics.overview.completionRate}%` },
    { label: "On-time rate", value: `${analytics.overview.onTimeRate}%` },
    { label: "Active critical risks", value: analytics.risks.criticalActive ?? analytics.risks.criticalOpen },
  ]);

  sectionTitle(doc, "Teams by SDLC Phase");
  writeTable(
    doc,
    [
      { label: "Phase", key: "stage", width: 350, max: 40 },
      { label: "Teams", key: "count", width: 150, align: "right" },
    ],
    analytics.overview.teamsByStage,
  );

  sectionTitle(doc, "Tasks");
  writeMetricGrid(doc, [
    { label: "Overdue", value: analytics.tasks.overdue },
    { label: "GitHub linked", value: analytics.tasks.githubLinked },
    { label: "Completion rate", value: `${analytics.tasks.completionRate}%` },
  ]);
  writeTable(
    doc,
    [
      { label: "Status", key: "label", width: 250 },
      { label: "Count", key: "value", width: 250, align: "right" },
    ],
    rowsFromRecord(analytics.tasks.byStatus),
  );

  sectionTitle(doc, "Submissions by Phase");
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

  sectionTitle(doc, "Proposals");
  writeTable(
    doc,
    [
      { label: "Status", key: "label", width: 250 },
      { label: "Count", key: "value", width: 250, align: "right" },
    ],
    rowsFromRecord(analytics.proposals.byStatus),
  );

  sectionTitle(doc, "Meetings");
  writeTable(
    doc,
    [
      { label: "Status", key: "label", width: 250 },
      { label: "Count", key: "value", width: 250, align: "right" },
    ],
    rowsFromRecord(analytics.meetings.byStatus),
  );

  sectionTitle(doc, "Risks");
  writeTable(
    doc,
    [
      { label: "Status", key: "label", width: 250 },
      { label: "Count", key: "value", width: 250, align: "right" },
    ],
    rowsFromRecord(analytics.risks.byStatus),
  );

  sectionTitle(doc, "12-week Trends");
  writeTable(
    doc,
    [
      { label: "Week", key: "label", width: 100 },
      { label: "Submissions", key: "submissions", width: 130, align: "right" },
      { label: "Tasks", key: "tasks", width: 130, align: "right" },
      { label: "Meetings", key: "meetings", width: 140, align: "right" },
    ],
    analytics.trend.submissions.map((week, index) => ({
      label: week.label,
      submissions: week.count,
      tasks: analytics.trend.tasks[index]?.count ?? 0,
      meetings: analytics.trend.meetings[index]?.count ?? 0,
    })),
  );

  doc.moveDown(1);
  doc.fontSize(8).fillColor("#9ca3af").text("Generated by Graduation Project Management System", { align: "center" });
  doc.end();
}
