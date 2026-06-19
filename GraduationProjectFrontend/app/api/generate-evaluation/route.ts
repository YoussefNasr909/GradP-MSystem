import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

const evaluationSchema = z.object({
  feedback: z.string().describe("A professional and reflective paragraph written from the perspective of the team, summarizing the sprint's successes, challenges, and overall progress."),
  planningQuality: z.number().min(1).max(10).describe("Score from 1-10 for how well the sprint was planned and scoped."),
  taskCompletion: z.number().min(1).max(10).describe("Score from 1-10 for how effectively the planned tasks were completed."),
  progressConsistency: z.number().min(1).max(10).describe("Score from 1-10 for consistent progress throughout the sprint."),
  teamCollaboration: z.number().min(1).max(10).describe("Score from 1-10 for teamwork and communication."),
  deadlineCommitment: z.number().min(1).max(10).describe("Score from 1-10 for adherence to the sprint timeframe and deadlines.")
});

export async function POST(req: Request) {
  try {
    const { sprintName, metrics, teamName } = await req.json();

    if (!sprintName || !metrics) {
      return new Response(JSON.stringify({ error: "sprintName and metrics are required" }), { status: 400 });
    }

    const { object } = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: evaluationSchema,
      prompt: `You are an expert Agile Software Engineering Teaching Assistant (TA) evaluating a student team's sprint performance.
      
      Team Name: "${teamName || 'The Team'}"
      Sprint Name: "${sprintName}"
      
      Sprint Metrics:
      - Total Tasks Planned: ${metrics.totalTasks || 0}
      - Completed Tasks: ${metrics.completedTasks || 0}
      - Total Story Points: ${metrics.totalStoryPoints || 0}
      - Completed Story Points: ${metrics.completedStoryPoints || 0}
      - Unplanned Tasks Added: ${metrics.unplannedTasks || 0}
      - Unplanned Story Points: ${metrics.unplannedStoryPoints || 0}
      - Overall Completion Progress: ${metrics.progress || 0}%
      
      Your job is to auto-draft the end-of-sprint evaluation for the team to review.
      
      Instructions:
      1. Write a realistic and professional 'feedback' paragraph reflecting on these specific metrics. Acknowledge if things went perfectly, or if there were scope changes (e.g., unplanned tasks) or incomplete tasks.
      2. Provide a 1-10 score for each of the 5 criteria based on these metrics. Be fair but realistic (e.g., if completion is 50%, taskCompletion should not be 10).
      `
    });

    return new Response(JSON.stringify(object), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("AI Sprint Evaluation Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate evaluation. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
