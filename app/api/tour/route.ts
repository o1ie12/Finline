import { NextResponse } from "next/server";
import { updateStudentProfile, isNotConfigured } from "@/lib/db";
import { getCurrentStudent } from "@/lib/session";
import { readProfile } from "@/lib/studentProfile";
import { TOURS, isTourId, type TourId } from "@/lib/tour";

export const runtime = "nodejs";

/**
 * Record that the student has seen a tour. Body: { tour: "home" | "unit" |
 * "life" }. A request without a body is the life tour, which is what an
 * older page sends.
 *
 * The version comes from the server's own constant rather than the request
 * body: a client that sent an inflated number would permanently opt itself
 * out of every future tour, and there is no reason for the browser to have a
 * say in which version it just watched.
 *
 * Finishing and skipping are the same outcome here on purpose — both mean
 * "do not show this to me again", and a student who skips has made that
 * choice just as deliberately as one who clicks through to the end.
 */
export async function POST(req: Request) {
  let tour: TourId = "life";
  try {
    const body = (await req.json()) as { tour?: unknown } | null;
    if (body && body.tour !== undefined) {
      if (!isTourId(body.tour)) return NextResponse.json({ error: "unknown_tour" }, { status: 400 });
      tour = body.tour;
    }
  } catch {
    /* no body: the life tour */
  }
  const version = TOURS[tour].version;
  try {
    const student = await getCurrentStudent();
    if (!student) {
      return NextResponse.json({ error: "no_session" }, { status: 401 });
    }
    if (tour === "life") {
      await updateStudentProfile(student.id, { tutorialSeenVersion: version });
    } else {
      // The profile merges at the top level only, so keep the other tours' entries.
      const seen = readProfile(student.profile).toursSeen ?? {};
      await updateStudentProfile(student.id, { toursSeen: { ...seen, [tour]: version } });
    }
    return NextResponse.json({ tour, version });
  } catch (e) {
    if (isNotConfigured(e)) {
      return NextResponse.json(
        { error: "backend_not_configured" },
        { status: 503 },
      );
    }
    console.error("tour post failed", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
