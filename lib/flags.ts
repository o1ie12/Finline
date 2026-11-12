/**
 * 06 G4: the one-mode flow (Part G). Inlined at build time from
 * NEXT_PUBLIC_FLOW_V2, which next.config.ts derives (on for preview builds,
 * off for production, an explicit value wins). Read it, never the env var.
 */
export const FLOW_V2 = process.env.NEXT_PUBLIC_FLOW_V2 === "1";

/**
 * The life simulation in the main path (2026-11-12). Off: a finished module
 * goes on to the next module, not to a month of the simulation; the 狀態 and
 * 行動 tabs, the life panel on the home page and the 人生 stop are not shown.
 * The engine, the saves and the /turn, /status and /moves pages stay; only
 * the links to them go. Inlined at build time from NEXT_PUBLIC_LIFE_SIM
 * (next.config.ts, off by default; =1 and a redeploy brings it back).
 */
export const LIFE_SIM = process.env.NEXT_PUBLIC_LIFE_SIM === "1";
