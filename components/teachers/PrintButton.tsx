"use client";

/** 列印教案 (spec 12 TCH-3): the browser's own print dialog; the print stylesheet does the rest. */
export function PrintButton({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <button type="button" className={className} onClick={() => window.print()}>
      {children}
    </button>
  );
}
