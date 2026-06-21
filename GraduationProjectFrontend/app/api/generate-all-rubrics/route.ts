import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

const rubricSchema = z.array(
  z.object({
    name: z.string().describe("The name of the grading criterion (e.g., 'UI/UX Design')"),
    description: z.string().describe("A brief description of what is expected for full points"),
    points: z.number().describe("The maximum points achievable. The sum of all non-bonus criteria MUST be exactly 100."),
    isBonus: z.boolean().describe("Whether this is a bonus criterion (true) or a standard one (false)"),
    tips: z.array(z.string()).describe("1-3 short tips for the grader on what to look for")
  })
);

const allRubricsSchema = z.object({
  SRS: rubricSchema,
  UML: rubricSchema,
  PROTOTYPE: rubricSchema,
  CODE: rubricSchema,
  TEST_PLAN: rubricSchema,
  FINAL_REPORT: rubricSchema,
  PRESENTATION: rubricSchema,
});

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), { status: 400 });
    }

    // Call the Google Gemini model using the AI SDK
    const { object } = await generateObject({
      model: google('gemini-2.5-flash'), // 2.5-flash is extremely fast and handles large JSON structures well
      schema: allRubricsSchema,
      prompt: `You are an expert university professor creating a comprehensive grading rubric structure for a graduation project. 
      Generate 4 to 6 grading criteria for EVERY SINGLE phase of the project based on this description: "${prompt}".
      
      CRITICAL RULES FOR EVERY PHASE:
      1. The total 'points' for all non-bonus criteria combined MUST equal EXACTLY 100 for each phase independently.
      2. The combined length of the 'name' and 'description' MUST be very concise (MAXIMUM 100 characters total) because of strict database limits. Be punchy and direct.
      3. Provide 1 to 3 helpful grading tips for each criterion.`,
    });

    return new Response(JSON.stringify(object), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error("Bulk AI Generation Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate rubrics. Please check your API key and try again." }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
