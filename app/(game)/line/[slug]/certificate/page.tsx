import { TERMINAL_DISPLAY } from "@/lib/tasks/terminal";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader, Panel, pageStyles as ps } from "@/components/page/Page";
import { buildLineStations } from "@/lib/buildStations";
import { lineVars as lineStyle } from "@/lib/design/lineVars";
import cs from "./certificate.module.css";
import { getLine } from "@/lib/lines";
import {
  lineStatus,
  moduleDoneSet,
  moduleScore,
  allLineStatuses,
} from "@/lib/progressModel";
import { effectiveMode, requiredStations, homeFor } from "@/lib/modeModel";
import { getCurrentStudent } from "@/lib/session";
import {
  getProgress,
  getLineCompletions,
  getLatestSimulationRunForLine,
  getLatestSimulationRunsByLine,
} from "@/lib/db";
import { formatNT } from "@/components/Money";
import { readStoredResult, UNREADABLE_RESULT_TEXT } from "@/lib/sims/types";
import { Icon } from "@/components/game/icons";
import { ShareCard } from "@/components/course/ShareCard";
import { courseOutline } from "@/lib/curriculum";
import type { Student, ModuleProgress, SimulationRun } from "@/lib/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const line = getLine(slug);
  return {
    title: line ? `${line.name} 完成紀錄` : "完成紀錄",
    robots: { index: false, follow: false },
  };
}

/** One-line key result for the line's simulation, from the stored outcome.
 *
 * Branches on the run's `kind`, so the shape is known before any field is
 * read. A run whose kind this build does not recognise — including rows
 * written before the contract existed — returns a neutral line rather than a
 * figure. This certificate previously printed "租屋決策模擬 — 每月結餘 NT$0"
 * for every credit-card run, on a page that invites students to screenshot
 * and share it. */
