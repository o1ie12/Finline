"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Where a module played without an account waits until there is one. */
export const GUEST_PENDING = "finline:guest:pending";

/**
 * After sign-up (2026-11-13): a module the visitor played before they had an
 * account is sent once, now that they do, and recorded like any other. Put
 * only on pages that have a signed-in student: without a session the same
 * request is scored and dropped, and the saved answers would be lost.
 */
export function GuestSync() {
  const router = useRouter();
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(GUEST_PENDING);
    } catch {
      return;
    }
    if (!raw) return;
    const body = raw;
    void (async () => {
      try {
        const res = await fetch("/api/task", { method: "POST", headers: { "content-type": "application/json" }, body });
        // Kept for the next visit only when the server could not be reached.
        if (res.status >= 500) return;
        window.localStorage.removeItem(GUEST_PENDING);
        if (res.ok) router.refresh();
      } catch {
        /* offline: try again next time */
      }
    })();
  }, [router]);
  return null;
}
