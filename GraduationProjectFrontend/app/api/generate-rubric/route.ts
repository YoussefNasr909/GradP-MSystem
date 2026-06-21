import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

// Force the response to be a structured array of Rubric Criteria
const rubricSchema = z.object({
  criteria: z.array(
    z.object({
      name: z.string().describe("The name of the grading criterion (e.g., 'UI/UX Design')"),
      description: z.string().describe("A brief description of what is expected for full points"),
      points: z.number().describe("The maximum points achievable. The sum of all non-bonus criteria MUST be exactly 100."),
      isBonus: z.boolean().describe("Whether this is a bonus criterion (true) or a standard one (false)"),
      tips: z.array(z.string()).describe("1-3 short tips for the grader on what to look for")
    })
  )
});

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), { status: 400 });
    }

    // Call the Google Gemini model using the AI SDK
    const { object } = await generateObject({
      model: google('gemini-2.5-flash'), // 2.5-flash is faster and great for this
      schema: rubricSchema,
      prompt: `You are an expert university professor creating a grading rubric for a graduation project. 
      Generate 4 to 6 grading criteria based on this project description: "${prompt}".
      
      CRITICAL RULES:
      1. The total 'points' for all non-bonus criteria combined MUST equal EXACTLY 100.
      2. The combined length of the 'name' and 'description' MUST be very concise (MAXIMUM 100 characters total) because of strict database limits. Be punchy and direct.
      3. Provide 1 to 3 helpful grading tips for each criterion.`,
    });

    return new Response(JSON.stringify(object.criteria), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error("AI Generation Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate rubric. Please check your API key and try again." }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