function simResult(run: SimulationRun): { label: string; value: string } {
  const result = readStoredResult(run.kind, run.outcome_summary);
  if (!result) return { label: "模擬", value: UNREADABLE_RESULT_TEXT };

  switch (result.kind) {
    case "zhiya_career_choice_v1": {
      const { pathName, startingIncome } = result.outcome;
      return {
        label: "職涯抉擇模擬",
        value: `${pathName} · 起薪約 ${formatNT(startingIncome)}`,
      };
    }
    case "qixin_salary_v1": {
      const { deficit, leftover, annualSavings } = result.outcome;
      return {
        label: "第一份薪水模擬",
        value: deficit
          ? `每月短缺 ${formatNT(Math.abs(leftover))}`
          : `一年可存 ${formatNT(annualSavings)}`,
      };
    }
    case "xiaofei_needs_wants_v1": {
      const { savings, absorbedShortfall } = result.outcome;
      return {
        label: "消費模擬",
        value: absorbedShortfall
          ? `留下 ${formatNT(savings)}，撐得過意外支出`
          : "月底沒有餘裕應付意外支出",
      };
    }
    case "cunqian_savings_v1":
    case "cunqian_savings_v2": {
      const { reachedGoal, finalAmount } = result.outcome.user;
      return {
        label: "存錢目標模擬",
        value: `${reachedGoal ? "達標，存到" : "存到"} ${formatNT(finalAmount)}`,
      };
    }
    case "xinyong_housing_v1":
      return {
        label: "租屋決策模擬",
        value: `每月結餘 ${formatNT(result.outcome.chosen.leftover)}`,
      };
    case "xinyong_credit_card_v1":
    case "xinyong_credit_card_v2": {
      const { totalInterest } = result.outcome;
      if (result.kind === "xinyong_credit_card_v2" && result.outcome.missedCount > 0)
        return {
          label: "信用卡帳單模擬",
          value: `遲繳 ${result.outcome.missedCount} 期 · 違約金 ${formatNT(result.outcome.totalLateFees)} · 利息 ${formatNT(totalInterest)}`,
        };
      return {
        label: "信用卡帳單模擬",
        value:
          totalInterest > 0
            ? `三期共付循環利息 ${formatNT(totalInterest)}`
            : "三期全額繳清，零利息",
      };
    }
    case "touzi_investing_v2":
    case "touzi_investing_v3": {
      const { id, low, high } = result.outcome.chosen;
      // Timing is only a decision for a security; 定存 has none to print.
      const how =
        result.outcome.historical === null
          ? ""
          : `${result.outcome.timing === "dca" ? "定期定額" : "一次投入"} · `;
      if (id === "spend") return { label: "第一次投資模擬", value: "選擇把錢花掉" };
      return {
        label: "第一次投資模擬",
        value: `${how}一年可能落在 ${formatNT(low)}–${formatNT(high)}${
          result.outcome.startFromSavingsLine ? "" : "（起始金額為預設值）"
        }`,
      };
    }
    case "touzi_investing_v1": {
      const { id, low, high } = result.outcome.chosen;
      if (id === "spend") return { label: "第一次投資模擬", value: "選擇把錢花掉" };
      return {
        label: "第一次投資模擬",
        value: `一年可能落在 ${formatNT(low)}–${formatNT(high)}${
          result.outcome.startFromSavingsLine === true ? "" : "（起始金額為預設值）"
        }`,
      };
    }
    // The applied lines have no headline figure on the certificate today.
    case "zhapian_fraud_v1":
    case "zhapian_fraud_v2":
    case "xuedai_student_loan_v1":
    case "xuedai_student_loan_v2":
    case "baoshui_tax_v1":
    case "zuwu_lease_v1":
    case "baoxian_sales_pitch_v1":
    case "baoxian_sales_pitch_v2":
    case "chuangye_bubble_tea_v1":
    case "chuangye_bubble_tea_v2":
      return { label: "模擬", value: "已完成" };
    case "touzi_twse_reflection_v1": {
      const { hasInvested, plannedAmount } = result.outcome;
      return {
        label: "投資工具實作",
        value: hasInvested ? `規劃投入 ${formatNT(plannedAmount)}` : "先觀察，暫不投入",
      };
    }
    case "baoshui_tax_filing_v1": {
      const { stepsCorrect, isRefund, balance } = result.outcome;
      return {
        label: "報稅實作模擬",
        value: `三關答對 ${stepsCorrect} 關 · ${isRefund ? "退稅" : "補稅"} ${formatNT(Math.abs(balance))}`,
      };
    }
    case "capstone_buy_vs_rent_v1":
    case "capstone_buy_vs_rent_v2": {
      const { choice, verdict } = result.outcome;
      const what = choice === "buy" ? "買房" : "租屋";
      const how =
        verdict === "comfortable"
          ? "負擔得起"
          : verdict === "stretched"
            ? "勉強撐得住"
            : "目前還不可行";
      const { incomeKnown, savingsKnown, creditKnown } = result.outcome;
      const partly =
        incomeKnown !== true || savingsKnown !== true || creditKnown !== true
          ? "（部分數字為預設值）"
          : "";
      return { label: "買房 vs 租屋抉擇模擬", value: `${what} · ${how}${partly}` };
    }
    case "xinyong_protect_card_v1":
    case "qixin_need_want_v1":
    case "cunqian_savings_rate_v1":
    case "touzi_crash_v1":
    case "touzi_etfcode_v1":
    case "baoxian_fourrisks_v1":
    case "zhapian_case1_v1":
    case "zhapian_case2_v1":
    case "zhapian_case3_v1":
    case "zhapian_case4_v1":
    case "zhapian_case5_v1":
    case "zhapian_case6_v1": {
      const { score, total } = result.outcome;
      const pct = total === 0 ? 100 : Math.round((score / total) * 100);
      return { label: TERMINAL_DISPLAY[result.kind].label, value: `任務得分 ${pct} 分` };
    }
  }
}

