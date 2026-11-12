import s from "./trainLoader.module.css";

/**
 * The loading screen (2026-11-12): a small metro car crossing on its track,
 * the same car the station ride uses (components/transition/MetroRide.tsx),
 * drawn in CSS. Shown by the route groups' loading.tsx while a page's data
 * loads. Under reduced motion the car stands still.
 */
export function TrainLoader({ label = "載入中" }: { label?: string }) {
  return (
    <div className={s.wrap} role="status" aria-live="polite">
      <div className={s.lane} aria-hidden="true">
        <div className={s.car}>
          <span className={s.windows}>
            <i />
            <i />
            <i />
            <b />
          </span>
          <span className={s.stripe} />
          <span className={s.skirt} />
        </div>
        <span className={s.track} />
      </div>
      <p className={s.label}>{label}</p>
    </div>
  );
}
