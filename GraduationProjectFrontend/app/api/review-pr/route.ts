import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

const reviewSchema = z.object({
  verdict: z.enum(["APPROVE", "REQUEST_CHANGES", "COMMENT"]).describe("The overall decision for the pull request."),
  summary: z.string().describe("A high-level summary of the code changes, including any major issues or positive notes."),
  lineComments: z.array(z.object({
    file: z.string().describe("The filename the comment applies to."),
    line: z.number().describe("The line number in the patched file."),
    comment: z.string().describe("The specific feedback for this line of code.")
  })).describe("Specific line-by-line comments for the pull request diff."),
  suggestions: z.array(z.string()).describe("General suggestions or next steps for the developer.")
});

export async function POST(req: Request) {
  try {
    const { title, description, baseBranch, headBranch, changedFiles } = await req.json();

    if (!title || !changedFiles) {
      return new Response(JSON.stringify({ error: "Missing required PR data." }), { status: 400 });
    }

    // Limit the number of files and diff size to avoid massive prompts
    const limitedFiles = changedFiles.slice(0, 10);
    const diffString = limitedFiles.map((f: any) => {
      return `File: ${f.filename}\nStatus: ${f.status}\nChanges: +${f.additions} -${f.deletions}\nDiff:\n${f.patch || "No patch available"}\n---`;
    }).join("\n");

    const { object } = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: reviewSchema,
      prompt: `You are an expert Senior Software Engineer reviewing a Pull Request.

PR Title: "${title}"
PR Description: "${description || 'No description provided.'}"
Branch: ${headBranch} -> ${baseBranch}

Here are the file changes (diffs) for this PR:
${diffString}

Your task is to provide a professional, constructive code review.
- Look for bugs, security issues, performance problems, or bad practices.
- Point out specific lines in your lineComments if there are issues.
- If the code is good, praise the developer and set the verdict to APPROVE.
- If there are critical issues, set the verdict to REQUEST_CHANGES.
- If you just have minor notes, set the verdict to COMMENT.
`
    });

    return new Response(JSON.stringify(object), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("AI PR Review Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate PR review. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
