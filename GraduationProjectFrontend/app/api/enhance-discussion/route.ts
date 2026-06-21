import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

export async function POST(req: Request) {
  try {
    const { content, category } = await req.json();

    if (!content) {
      return new Response(JSON.stringify({ error: "Content is required" }), { status: 400 });
    }

    const { text } = await generateText({
      model: google('gemini-2.5-flash'),
      prompt: `You are an expert technical writer and professional communicator helping a university student or professor polish their discussion post for a Graduation Project Management System.
      
      Category of the discussion: ${category || 'General'}
      
      Raw Input:
      """
      ${content}
      """
      
      Instructions:
      1. Rewrite the raw input to be highly professional, clear, and well-structured.
      2. Fix any grammar or spelling mistakes.
      3. Organize it into short paragraphs or use bullet points if it helps clarity.
      4. DO NOT add any conversational filler like "Here is your rewritten text". Output ONLY the finalized professional text.
      5. Maintain the original intent and core message.
      `
    });

    return new Response(JSON.stringify({ enhancedText: text }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("AI Enhance Discussion Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to enhance discussion text." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
