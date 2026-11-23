"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import TourOverlay from "@/components/tour/TourOverlay";
import { LIFE_SIM } from "@/lib/flags";
import { TOURS, tourStorageKey, type TourGo, type TourId, type TourStep, type TourVariant } from "@/lib/tour";

/**
 * Owns whether the tour is running, and which step it is on.
 *
 * Mounted once in the root layout rather than on the pages that have a
 * tour, because the help control lives in the site header and settings, and
 * both can start the home tour from anywhere. Keeping the engine next to the header means the control can
 * open the tour from anywhere without either of them knowing about the
 * destination pages.
 *
 * The step list is resolved against the DOM at the moment the tour starts,
 * not at module load: a step whose target is not rendered in the current
 * variant is dropped then and there, so it can never become a popover
 * anchored to nothing or a Next button that appears to do nothing.
 */

function variantForPath(pathname: string): TourVariant {
  return pathname.startsWith("/simulate") ? "simulate" : "learn";
}

/** The tour the 「看使用說明」 control replays: the home the student actually has. */
export const HOME_TOUR: TourId = LIFE_SIM ? "life" : "home";

/** True when this browser already holds a record of having seen this version (visitors have no profile). */
function seenHere(tour: TourId): boolean {
  try {
    return Number(window.localStorage.getItem(tourStorageKey(tour)) ?? 0) >= TOURS[tour].version;
  } catch {
    return false;
  }
}

interface TourApi {
  /** Replay the home tour from the beginning, from anywhere in the app. */
  start: () => void;
  /**
   * First-run entry: starts `tour` only if this student (or, without an
   * account, this browser) has not seen its current version. `go` is where
   * the tour's closing button leads.
   */
  autoStart: (tour: TourId, seenVersion: number | undefined, go?: TourGo | null) => void;
  /** Start `tour` now, on this page. */
  run: (tour: TourId, go?: TourGo | null) => void;
  active: boolean;
}

const TourContext = createContext<TourApi | null>(null);

export function useTour(): TourApi {
  const ctx = useContext(TourContext);
  if (!ctx) {
    throw new Error("useTour must be used inside <TourProvider>");
  }
  return ctx;
}

/** Like useTour, but null outside the provider instead of throwing. */
export function useTourOptional() {
  return useContext(TourContext);
}

