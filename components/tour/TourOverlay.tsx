"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { FADE_MS, RISE_PX } from "@/lib/motion";
import { resolveCopy, type TourGo, type TourStep, type TourVariant } from "@/lib/tour";
import t from "./tour.module.css";

/**
 * The tour's spotlight and popover.
 *
 * Spotlight is four dim panels framing the target rather than one overlay
 * with a cut-out. A box-shadow hole cannot catch clicks outside itself and a
 * clip-path hole needs `evenodd`, which is not dependable; four panels leave
 * a real gap, so the target stays fully visible AND clickable while every
 * click outside it lands on a panel instead of navigating the student away
 * mid-tour. Each panel is a plain div, so moving between steps is four
 * position transitions and nothing to go wrong.
 *
 * The target rect is re-measured every frame while the tour is open instead
 * of on scroll and resize listeners. The popover has to stay attached
 * through anything that moves its target — scrolling, a font finishing
 * loading, an image settling, the sticky header resizing — and enumerating
 * those events is how a popover ends up detached from the thing it is
 * explaining. State only updates when the numbers actually change, so an
 * idle tour re-renders zero times.
 */

const GAP = 12; // between target edge and popover
const MARGIN = 16; // minimum distance from the viewport edge
const WIDE = 330; // popover width where there is room
const NARROW_MAX = 420; // below this, stack vertically and go near-full-width
const PAD = 6; // how far the cut-out sits back from the target
const CENTRED = 360; // a step with no target: a centred card, a little wider
// Above everything in the app shell (the phone tab bar sits at 10, menus at 50).
const LAYER = 1000;

type Placement = "bottom" | "top" | "right" | "left" | "none";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
  /** The target's own corner radius, so the cut-out follows its shape. */
  radius: number;
}

function radiusOf(el: HTMLElement): number {
  const r = parseFloat(getComputedStyle(el).borderTopLeftRadius);
  return Number.isFinite(r) ? r : 12;
}

function sameRect(a: Rect | null, b: Rect | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5 &&
    a.radius === b.radius
  );
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduced;
}

