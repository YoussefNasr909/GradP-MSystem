import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

const enhanceTaskSchema = z.object({
  description: z.string().describe("A professional, highly detailed description of the task requirements, technical details, and acceptance criteria based on the provided title. Format as markdown."),
  taskType: z.enum(["FEATURE", "BUG", "DOCS", "REFACTOR", "TEST", "CHORE"]).describe("The category of this task based on the title"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).describe("The suggested priority of the task based on typical importance")
});

export async function POST(req: Request) {
  try {
    const { title } = await req.json();

    if (!title) {
      return new Response(JSON.stringify({ error: "Title is required" }), { status: 400 });
    }

    // Call the Google Gemini model using the AI SDK
    const { object } = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: enhanceTaskSchema,
      prompt: `You are an expert Agile Project Manager and Technical Lead. 
      A student engineer wants to create a ticket but they only wrote a short, messy title: "${title}".
      
      Your job is to read their messy title and generate the perfect, comprehensive task details for them.
      
      CRITICAL RULES:
      1. Write a clear, multi-paragraph description. Include an "Acceptance Criteria" bulleted list if applicable.
      2. Choose the correct taskType (e.g. if it says "fix", it's a BUG. If it says "readme", it's DOCS).
      3. Choose the optimal priority.`,
    });

    return new Response(JSON.stringify(object), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error("AI Task Enhancement Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to enhance task. Please check your API key and try again." }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
