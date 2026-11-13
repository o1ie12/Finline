import type { Metadata } from "next";
import Link from "next/link";
import s from "./notFound.module.css";

// 11 COPY-4: its own title, not the site's.
export const metadata: Metadata = { title: "找不到這一頁", robots: { index: false } };

/** The 404 page (G9 item 18): Chinese, in the new look, with a way back. */
export default function NotFound() {
  return (
    <main className={s.page}>
      <span className={s.stripe} aria-hidden="true" />
      <div className={s.card}>
        <p className={s.code}>404 · 找不到這一頁</p>
        <h1 className={s.title}>找不到這一頁</h1>
        <p className={s.text}>網址可能打錯了，或這一頁已經搬家。從下面回到你的課程。</p>
        <div className={s.actions}>
          <Link href="/today" className={s.primary}>回到我的學習</Link>
          <Link href="/lines" className={s.secondary}>看課程目錄</Link>
        </div>
      </div>
    </main>
  );
}
