import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

const evaluationSchema = z.object({
  decision: z.enum(["APPROVED", "REVISION_REQUESTED", "REJECTED"]).describe("The AI's recommended decision for this proposal."),
  score: z.number().min(0).max(100).describe("An overall quality score out of 100 based on feasibility, scope, and clarity."),
  strengths: z.array(z.string()).describe("A list of 2-4 strong points of the project proposal (e.g. 'Modern tech stack', 'Clear business value')."),
  weaknesses: z.array(z.string()).describe("A list of 2-4 weaknesses, risks, or vague areas (e.g. 'Timeline is too aggressive', 'Vague methodology')."),
  feedback: z.string().describe("A comprehensive, professionally worded feedback paragraph written directly to the students explaining the decision and what they need to change or focus on. Minimum 3 sentences.")
});

export async function POST(req: Request) {
  try {
    const { proposal } = await req.json();

    if (!proposal || !proposal.title) {
      return new Response(JSON.stringify({ error: "Valid proposal object is required" }), { status: 400 });
    }

    const { object } = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: evaluationSchema,
      prompt: `You are an expert university professor and software engineering supervisor evaluating a graduation project proposal.
      
      Review the following project proposal details thoroughly:
      
      Title: ${proposal.title}
      Abstract: ${proposal.abstract}
      Problem Statement: ${proposal.problemStatement}
      Scope: ${proposal.scope}
      Methodology: ${proposal.methodology}
      Timeline: ${proposal.timeline}
      Objectives: ${(proposal.objectives || []).join(", ")}
      Technologies: ${(proposal.technologies || []).join(", ")}
      Deliverables: ${(proposal.deliverables || []).join(", ")}
      
      Evaluate this proposal based on:
      1. Technical feasibility within a typical 8-9 month graduation timeframe.
      2. Clarity and comprehensiveness of the problem statement and objectives.
      3. Sensibility of the chosen tech stack for the given problem.
      
      Provide a rigorous but fair evaluation. If it is excellent, recommend APPROVED. If it has minor flaws or vague areas, recommend REVISION_REQUESTED. If it is fundamentally flawed or too simple, recommend REJECTED.`,
    });

    return new Response(JSON.stringify(object), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error("AI Evaluation Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to evaluate proposal. Please check your API key." }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
