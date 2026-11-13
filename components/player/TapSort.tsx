"use client";

import type { SortDraft } from "@/components/tasks/answers";
import type { SortStep } from "@/lib/tasks/types";
import p from "./player.module.css";

/**
 * Sorting by tapping (2026-11-13): one card at a time, the boxes as buttons.
 * No dragging and no dropdowns: a touch screen and a keyboard do the same
 * thing (WCAG 2.5.7). A placed card is a chip; tapping it takes it back.
 */
export function TapSort({ step, value, onChange, disabled }: { step: SortStep; value: SortDraft; onChange(next: SortDraft): void; disabled?: boolean }) {
  const placed = step.items.filter((it) => value.placements[it.id]);
  const left = step.items.filter((it) => !value.placements[it.id]);
  const current = left[0] ?? null;
  const boxName = (id: string) => step.boxes.find((b) => b.id === id)?.label ?? "";

  const place = (boxId: string) => {
    if (!current) return;
    onChange({ placements: { ...value.placements, [current.id]: boxId } });
  };
  const takeBack = (itemId: string) => {
    const { [itemId]: _gone, ...rest } = value.placements;
    void _gone;
    onChange({ placements: rest });
  };

  return (
    <div className={p.sort}>
      {current ? (
        <>
          <div className={p.sortCard} aria-live="polite">
            <span className={p.sortCount}>
              第 {placed.length + 1} 張，共 {step.items.length} 張
            </span>
            <span className={p.sortLabel}>{current.label}</span>
          </div>
          <div className={p.sortBoxes} role="group" aria-label={`把「${current.label}」放進哪一格`} data-many={step.boxes.length > 4 || undefined}>
            {step.boxes.map((b) => (
              <button key={b.id} type="button" className={p.sortBox} disabled={disabled} onClick={() => place(b.id)}>
                {b.label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className={p.sortDone} aria-live="polite">
          {step.items.length} 張都放好了。要改的話，點下面的卡片。
        </p>
      )}
      {placed.length ? (
        <div className={p.sortPlaced}>
          <p className={p.small}>已經放好的（點一下可以重放）</p>
          <ul>
            {placed.map((it) => (
              <li key={it.id}>
                <button type="button" disabled={disabled} onClick={() => takeBack(it.id)} aria-label={`把「${it.label}」拿回來重放，現在在「${boxName(value.placements[it.id])}」`}>
                  <span>{it.label}</span>
                  <b>{boxName(value.placements[it.id])}</b>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
