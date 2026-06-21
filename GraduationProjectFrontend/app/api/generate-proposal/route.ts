import { google } from "@ai-sdk/google"
import { generateObject } from "ai"
import { z } from "zod"

const proposalSchema = z.object({
  title: z.string().describe("A concise, professional project title (5-10 words)"),
  abstract: z.string().describe("A 2-3 paragraph executive summary of the project (200-400 words)"),
  problemStatement: z.string().describe("A detailed problem statement explaining the problem, who is affected, and why it matters now (150-300 words)"),
  scope: z.string().describe("What is included and explicitly excluded from the project scope (100-200 words)"),
  methodology: z.string().describe("The SDLC model, development approach, architecture, and processes to be used (100-200 words)"),
  timeline: z.string().describe("High-level milestones with estimated durations, e.g. Month 1-2: Requirements, Month 3-4: Design... (80-150 words)"),
  objectives: z.array(z.string()).min(3).max(8).describe("3-8 specific, measurable project objectives (each 5-15 words)"),
  technologies: z.array(z.string()).min(1).max(15).describe("List of technologies, frameworks, and tools to be used"),
  deliverables: z.array(z.string()).min(3).max(10).describe("3-10 concrete project deliverables (e.g. SRS document, MVP web app, final report)"),
})

export async function POST(req: Request) {
  try {
    const { projectDescription, teamSize, technologies } = await req.json() as {
      projectDescription: string
      teamSize?: number
      technologies?: string[]
    }

    if (!projectDescription || projectDescription.trim().length < 10) {
      return new Response(
        JSON.stringify({ error: "Project description is required." }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      )
    }

    const { object } = await generateObject({
      model: google("gemini-2.5-flash"),
      schema: proposalSchema,
      prompt: `You are an expert academic project proposal writer helping university students create a professional graduation project proposal.

Project details:
- Project description: "${projectDescription}"
${teamSize ? `- Team size: ${teamSize} members` : ""}
${technologies?.length ? `- Technologies the team uses: ${technologies.join(", ")}` : ""}

Generate a complete, professional graduation project proposal with all required sections. The proposal should be:
1. Academic in tone but clear and readable
2. Specific and detailed, not generic
3. Realistic for a university graduation project (6-12 months, team of ${teamSize ?? 4-5} students)
4. Grounded in the provided project description

Make sure all sections are coherent and consistent with each other. The objectives, deliverables, and timeline should align logically.`,
    })

    return new Response(JSON.stringify(object), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("AI Proposal Generation Error:", error)
    return new Response(
      JSON.stringify({ error: "Failed to generate proposal. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    )
  }
}
