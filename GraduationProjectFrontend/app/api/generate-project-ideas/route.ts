import { google } from "@ai-sdk/google"
import { generateObject } from "ai"
import { z } from "zod"

const projectIdeasSchema = z.object({
  ideas: z
    .array(
      z.object({
        title: z.string().describe("A short, catchy project name (3-6 words)"),
        description: z
          .string()
          .describe(
            "A detailed project description (150-250 words) explaining what the project does, who it's for, and its key features. This will be used as the team bio.",
          ),
      }),
    )
    .length(3)
    .describe("Exactly 3 distinct project ideas"),
})

export async function POST(req: Request) {
  try {
    const { teamSize, technologies, domains, description } = await req.json() as {
      teamSize: string
      technologies: string
      domains: string[]
      description: string
    }

    const { object } = await generateObject({
      model: google("gemini-2.5-flash"),
      schema: projectIdeasSchema,
      prompt: `You are an expert graduation project advisor helping university students choose a great project idea.

Team details:
- Team size: ${teamSize} members (including the leader)
- Technologies the team knows: ${technologies || "not specified"}
- Domains of interest: ${domains?.length ? domains.join(", ") : "not specified"}
- Additional context from the team: "${description || "none"}"

Generate exactly 3 distinct, practical, and impressive graduation project ideas that:
1. Match the team's technical skills and domain interests
2. Are feasible for a university graduation project (6-12 months timeline)
3. Have clear real-world value and impact
4. Can realistically be built with the team's tech stack and size

Each idea must have:
- A short, catchy project name (3-6 words)
- A detailed description (150-250 words) explaining what the project does, its target users, key features, the problem it solves, and why it's valuable

Make the ideas diverse and creative, each covering different aspects of their interests. Write in a professional yet accessible tone.`,
    })

    return new Response(JSON.stringify(object), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("AI Project Ideas Error:", message)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    )
  }
}