export default function TourProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [steps, setSteps] = useState<TourStep[] | null>(null);
  const [index, setIndex] = useState(0);
  const [tour, setTour] = useState<TourId | null>(null);
  const [go, setGo] = useState<TourGo | null>(null);
  // Auto-start is once per tour per page session. Without this, every
  // re-render that reached autoStart would reopen a tour the student had
  // just skipped, because the profile write has not come back yet.
  const autoStarted = useRef(new Set<TourId>());
  // From the moment a tour starts resolving until it closes. A second tour
  // asked for meanwhile (the unit tour and the buttons' tour can both be
  // ready on the same question) waits; TourAutoStart asks again when this
  // one closes.
  const busy = useRef(false);

  const variant = variantForPath(pathname);

  /**
   * Resolve the step list against the DOM, giving it a moment to settle.
   *
   * A single synchronous query is wrong, and quietly so. Parts of the header
   * are client-only — the help control renders nothing until an effect has
   * read the session cookie — so at the instant a first-run tour starts, its
   * last step's target genuinely is not in the document yet. Resolving then
   * drops the one step that tells a student how to reopen the tour, and
   * nothing about the result looks broken: the tour just runs four steps
   * instead of five.
   *
   * So: resolve as soon as every target is found, and give up after a short
   * bounded wait for the ones that are legitimately absent in this variant.
   *
   * Polled on a timer rather than requestAnimationFrame. What is being
   * waited on is React committing a render, not the browser painting one,
   * and the two come apart exactly where it matters: rAF callbacks do not
   * fire at all in a hidden or backgrounded tab, so a tour opened in one
   * would sit unresolved instead of being ready the moment the student looks
   * at it. The overlay's own rect tracking does use rAF, because that really
   * is about painting.
   */
  const begin = useCallback((which: TourId, goTo: TourGo | null) => {
    busy.current = true;
    const STEP_MS = 16;
    const MAX_TRIES = 20; // ~320ms, imperceptible before a tour opens
    const all = TOURS[which].steps;
    let tries = 0;
    // On screen, not merely in the document: a control hidden by CSS (the
    // settings tab on a narrow screen with the life simulation on) would
    // otherwise get a spotlight around nothing.
    const shown = (s: TourStep) => {
      if (s.target === null) return true;
      const el = document.querySelector<HTMLElement>(`[data-tour-id="${s.target}"]`);
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const resolve = () => {
      const present = all.filter(shown);
      if (present.length === all.length || tries >= MAX_TRIES) {
        // Nothing to point at (only the centred cards are left): no tour.
        if (!present.some((s) => s.target !== null)) {
          busy.current = false;
          return;
        }
        setTour(which);
        setGo(goTo);
        setSteps(present);
        setIndex(0);
        return;
      }
      tries += 1;
      window.setTimeout(resolve, STEP_MS);
    };
    resolve();
  }, []);

  const run = useCallback((which: TourId, goTo?: TourGo | null) => begin(which, goTo ?? null), [begin]);

  const start = useCallback(() => {
    // The home tour's targets are on the home page. Elsewhere, go there and
    // start it on arrival (TourAutoStart reads ?tour=), rather than running a
    // hollow version of it wherever the student happens to be.
    if (pathname === "/today") {
      window.dispatchEvent(new CustomEvent("finline:tour", { detail: HOME_TOUR }));
      return;
    }
    router.push(`/today?tour=${HOME_TOUR}`);
  }, [pathname, router]);

  const markSeen = useCallback((which: TourId) => {
    // Fire and forget: nothing on screen waits for it, and a failed write
    // only means the tour offers itself once more next time. The browser's
    // own record covers visitors, who have no profile (the POST answers 401).
    try {
      window.localStorage.setItem(tourStorageKey(which), String(TOURS[which].version));
    } catch {
      /* private mode: the profile record still counts */
    }
    void fetch("/api/tour", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tour: which }),
    }).catch(() => undefined);
  }, []);

  const autoStart = useCallback(
    (which: TourId, seenVersion: number | undefined, goTo?: TourGo | null) => {
      if (busy.current || autoStarted.current.has(which)) return;
      if ((seenVersion ?? 0) >= TOURS[which].version || seenHere(which)) return;
      autoStarted.current.add(which);
      begin(which, goTo ?? null);
    },
    [begin],
  );

  const close = useCallback(() => {
    if (tour) {
      autoStarted.current.add(tour);
      markSeen(tour);
      // The unit tour that already showed the two check buttons covers their own tour.
      if (tour === "unit" && steps?.some((s) => s.id === "check")) {
        autoStarted.current.add("check");
        markSeen("check");
      }
    }
    setSteps(null);
    setIndex(0);
    setTour(null);
    busy.current = false;
  }, [markSeen, tour, steps]);

  // Advancing past the last step ends the tour. Deliberately NOT expressed
  // inside a setIndex updater: an updater has to be a pure function of the
  // previous state, and React is free to call it twice, so closing from in
  // there ran the finish path unpredictably — the overlay stayed on screen
  // after 開始使用 and the seen-flag was never written.
  const advance = useCallback(() => {
    if (!steps) return;
    if (index >= steps.length - 1) {
      // Finishing and skipping are the same outcome; close() records it.
      close();
      return;
    }
    setIndex(index + 1);
  }, [steps, index, close]);

  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  const api = useMemo<TourApi>(
    () => ({ start, autoStart, run, active: steps !== null }),
    [start, autoStart, run, steps],
  );

  return (
    <TourContext.Provider value={api}>
      {children}
      {steps && (
        <TourOverlay
          steps={steps}
          index={Math.min(index, steps.length - 1)}
          variant={variant}
          go={go}
          onNext={advance}
          onBack={back}
          onSkip={close}
          // A target that vanishes mid-tour (a rerender dropped it, the
          // student navigated) should not strand the overlay on nothing.
          onTargetLost={advance}
        />
      )}
    </TourContext.Provider>
  );
}
