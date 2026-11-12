import { NextResponse } from "next/server";
import { scoreSample } from "@/lib/coursePreview";
import { isLineSlug } from "@/lib/lines";

export const runtime = "nodejs";

/**
 * Score a course's sample question (lib/coursePreview.ts). No session, no
 * storage: body { slug, option, reason? } → { credit, correct, correctReason,
 * explanation } for that one question.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!isLineSlug(body?.slug)) return NextResponse.json({ error: "unknown_course" }, { status: 400 });
  if (typeof body.option !== "string") return NextResponse.json({ error: "missing_answer" }, { status: 400 });
  const out = scoreSample(body.slug, { option: body.option, reason: body.reason });
  if (!out) return NextResponse.json({ error: "no_sample" }, { status: 404 });
  return NextResponse.json(out);
}