export default async function CertificatePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const line = getLine(slug);
  if (!line) notFound();

  let student: Student | null = null;
  let progress: ModuleProgress[] = [];
  let run: SimulationRun | null = null;
  let completed = new Set<string>();
  try {
    student = await getCurrentStudent();
    if (student) {
      [progress, run, completed] = await Promise.all([
        getProgress(student.id),
        getLatestSimulationRunForLine(student.id, line.slug),
        getLineCompletions(student.id),
      ]);
    }
  } catch {
    /* not configured */
  }

  if (!student) redirect("/signup");

  const mode = effectiveMode(student?.mode ?? null);
  const status = lineStatus(line, moduleDoneSet(progress), run, mode, completed.has(line.slug));
  if (!status.complete || !run) {
    // 2026-11-02: not earned yet, so the page says exactly what is left.
    const rows = buildLineStations(line, progress, run, mode).filter((r) => r.required !== false);
    const doneCount = rows.filter((r) => r.status === "done").length;
    return (
      <div style={lineStyle(line) as CSSProperties}>
        <PageHeader
          kicker={`${line.name} · 完成紀錄`}
          title={`還差 ${rows.length - doneCount} 個單元就有完成紀錄`}
          intro={`完成${line.name}的每個單元（含期末），就會有一份完成紀錄，可以存成圖片。這是學習練習，不是真實的工作經驗。`}
          actions={
            <Link href={`/line/${line.slug}`} className={ps.primary}>
              回到{line.name}
            </Link>
          }
        />
        <Panel label={`進度 ${doneCount} / ${rows.length} 個單元`}>
          <ol className={cs.rows}>
            {rows.map((r) => (
              <li key={r.key} data-done={r.status === "done" ? "" : undefined}>
                <span className={cs.mark} aria-hidden="true">
                  {r.status === "done" ? <Icon name="check" size={14} /> : null}
                </span>
                <span className={cs.name}>{r.terminal ? `期末 · ${r.label}` : r.label}</span>
                <span className={cs.state}>{r.status === "done" ? "已完成" : r.status === "current" ? "下一個" : "還沒開始"}</span>
                {r.href && r.status !== "done" ? (
                  <Link href={r.href.replace(/^\/line\/([^/]+)\/course\//, "/line/$1/station/")} className={cs.go}>
                    開始
                  </Link>
                ) : null}
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    );
  }

  // The stations this certificate can honestly vouch for. Completion is
  // mode-aware — a sim_first student completes a line on its core stations —
  // so listing every station put ticks next to ones they never opened, on a
  // page that tells them to screenshot and share it.
  const mods = requiredStations(line, mode);
  const result = simResult(run);
  const dateStr = new Date(run.created_at).toLocaleDateString("zh-TW");

  // Transfer suggestion: the first other line the student hasn't finished yet.
  let nextLineName: string | null = null;
  let nextLineHref = "/map";
  try {
    const [allProgress, runsByLine] = await Promise.all([
      getProgress(student.id),
      getLatestSimulationRunsByLine(student.id),
    ]);
    const statuses = allLineStatuses(allProgress, runsByLine, mode, completed);
    const next = statuses.find((s) => s.line.slug !== line.slug && !s.complete);
    if (next) {
      nextLineName = next.line.name;
      nextLineHref = `/line/${next.line.slug}`;
    }
  } catch {
    /* not configured — the plain /lines link above still works */
  }

  // 2026-11-13: the finished course as one card the student can save, then
  // the record behind it. The card says what they can now do, in the
  // course's own objectives; no score against anyone else.
  const outline = courseOutline(line.slug);
  return (
    <div style={lineStyle(line) as CSSProperties}>
      <PageHeader
        kicker={`${outline.info.code} ${line.name} · 完成紀錄`}
        title="你完成了這門課"
        intro="這張卡可以存成圖片。下面是每個單元的紀錄。"
        actions={
          <>
            <Link href={nextLineHref} className={ps.primary}>
              {nextLineName ? `下一門課：${nextLineName}` : "看課程目錄"}
            </Link>
            <Link href={homeFor(student?.mode ?? null)} className={ps.secondary}>
              回到我的學習
            </Link>
          </>
        }
      />
      <Panel>
        <ShareCard data={{ name: student.name, courseName: line.name, code: outline.info.code, color: line.color, date: dateStr, can: outline.info.objectives.slice(0, 3), modules: outline.totals.modules }} />
      </Panel>
      <Panel label="每個單元的紀錄">
        <ol className={cs.rows}>
          {mods.map((m, i) => {
            const p = moduleScore(progress, m.number);
            return (
              <li key={m.number} data-done={p ? "" : undefined}>
                <span className={cs.mark} aria-hidden="true">
                  {p ? <Icon name="check" size={14} /> : null}
                </span>
                <span className={cs.name}>
                  單元 {i + 1}　{outline.modules.find((x) => x.station === m.station)?.title ?? m.station}
                </span>
                <span className={cs.state}>{p ? (p.quiz_total === 100 ? `${p.quiz_score}%` : `${p.quiz_score} / ${p.quiz_total}`) : "未作答"}</span>
              </li>
            );
          })}
          <li data-done="">
            <span className={cs.mark} aria-hidden="true">
              <Icon name="check" size={14} />
            </span>
            <span className={cs.name}>期末　{result.label}</span>
            <span className={cs.state}>{result.value}</span>
          </li>
        </ol>
        {/* 06 F3.5: the record never reads as work experience. */}
        <p className={cs.fine}>完成日期 {dateStr}。這是學習練習，不是真實的工作經驗。</p>
      </Panel>
    </div>
  );
}
