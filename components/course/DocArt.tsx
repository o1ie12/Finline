"use client";

import { renderMaterial } from "@/components/documents";
import type { Material } from "@/lib/tasks/types";

/**
 * A task's real document drawn as artwork (2026-11-12): the same component a
 * station puts on the desk, shown small and out of reach. Decoration only:
 * hidden from assistive tech and inert, since the live copy is in 試做一題.
 */
export function DocArt({ material, className }: { material: Material; className?: string }) {
  return (
    <div className={className} aria-hidden="true" inert>
      {renderMaterial(material, { headingLevel: 4 })}
    </div>
  );
}