export default function TourOverlay({
  steps,
  index,
  variant,
  go,
  onNext,
  onBack,
  onSkip,
  onTargetLost,
}: {
  steps: TourStep[];
  index: number;
  variant: TourVariant;
  /** Where a `go` step's main button leads. Without it, that step ends the tour like any last step. */
  go: TourGo | null;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onTargetLost: () => void;
}) {
  const reduced = usePrefersReducedMotion();
  /**
   * The step the CARD is showing, which lags the step the SPOTLIGHT is on.
   *
   * The spec's sequence is: the old card fades out, the spotlight moves, the
   * new card fades in. Rendering the live index directly would swap the title
   * and body the instant Next was pressed — while the card is still at full
   * opacity on its way down — so the student reads a flash of the next step's
   * copy in the old step's position. Holding the old copy until the fade has
   * finished is what makes it one movement instead of two.
   */
  const [display, setDisplay] = useState(index);
  const [visible, setVisible] = useState(false);
  const step = steps[Math.min(display, steps.length - 1)];
  const liveTarget = steps[Math.min(index, steps.length - 1)].target;
  const [rect, setRect] = useState<Rect | null>(null);
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    width: number;
    placement: Placement;
    arrow: number;
  } | null>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const rectRef = useRef<Rect | null>(null);

  // Scroll the target into view and measure it, in that order, synchronously
  // before the step's first paint.
  //
  // The order is the point. Scrolling from a passive effect and measuring
  // from a layout effect runs them the wrong way round — the measurement is
  // taken at the target's pre-scroll position, so the spotlight is placed
  // where the element used to be and only the rAF loop below drags it back.
  // On a visible tab that correction lands within a frame and looks like
  // nothing; it is still the spotlight being wrong first and right second.
  //
  // The scroll is instant, not smooth: a smooth scroll runs at the same time
  // as the spotlight's own 480ms move, and the two read as one laggy motion
  // rather than two deliberate ones.
  useLayoutEffect(() => {
    if (liveTarget === null) {
      // A centred card: no spotlight, the whole page dimmed.
      if (rectRef.current !== null) {
        rectRef.current = null;
        setRect(null);
      }
      return;
    }
    const el = document.querySelector<HTMLElement>(
      `[data-tour-id="${liveTarget}"]`,
    );
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "auto" });
    const r = el.getBoundingClientRect();
    const next: Rect = {
      top: r.top,
      left: r.left,
      width: r.width,
      height: r.height,
      radius: radiusOf(el),
    };
    if (!sameRect(rectRef.current, next)) {
      rectRef.current = next;
      setRect(next);
    }
  }, [liveTarget]);

  // Re-measure every frame; commit only on a real change. See the note above.
  useEffect(() => {
    if (liveTarget === null) return;
    let raf = 0;
    const tick = () => {
      const el = document.querySelector<HTMLElement>(
        `[data-tour-id="${liveTarget}"]`,
      );
      if (!el) {
        onTargetLost();
        return;
      }
      const r = el.getBoundingClientRect();
      const next: Rect = {
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
        radius: radiusOf(el),
      };
      if (!sameRect(rectRef.current, next)) {
        rectRef.current = next;
        setRect(next);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [liveTarget, onTargetLost]);

  // Position the popover once its real size is known. Preference order is
  // below, above, right, left — below first because it keeps the popover out
  // of the way of a target the student has just been asked to look at. Under
  // NARROW_MAX the side placements are dropped entirely: at that width a card
  // beside its target leaves neither of them a readable amount of room.
  useLayoutEffect(() => {
    // Positioned against the DISPLAYED step's target, not the live one.
    // `rect` follows the spotlight, which moves the instant Next is pressed;
    // using it here would relocate the card while it is still showing the
    // previous step's words on its way out, so the student sees the old copy
    // jump. Reading the displayed step's own target keeps the card still
    // until its content has actually changed. `rect` stays in the deps so
    // scrolling and resizing still re-attach it.
    if (step.target === null) {
      if (!popRef.current) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = Math.min(vw - MARGIN * 2, CENTRED);
      const { height } = popRef.current.getBoundingClientRect();
      setPos({ top: Math.max(MARGIN, (vh - height) / 2), left: (vw - width) / 2, width, placement: "none", arrow: 0 });
      return;
    }
    const anchor = document.querySelector<HTMLElement>(
      `[data-tour-id="${step.target}"]`,
    );
    if (!anchor || !popRef.current) return;
    const ar = anchor.getBoundingClientRect();
    const rect = {
      top: ar.top,
      left: ar.left,
      width: ar.width,
      height: ar.height,
    };
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const narrow = vw < NARROW_MAX;
    // On a phone the card takes the screen's width (less the margins).
    const width = narrow ? vw - MARGIN * 2 : WIDE;
    const { height } = popRef.current.getBoundingClientRect();

    const clamp = (v: number, lo: number, hi: number) =>
      Math.max(lo, Math.min(v, hi));

    const fitsBelow = rect.top + rect.height + GAP + height <= vh - MARGIN;
    const fitsAbove = rect.top - GAP - height >= MARGIN;
    const fitsRight = !narrow && rect.left + rect.width + GAP + width <= vw - MARGIN;
    const fitsLeft = !narrow && rect.left - GAP - width >= MARGIN;

    const placement: Placement = fitsBelow
      ? "bottom"
      : fitsAbove
        ? "top"
        : fitsRight
          ? "right"
          : fitsLeft
            ? "left"
            : "bottom";

    let top: number;
    let left: number;
    if (placement === "bottom" || placement === "top") {
      top =
        placement === "bottom"
          ? rect.top + rect.height + GAP
          : rect.top - GAP - height;
      left = clamp(
        rect.left + rect.width / 2 - width / 2,
        MARGIN,
        Math.max(MARGIN, vw - width - MARGIN),
      );
    } else {
      left =
        placement === "right"
          ? rect.left + rect.width + GAP
          : rect.left - GAP - width;
      top = clamp(
        rect.top + rect.height / 2 - height / 2,
        MARGIN,
        Math.max(MARGIN, vh - height - MARGIN),
      );
    }
    // Last resort: a target taller than the viewport leaves no room either
    // side, and a popover half off-screen is worse than one overlapping.
    top = clamp(top, MARGIN, Math.max(MARGIN, vh - height - MARGIN));

    // The arrow tracks the target's centre along the popover's edge, so the
    // pairing stays readable even when the card had to be clamped sideways.
    const arrow =
      placement === "bottom" || placement === "top"
        ? clamp(rect.left + rect.width / 2 - left, 16, width - 16)
        : clamp(rect.top + rect.height / 2 - top, 16, height - 16);

    setPos({ top, left, width, placement, arrow });
  }, [rect, display, step.id, step.target]);

  // Fade the card out, let the spotlight travel, then swap the copy in.
  //
  // Timers rather than requestAnimationFrame, even though this drives an
  // animation. rAF does not fire in a hidden or backgrounded tab, and the
  // sequencing it was scheduling is what advances the card's CONTENT — so a
  // tour left in a background tab came back with the spotlight on step four
  // and the card still showing step one's words. The opacity it sets is
  // cosmetic and can afford to be paused; which step the card is on cannot.
  //
  // Every setState still runs inside a callback rather than the effect body,
  // so this remains animation sequencing rather than the render-cascade that
  // react-hooks/set-state-in-effect exists to catch.
  useEffect(() => {
    if (display === index) return;
    let swap = 0;
    const out = window.setTimeout(() => {
      setVisible(false);
      swap = window.setTimeout(
        () => setDisplay(index),
        reduced ? 0 : FADE_MS,
      );
    }, 0);
    return () => {
      clearTimeout(out);
      clearTimeout(swap);
    };
  }, [index, display, reduced]);

  // …and in, once the new copy is mounted and a position has been computed.
  useEffect(() => {
    const id = window.setTimeout(() => setVisible(true), 0);
    return () => clearTimeout(id);
  }, [display]);

  const isFirst = index === 0;
  const isLast = index === steps.length - 1;
  // The closing step's main button can take the student straight to where to start.
  const goNow = isLast && step.go && go ? go : null;

  /**
   * Escape closes; Tab stays inside the card.
   *
   * Without the trap a single Tab moved focus into the page behind the
   * spotlight — dimmed, non-interactive to the eye, and still focusable —
   * and the tour's own 上一步／下一步／跳過 were never reachable at all. A
   * tour that explains the interface while being unusable from the keyboard
   * is worse than no tour for the students who need it most.
   */
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onSkip();
        return;
      }
      if (e.key !== "Tab") return;
      const card = popRef.current;
      if (!card) return;
      const focusables = Array.from(
        card.querySelectorAll<HTMLElement>(
          "button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex='-1'])",
        ),
      ).filter((el) => el.getBoundingClientRect().width > 0);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      // Focus starts on the card itself, which is tabIndex -1 and so is not
      // in the list; from there Tab would leave the portal entirely.
      if (!active || !card.contains(active) || active === card) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onSkip],
  );

  // Give focus back to whatever opened the tour. Closing it left focus on a
  // card that no longer exists, which drops the caret to the top of the
  // document — a keyboard user who pressed the help control then had to tab
  // all the way back to where they were.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    return () => {
      if (opener && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  // Move focus to the card on every step so a keyboard user is reading the
  // step they are on, and Escape has somewhere to fire from.
  useEffect(() => {
    popRef.current?.focus({ preventScroll: true });
  }, [display]);

  if (typeof document === "undefined") return null;

  const hole = rect
    ? {
        top: rect.top - PAD,
        left: rect.left - PAD,
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
        radius: Math.min(rect.radius + PAD, 28),
      }
    : null;
  const layer = (z: number, more: React.CSSProperties): React.CSSProperties => ({ zIndex: z, ...(reduced ? { transition: "none" } : {}), ...more });

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
      aria-describedby="tour-body"
    >
      {/* The dim with a rounded cut-out: one shadow, no outline. It takes no
          clicks; the four clear panels around the cut-out do, so a tap on
          the dimmed page closes the tour (05 A8.6) while the target itself
          stays visible and clickable. A centred step dims the whole page. */}
      {hole ? (
        <>
          <div aria-hidden="true" className={t.spot} style={layer(LAYER, { top: hole.top, left: hole.left, width: hole.width, height: hole.height, borderRadius: hole.radius })} />
          <div className={t.catch} onClick={onSkip} style={layer(LAYER, { top: 0, left: 0, right: 0, height: Math.max(0, hole.top) })} />
          <div className={t.catch} onClick={onSkip} style={layer(LAYER, { top: hole.top + hole.height, left: 0, right: 0, bottom: 0 })} />
          <div className={t.catch} onClick={onSkip} style={layer(LAYER, { top: hole.top, left: 0, width: Math.max(0, hole.left), height: hole.height })} />
          <div className={t.catch} onClick={onSkip} style={layer(LAYER, { top: hole.top, left: hole.left + hole.width, right: 0, height: hole.height })} />
        </>
      ) : step.target === null ? (
        <div className={t.catch} onClick={onSkip} style={layer(LAYER, { inset: 0, background: "rgba(20, 23, 26, 0.42)" })} />
      ) : null}

      <div
        ref={popRef}
        tabIndex={-1}
        className={t.card}
        style={{
          top: pos?.top ?? 0,
          left: pos?.left ?? 0,
          width: pos?.width ?? WIDE,
          zIndex: LAYER + 1,
          opacity: pos && visible ? 1 : 0,
          transform: reduced || (pos && visible) ? "none" : `translateY(${RISE_PX}px)`,
          // Opacity and lift only: the card is invisible whenever it moves between steps.
          ...(reduced ? {} : { transition: `opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms ease` }),
        }}
      >
        <p id="tour-title" className={t.title}>
          {resolveCopy(step.title, variant)}
        </p>
        <p id="tour-body" className={t.body}>
          {resolveCopy(step.body, variant)}
        </p>
        <span className="sr-only" aria-live="polite">
          第 {index + 1} 步，共 {steps.length} 步
        </span>

        {goNow ? (
          <div className={t.go}>
            {/* Closing the tour records it as seen; the link then goes on. */}
            <Link href={goNow.href} onClick={onNext} className={t.pill}>
              {goNow.label}
            </Link>
            <button type="button" onClick={onSkip} className={t.text}>
              自己逛逛
            </button>
          </div>
        ) : (
          <div className={t.foot}>
            {/* A count, not a row of dots: ten dots beside three buttons pushed
                下一步 past the card's edge with some system fonts. */}
            <span className={t.count} aria-hidden="true">
              {steps.length > 1 ? `${index + 1} / ${steps.length}` : null}
            </span>
            <button type="button" onClick={onSkip} className={t.text}>
              跳過
            </button>
            {!isFirst && (
              <button type="button" onClick={onBack} className={t.text}>
                上一步
              </button>
            )}
            <button type="button" onClick={onNext} className={t.pill}>
              {isLast ? (variant === "simulate" || steps.some((s) => s.id === "character") ? "開始使用" : "知道了") : isFirst && step.target === null ? "開始" : "下一步"}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
