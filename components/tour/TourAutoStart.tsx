"use client";

import { useEffect, useRef } from "react";
import { HOME_TOUR, useTour } from "@/components/tour/TourProvider";
import { isTourId, type TourGo, type TourId } from "@/lib/tour";

/**
 * Opens a tour on the page that has its targets, for the reasons it should
 * open by itself:
 *
 *   - the student (or, without an account, this browser) has not seen this
 *     version of it;
 *   - a replay asked for it: 「看使用說明」 on another page routes here with
 *     `?tour=home` (`?tour=1` from older links), or, on this page, sends a
 *     `finline:tour` event.
 *
 * Rendered by the page because that is where the student's profile already
 * is: no extra query. The parameter is stripped at once so a reload, a
 * bookmark or a shared link does not replay the tour forever.
 */
export default function TourAutoStart({
  tour,
  seenVersion,
  go = null,
}: {
  tour: TourId;
  seenVersion: number | undefined;
  /** Where the tour's closing button leads (the home tour: the next unit). */
  go?: TourGo | null;
}) {
  const { autoStart, run, active } = useTour();
  const handled = useRef(false);

  useEffect(() => {
    if (!handled.current) {
      handled.current = true;
      const params = new URLSearchParams(window.location.search);
      const asked = params.get("tour");
      if (asked !== null) {
        params.delete("tour");
        const qs = params.toString();
        window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
        const which = asked === "1" ? HOME_TOUR : asked;
        if (which === tour) {
          run(tour, go);
          return;
        }
      }
    }
    // Asked again each time no tour is showing: a tour that had to wait for
    // another to close starts then, unless closing the other covered it.
    if (!active) autoStart(tour, seenVersion, go);
  }, [autoStart, run, active, tour, seenVersion, go]);

  // A replay asked for from this same page.
  useEffect(() => {
    const onAsk = (e: Event) => {
      const which = (e as CustomEvent).detail;
      if (isTourId(which) && which === tour) run(tour, go);
    };
    window.addEventListener("finline:tour", onAsk);
    return () => window.removeEventListener("finline:tour", onAsk);
  }, [run, tour, go]);

  return null;
}
