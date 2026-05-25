import { getHelpGuideById } from "@/lib/help-guides"

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params
  const guide = getHelpGuideById(slug)

  if (!guide) {
    return new Response("Guide not found", { status: 404 })
  }

  return Response.redirect(new URL(`/help-guides/${guide.filename}`, request.url), 307)
}
