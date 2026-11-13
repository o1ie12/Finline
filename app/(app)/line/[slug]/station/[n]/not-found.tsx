"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import s from "@/app/notFound.module.css";

/**
 * 11 COPY-4: a station number this line does not have. Station URLs use the
 * global station number (/line/zhiya/station/39), so /station/1 on most
 * lines lands here, with a way back to the line.
 */
export default function StationNotFound() {
  const slug = usePathname().split("/")[2] ?? "";
  return (
    <main className={s.page}>
      <div className={s.card}>
        <p className={s.code}>404</p>
        <h1 className={s.title}>這門課沒有這個單元</h1>
        <p className={s.text}>單元的網址用的是全站的編號。回到課程頁，從那裡選一個單元。</p>
        <div className={s.actions}>
          <Link href={`/line/${slug}`} className={s.primary}>
            回到課程
          </Link>
          <Link href="/lines" className={s.secondary}>
            看課程目錄
          </Link>
        </div>
      </div>
    </main>
  );
}
