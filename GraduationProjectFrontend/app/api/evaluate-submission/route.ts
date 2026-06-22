import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import { PDFParse } from 'pdf-parse';
import { parseOffice } from 'officeparser';
import fs from 'fs';
import path from 'path';
import os from 'os';

const rubricScoreSchema = z.object({
  name: z.string().describe("The exact name of the rubric criterion being evaluated."),
  score: z.number().describe("The suggested numeric score for this criterion, up to the maximum score."),
  justification: z.string().describe("A 1-sentence justification for why this specific score was given.")
});

const evaluationSchema = z.object({
  rubricScores: z.array(rubricScoreSchema).describe("The evaluated scores for each rubric criterion."),
  feedback: z.string().describe("A comprehensive, professionally worded feedback paragraph regarding the overall quality of the submission. Minimum 3 sentences.")
});

export async function POST(req: Request) {
  try {
    const { submission, rubric } = await req.json();

    if (!submission || !rubric || !Array.isArray(rubric)) {
      return new Response(JSON.stringify({ error: "Valid submission and rubric array are required" }), { status: 400 });
    }

    const rubricContext = rubric.map((r: any) => `- ${r.name} (Max Score: ${r.maxScore})`).join('\n');

    let extractedText = "";

    // 1. Check if there is an uploaded file
    if (submission.fileUrl) {
      try {
        const response = await fetch(submission.fileUrl);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const fileType = (submission.fileType || "").toLowerCase();
          const ext = submission.fileUrl.split('.').pop()?.toLowerCase();

          if (fileType === "application/pdf" || ext === "pdf") {
            const parser = new PDFParse({ data: buffer });
            try {
              const data = await parser.getText();
              extractedText = data.text;
            } finally {
              await parser.destroy();
            }
          } else if (
            fileType.includes("presentation") || 
            fileType.includes("document") || 
            ['pptx', 'docx'].includes(ext || "")
          ) {
            // officeparser typically needs a file path, so we use a temp file
            const tempFilePath = path.join(os.tmpdir(), `temp_submission_${Date.now()}.${ext || 'docx'}`);
            fs.writeFileSync(tempFilePath, buffer);
            try {
              const parsed = await parseOffice(tempFilePath);
              extractedText =
                typeof parsed === "string"
                  ? parsed
                  : typeof parsed?.toText === "function"
                    ? parsed.toText()
                    : JSON.stringify(parsed?.content ?? parsed);
            } finally {
              if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch or parse file URL:", err);
      }
    }

    // Limit extracted text to roughly 200,000 characters to prevent massive token overload
    if (extractedText.length > 200000) {
      extractedText = extractedText.substring(0, 200000) + "\n... [DOCUMENT TRUNCATED] ...";
    }

    const { object } = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: evaluationSchema,
      prompt: `You are an expert university professor evaluating a graduation project phase submission.
      
      Review the following submission details:
      
      Title: "${submission.title || 'Untitled Submission'}"
      Phase/Deliverable Type: "${submission.deliverableType}"
      Notes from Students: "${submission.notes || 'None'}"
      
      ${extractedText ? `\n--- START OF SUBMISSION DOCUMENT CONTENT ---\n${extractedText}\n--- END OF SUBMISSION DOCUMENT CONTENT ---\n` : ''}
      
      You must evaluate this submission strictly against the following rubric criteria:
      ${rubricContext}
      
      Instructions:
      1. For each criterion, assign a score between 0 and its Max Score. Do not exceed the Max Score.
      2. Provide a 1-sentence justification for each score. Base your evaluation on the thoroughness, clarity, and professionalism of the notes, title, and the attached document content (if provided above). If the submission is very sparse, score appropriately lower.
      3. Write a 'feedback' paragraph summarizing the evaluation, highlighting what was done well and what needs improvement.
      `
    });

    return new Response(JSON.stringify(object), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("AI Submission Evaluation Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to generate evaluation. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
