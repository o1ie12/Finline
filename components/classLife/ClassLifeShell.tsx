import type { ReactNode } from "react";
import Link from "next/link";
import { StationScene } from "@/components/game/StationScene";
import { CLASS_COPY } from "@/lib/classRooms";
import s from "./classLife.module.css";

/**
 * The game look (station behind floating cards) for the class pages, which
 * live in the public site layout. The page imports app/(game)/game.css; every
 * rule there is scoped under .game-shell, so nothing else on the page changes.
 */
export function ClassLifeShell({ children }: { children: ReactNode }) {
  return (
    <div className="game-shell">
      <StationScene />
      <div className={s.frame}>
        {children}
        {/* spec 12 TCH-5.6: every class page links back to the guide. */}
        <p className={s.guide}>
          <Link href="/teachers">{CLASS_COPY.guide}</Link>
        </p>
      </div>
    </div>
  );
}
