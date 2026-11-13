"use client";

import { useRef, useState } from "react";
import s from "./shareCard.module.css";

export interface ShareCardData {
  /** The student's nickname: the only personal detail on the card, and it can be left off. */
  name: string;
  courseName: string;
  code: string;
  color: string;
  date: string;
  /** What the student can now do (the course's own objectives), three at most. */
  can: string[];
  modules: number;
}

const W = 1080;
const H = 1350;
/** The card's colours, read from the page's own tokens when it is drawn. */
interface Inks {
  ink: string;
  soft: string;
  paper: string;
  rule: string;
  onLine: string;
}
const NO_START = "，。、；：？！）」』";

/** Chinese wraps anywhere, except that a line never starts with closing punctuation. */
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const ch of text) {
    if (line && ctx.measureText(line + ch).width > max && !NO_START.includes(ch)) {
      lines.push(line);
      line = ch;
    } else line += ch;
  }
  if (line) lines.push(line);
  // No one- or two-character last line: share the text evenly over the same number of lines.
  if (lines.length > 1 && [...lines[lines.length - 1]].length <= 2) {
    const chars = [...text];
    const per = Math.ceil(chars.length / lines.length);
    const even: string[] = [];
    for (let i = 0; i < chars.length; i += per) even.push(chars.slice(i, i + per).join(""));
    // A line still may not start with closing punctuation: pull it up.
    for (let i = 1; i < even.length; i++) {
      while (even[i] && NO_START.includes(even[i][0])) {
        even[i - 1] += even[i][0];
        even[i] = even[i].slice(1);
      }
    }
    return even.filter(Boolean);
  }
  return lines;
}

async function draw(canvas: HTMLCanvasElement, d: ShareCardData, showName: boolean, family: string, { ink: INK, soft: SOFT, paper, rule, onLine }: Inks) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  const font = (weight: number, px: number) => `${weight} ${px}px ${family}`;
  const all = [d.courseName, d.name, ...d.can, "完成了這門課我現在會學習練習的紀錄不是真實的工作經驗錢途個單元"].join("");
  // The Chinese face loads in slices; ask for the ones this card uses.
  await Promise.all([400, 700, 900].map((w) => document.fonts.load(font(w, 40), all).catch(() => [])));

  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = d.color;
  ctx.fillRect(0, 0, W, 28);
  const x = 96;
  let y = 150;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = INK;
  ctx.font = font(900, 44);
  ctx.fillText("錢途", x, y);
  ctx.fillStyle = SOFT;
  ctx.font = font(400, 30);
  ctx.fillText("Finline", x + 108, y);
  // the course code, as its plate
  ctx.font = font(700, 30);
  const cw = ctx.measureText(d.code).width + 40;
  ctx.fillStyle = d.color;
  ctx.beginPath();
  ctx.roundRect(W - x - cw, y - 40, cw, 54, 12);
  ctx.fill();
  ctx.fillStyle = onLine;
  ctx.fillText(d.code, W - x - cw + 20, y - 2);

  y += 150;
  ctx.fillStyle = SOFT;
  ctx.font = font(400, 38);
  ctx.fillText(showName ? `${d.name} 完成了這門課` : "我完成了這門課", x, y);
  y += 130;
  ctx.fillStyle = INK;
  ctx.font = font(900, 124);
  ctx.fillText(d.courseName, x, y);
  y += 44;
  ctx.fillStyle = d.color;
  ctx.fillRect(x, y, 140, 10);

  y += 120;
  ctx.fillStyle = SOFT;
  ctx.font = font(700, 34);
  ctx.fillText("我現在會", x, y);
  y += 26;
  ctx.fillStyle = INK;
  ctx.font = font(400, 42);
  for (const line of d.can) {
    const rows = wrap(ctx, line, W - x * 2 - 50);
    y += 62;
    ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.arc(x + 10, y - 14, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK;
    rows.forEach((r, i) => ctx.fillText(r, x + 50, y + i * 60));
    y += (rows.length - 1) * 60 + 12;
  }

  ctx.fillStyle = rule;
  ctx.fillRect(x, H - 190, W - x * 2, 2);
  ctx.fillStyle = SOFT;
  ctx.font = font(400, 30);
  ctx.fillText(`${d.date} · ${d.modules} 個單元`, x, H - 124);
  ctx.fillText("學習練習的紀錄，不是真實的工作經驗。", x, H - 76);
}

const toBlob = (c: HTMLCanvasElement) => new Promise<Blob | null>((ok) => c.toBlob(ok, "image/png"));

/**
 * The card for finishing a course (2026-11-13): what the student can now
 * do, in the course's own words, with a nickname at most. No score against
 * anyone else and no rank. It saves as an image, drawn in the browser;
 * nothing is uploaded.
 */
export function ShareCard({ data }: { data: ShareCardData }) {
  const card = useRef<HTMLDivElement>(null);
  const [showName, setShowName] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function image(): Promise<Blob | null> {
    const canvas = document.createElement("canvas");
    if (!card.current) return null;
    const css = getComputedStyle(card.current);
    const token = (name: string) => css.getPropertyValue(name).trim();
    await draw(canvas, data, showName, css.fontFamily, { ink: token("--ink"), soft: token("--ink-2"), paper: token("--surface"), rule: token("--track"), onLine: token("--line-on") || token("--ink-inv") });
    return toBlob(canvas);
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    setNote(null);
    try {
      const blob = await image();
      if (!blob) throw new Error("no image");
      const file = new File([blob], `finline-${data.code}.png`, { type: "image/png" });
      // A phone's share sheet saves to photos or sends it; elsewhere it downloads.
      const touch = window.matchMedia("(pointer: coarse)").matches;
      if (touch && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        setNote("圖片已經存到下載的資料夾。");
      }
    } catch (e) {
      // Closing the share sheet is not a failure.
      if (!(e instanceof DOMException && e.name === "AbortError")) setNote("圖片沒有存成功。你也可以直接截圖這張卡。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={s.wrap}>
      <div ref={card} className={s.card} style={{ "--card-line": data.color } as React.CSSProperties}>
        <div className={s.top}>
          <span className={s.brand}>
            錢途<small>Finline</small>
          </span>
          <span className={s.code}>{data.code}</span>
        </div>
        <p className={s.who}>{showName ? `${data.name} 完成了這門課` : "我完成了這門課"}</p>
        <p className={s.course}>{data.courseName}</p>
        <span className={s.rule} aria-hidden="true" />
        <p className={s.canHead}>我現在會</p>
        <ul className={s.can}>
          {data.can.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <p className={s.foot}>
          {data.date} · {data.modules} 個單元
          <br />
          學習練習的紀錄，不是真實的工作經驗。
        </p>
      </div>
      <div className={s.side}>
        <button type="button" className={s.save} onClick={save} disabled={busy}>
          {busy ? "準備圖片中" : "存成圖片"}
        </button>
        <label className={s.toggle}>
          <input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} />
          <span>卡片上顯示我的暱稱</span>
        </label>
        <p className={s.fine} aria-live="polite">
          {note ?? "卡片上只有暱稱和課程，沒有分數排名。圖片在你的裝置上產生，不會上傳。"}
        </p>
      </div>
    </div>
  );
}
