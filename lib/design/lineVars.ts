import type { CSSProperties } from "react";
import type { LineMeta } from "@/lib/lines";

/** Relative luminance of a #rrggbb color (WCAG 2.x). */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const INK = "#15202b"; // --ink (light), app/tokens.css

/**
 * The per-line custom properties a wrapper sets (06 E2.1): --line, the
 * light-mode chip text --line-ink-light (the line's lineInk override, else
 * colorInk; tokens.css turns it into --line-ink), and --line-on,
 * text drawn on the line color itself (white, or ink for the two light lines
 * where white fails, E2.5c). --line-soft is derived in CSS.
 */
export function lineVars(line: Pick<LineMeta, "color" | "colorInk" | "lineInk">): CSSProperties {
  const on = ratio("#ffffff", line.color) >= ratio(INK, line.color) ? "#ffffff" : INK;
  // --line-ink-light, not --line-ink: the light-mode ink must not override
  // the dark mix (tokens.css re-derives --line-ink and --line-soft on any
  // element that sets --line, so they follow this line, not :root's).
  return {
    "--line": line.color,
    "--line-ink-light": line.lineInk ?? line.colorInk,
    "--line-on": on,
  } as CSSProperties;
}

const SIGNAL = "#f8b61c"; // --signal, app/tokens.css

/**
 * The action button's ground on a block in the line's color (2026-11-12):
 * the platform yellow, or white where the line's own color is too close to
 * it to read as a button (信用線, 創業線).
 */
export function goVars(line: Pick<LineMeta, "color">): CSSProperties {
  return { "--go-bg": ratio(SIGNAL, line.color) < 1.6 ? "var(--surface)" : "var(--signal)" } as CSSProperties;
}
