import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

const supervisorMatchesSchema = z.object({
  recommendations: z.array(z.object({
    doctorId: z.string().describe("The exact ID of the recommended person from the provided list"),
    role: z.enum(["DOCTOR", "TA"]).describe("The role of this person - DOCTOR or TA"),
    matchScore: z.number().describe("A score from 1 to 100 indicating how well they match the team"),
    reasoning: z.string().describe("A professional, 2-3 sentence explanation of why this supervisor is a great match for this specific team based on their stack and the supervisor's expertise.")
  })).length(3).describe("Exactly top 3 recommended supervisors")
});

export async function POST(req: Request) {
  try {
    const { team, doctors } = await req.json();

    if (!team || !doctors || !Array.isArray(doctors)) {
      return new Response(JSON.stringify({ error: "Invalid payload. 'team' object and 'doctors' array are required." }), { status: 400 });
    }

    const doctorsList = doctors.filter((d: any) => d.role === "DOCTOR");
    const tasList = doctors.filter((d: any) => d.role === "TA");

    const { object } = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: supervisorMatchesSchema,
      prompt: `You are an expert Academic Advisor matching a software engineering student team with their ideal faculty supervisors.
      
      The Team looking for supervisors:
      Name: ${team.name}
      Tech Stack: ${team.stack?.join(", ") || "General"}
      Project Idea: ${team.bio || "None provided"}
      
      Available Doctors (${doctorsList.length} total):
      ${JSON.stringify(doctorsList, null, 2)}
      
      Available Teaching Assistants / TAs (${tasList.length} total):
      ${JSON.stringify(tasList, null, 2)}
      
      CRITICAL RULES:
      1. You MUST return exactly 3 recommendations.
      2. You MUST include AT LEAST 1 DOCTOR and AT LEAST 1 TA in your 3 recommendations.
      3. The third pick can be either a Doctor or TA - whoever is the strongest match.
      4. Match based on department, bio, and how well their expertise aligns with the team's tech stack and project idea.
      5. Return the exact 'id' field from the list as 'doctorId'.
      6. Return the correct 'role' field ("DOCTOR" or "TA") for each person.
      7. Scores should reflect genuine quality of match (1-100).`,
    });

    return new Response(JSON.stringify(object.recommendations), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error("AI Supervisor Matching Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate supervisor recommendations. Please try again." }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
