import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

const sprintPlanSchema = z.object({
  sprintName: z.string().describe("A professional and concise name for the sprint based on the selected tasks (e.g., 'Sprint 3: Authentication & Security')."),
  goal: z.string().describe("A clear, actionable sprint goal summarizing what will be achieved by completing these tasks."),
  recommendedDuration: z.number().describe("Recommended sprint duration in days (usually 7, 14, or 21) based on the scope of tasks."),
  suggestedTaskIds: z.array(z.string()).describe("An array of the exact task IDs from the provided backlog that should be included in this sprint."),
  reasoning: z.string().describe("A brief, professional paragraph explaining to the team why these specific tasks were chosen and how they align with the sprint goal.")
});

export async function POST(req: Request) {
  try {
    const { teamName, backlogTasks } = await req.json();

    if (!teamName || !backlogTasks || !Array.isArray(backlogTasks)) {
      return new Response(JSON.stringify({ error: "teamName and backlogTasks array are required" }), { status: 400 });
    }

    if (backlogTasks.length === 0) {
      return new Response(JSON.stringify({ error: "Backlog is empty. No tasks to plan." }), { status: 400 });
    }

    // Format tasks for the prompt to reduce token size and focus on relevant data
    const formattedTasks = backlogTasks.map(t => ({
      id: t.id,
      title: t.title,
      type: t.type,
      priority: t.priority,
      storyPoints: t.storyPoints || "Not estimated"
    }));

    const { object } = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: sprintPlanSchema,
      prompt: `You are an expert Agile Scrum Master and Technical Project Manager.
      
      You are planning the next sprint for the software engineering team: "${teamName}".
      
      Below is their current backlog of tasks. Your job is to select a logical group of tasks to form a cohesive, achievable sprint.
      
      Rules for selection:
      1. Prioritize HIGH and URGENT priority tasks.
      2. Group related tasks if possible (e.g., frontend + backend for a feature).
      3. Don't select too many tasks. A typical sprint has a manageable scope (around 4-8 tasks depending on size).
      4. Ensure you return the EXACT task IDs of the tasks you select.
      
      Current Backlog Tasks:
      ${JSON.stringify(formattedTasks, null, 2)}
      `
    });

    return new Response(JSON.stringify(object), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("AI Sprint Plan Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate sprint plan. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
