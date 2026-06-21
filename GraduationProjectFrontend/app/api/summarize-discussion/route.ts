import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

const summarySchema = z.object({
  keyArguments: z.array(z.string()).describe("A list of the 3-5 most important points or arguments made during the discussion."),
  finalDecision: z.string().describe("A 1-3 sentence summary of the final decision reached, or the current consensus if no formal decision is made yet.")
});

export async function POST(req: Request) {
  try {
    const { discussionTitle, discussionContent, comments } = await req.json();

    if (!discussionTitle || !discussionContent) {
      return new Response(JSON.stringify({ error: "Discussion title and content are required" }), { status: 400 });
    }

    // Format the comments to be readable by the AI
    // We expect comments to be an array of objects: { author: string, content: string }
    const formattedComments = comments && Array.isArray(comments) && comments.length > 0
      ? comments.map((c: any, i: number) => `Comment ${i + 1} (${c.author}): ${c.content}`).join('\n\n')
      : "No comments yet.";

    const { object } = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: summarySchema,
      prompt: `You are an expert project manager analyzing a discussion thread from a Graduation Project Management System.
      
      Read the following original discussion post and all of its replies.

      --- ORIGINAL DISCUSSION ---
      Title: "${discussionTitle}"
      Content: "${discussionContent}"

      --- REPLIES ---
      ${formattedComments}
      -----------------------
      
      Instructions:
      1. Analyze the entire thread.
      2. Extract the 3 to 5 most important "Key Arguments" or points made by the participants.
      3. Determine the "Final Decision" or outcome of the discussion. If no outcome is clear, state the current consensus or what is blocking the decision.
      `
    });

    return new Response(JSON.stringify(object), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("AI Summarize Discussion Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to summarize discussion." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
