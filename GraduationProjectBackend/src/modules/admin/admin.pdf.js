import PDFDocument from "pdfkit";
import { prisma } from "../../loaders/dbLoader.js";
import { AppError } from "../../common/errors/AppError.js";
import { PHASE_WEIGHTS, calculateWeightedFinal } from "../submissions/evaluation-policy.js";

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
