"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LIFE_SIM } from "@/lib/flags";
import { TOUR_TARGETS } from "@/lib/tour";
import { Icon, type IconName } from "./icons";
import s from "./ui.module.css";

/**
 * 06 E6.1: the tabs navigate, never act; single-word labels. 2026-11-12:
 * a course platform's three (my learning, the catalogue, grades). With the
 * life simulation on (lib/flags.ts) its two tabs come back.
 */
export const TABS: { href: string; label: string; icon: IconName }[] = LIFE_SIM
  ? [
      { href: "/today", label: "今天", icon: "today" },
      { href: "/status", label: "狀態", icon: "me" },
      { href: "/map", label: "路線", icon: "map" },
      { href: "/moves", label: "行動", icon: "bolt" },
    ]
  : [
      { href: "/today", label: "學習", icon: "today" },
      { href: "/map", label: "課程", icon: "map" },
      { href: "/grades", label: "成績", icon: "award" },
    ];

/** The tour's anchors on the tabs it explains (lib/tour.ts, the home tour). */
const TAB_TOUR: Record<string, string | undefined> = { "/map": TOUR_TARGETS.tabCourses, "/grades": TOUR_TARGETS.tabGrades };

/**
 * 06 E7.13, restyled 2026-10-24: a floating Liquid Glass pill on a phone, a
 * glass sidebar with the 錢途 brand on Regular. The active tab is shown by a
 * white ground, ink color, weight 700 and aria-current together. No badges.
 */
export function TabBar() {
  const path = usePathname();
  return (
    <nav className={s.tabbar} aria-label="主要分頁">
      {/* Desktop only: the brand at the top of the sidebar. */}
      <Link href="/today" className={s.tabBrand}>
        <span className={s.tabBrandName}>錢途</span>
        <span className={s.tabBrandEn}>Finline</span>
      </Link>
      {TABS.map((t) => {
        // a course page belongs to the catalogue tab
        const on = path === t.href || path.startsWith(`${t.href}/`) || (t.href === "/map" && path.startsWith("/line/"));
        return (
          <Link key={t.href} href={t.href} className={s.tab} aria-current={on ? "page" : undefined} data-tour-id={TAB_TOUR[t.href]}>
            <Icon name={t.icon} size={24} filled />
            <span>{t.label}</span>
          </Link>
        );
      })}
      {/* 設定 holds the sign-in code. On a phone it used to be reachable only
          from the life simulation's 狀態 tab; with that off it shows here too. */}
      <Link
        href="/settings"
        className={`${s.tab} ${s.tabSettings} ${LIFE_SIM ? "" : s.tabSettingsPhone}`}
        aria-current={path.startsWith("/settings") ? "page" : undefined}
        data-tour-id={TOUR_TARGETS.tabSettings}
      >
        <Icon name="me" size={24} filled />
        <span>設定</span>
      </Link>
    </nav>
  );
}
