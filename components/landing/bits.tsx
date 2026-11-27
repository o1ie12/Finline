import s from "./landing.module.css";

/**
 * A section's station tag (FL01 …) beside its heading. One dark plate for
 * every section: the line colours belong to courses, so a section that is
 * not a course does not borrow one.
 */
export function SectionTag({ code, children }: { code: string; children: React.ReactNode }) {
  return (
    <div className={s.tagRow}>
      <span className={s.tag} style={{ background: "var(--ink)", color: "var(--ink-inv)" }}>
        {code}
      </span>
      {children}
    </div>
  );
}

export function Arrow() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
