/**
 * The onboarding tour's content and identity.
 *
 * Steps anchor to elements by a stable attribute, never by coordinates: the
 * engine looks up `[data-tour-id="…"]` at runtime, so a visual redesign only
 * has to carry the same ids onto its new components and none of this changes.
 * That is the whole reason the targets are named constants — a typo between
 * the step list and the JSX would silently become a skipped step, and
 * TOUR_TARGETS makes both sides refer to the same string.
 *
 * Three tours (2026-11-23):
 *   home  the 學習 home after a student first signs in: where to start, what
 *         each card and tab is for. The one most students see.
 *   unit  the first time a student reaches a question: the document, the
 *         question bar, the hint, and the two check buttons when the
 *         question has them. Guests see it too.
 *   check the two check buttons on their own, the first time they appear,
 *         for a student whose first unit had none (職涯線 單元 1 is unscored).
 *   life  the older game home (character, today's stop, the map), shown only
 *         with the life simulation switched on (NEXT_PUBLIC_LIFE_SIM).
 *
 * A step whose target is missing or hidden on this screen is dropped when
 * the tour starts. A step with no target is a centred card (a welcome or a
 * closing line).
 */

/**
 * Bumping this shows the tour again to students who have already seen it.
 * Compared against `tutorialSeenVersion` in the student profile, so changing
 * the tour's content never needs a migration — the stored number simply
 * falls behind the code's.
 */
export const CURRENT_TUTORIAL_VERSION = 2; // 2: the game home (character, today's stop, map)

/** Which destination is on screen. Mirrors RouteNetworkView's variant. */
export type TourVariant = "learn" | "simulate";

/** A string, or one per variant when the two genuinely differ. */
export type TourCopy = string | Record<TourVariant, string>;

export function resolveCopy(copy: TourCopy, variant: TourVariant): string {
  return typeof copy === "string" ? copy : copy[variant];
}

/**
 * The `data-tour-id` values, referenced by both the step list and the JSX
 * that carries the attribute.
 */
export const TOUR_TARGETS = {
  character: "character",
  modeToggle: "mode-toggle",
  routeMap: "route-map",
  nextCard: "next-card",
  stats: "stats",
  help: "help",
  // the 學習 home (components/course/LearnHome.tsx) and the tabs (components/ui/TabBar.tsx)
  homeStart: "home-start",
  homeProgram: "home-program",
  homeWeek: "home-week",
  homeReview: "home-review",
  tabCourses: "tab-courses",
  tabGrades: "tab-grades",
  tabSettings: "tab-settings",
  tabHelp: "tab-help",
  // a unit (components/player/ModulePlayer.tsx)
  unitDoc: "unit-doc",
  unitProgress: "unit-progress",
  unitHint: "unit-hint",
  unitCheck: "unit-check",
} as const;

export interface TourStep {
  id: string;
  /** The `data-tour-id` of the element this step points at; null for a centred card. */
  target: string | null;
  title: TourCopy;
  body: TourCopy;
  /** The last step's main button goes to the page the tour was given (`go`), e.g. the first unit. */
  go?: boolean;
}

export type TourId = "home" | "unit" | "check" | "life";

/** Where the closing step's button leads, and what it says. Given by the page that starts the tour. */
export interface TourGo {
  href: string;
  label: string;
}

/**
 * The game home's three-step highlight (01 §6.3): your character, today's
 * stop, the map. Only with the life simulation on.
 */
export const LIFE_TOUR_STEPS: TourStep[] = [
  {
    id: "character",
    target: TOUR_TARGETS.character,
    title: "這是你的角色",
    body: "角色的心情會跟著你的財務狀況變：有預備金就安心，卡債變多就緊張。和買了什麼無關。",
  },
  {
    id: "next",
    target: TOUR_TARGETS.nextCard,
    title: "今日一站",
    body: "每天一站，十幾分鐘。看懂、做一個任務，再回到你的人生遊戲過一個月。",
  },
  {
    id: "map",
    target: TOUR_TARGETS.routeMap,
    title: "路線圖",
    body: "十二條線就是你的世界。點一條線看它下一站在哪、會解鎖什麼。設定選單裡可以重看這段說明。",
  },
];

/**
 * The 學習 home, after a student first signs in (2026-11-23). It answers the
 * two questions a new student has: where do I start, and what is all this.
 */
export const HOME_TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    target: null,
    title: "歡迎來到錢途",
    body: "花半分鐘看一下：從哪裡開始，每個按鈕是做什麼的。之後在「設定」可以再看一次。",
  },
  {
    id: "start",
    target: TOUR_TARGETS.homeStart,
    title: "從這裡開始",
    body: "這張卡永遠是你下一個該上的課。第一次來，就從它的單元 1 開始。一個單元幾分鐘到十幾分鐘，做完會帶你到下一個。",
  },
  {
    id: "program",
    target: TOUR_TARGETS.homeProgram,
    title: "學程進度",
    body: "全部 12 門課。核心課程照順序上，選修遇到了再上。每完成一門，就填滿一格。",
  },
  {
    id: "week",
    target: TOUR_TARGETS.homeWeek,
    title: "本週目標",
    body: "自己決定每週做幾個單元，點「改目標」就能改。沒做到也不會扣分，下週重新開始。",
  },
  {
    id: "review",
    target: TOUR_TARGETS.homeReview,
    title: "錯題夾",
    body: "答錯的題目會自動放進來，兩天後再考你一次。隔幾天再想一次，會記得比較久。",
  },
  {
    id: "courses",
    target: TOUR_TARGETS.tabCourses,
    title: "課程",
    body: "所有課程都在這裡。可以照「第一份打工」「搬出去住」這些人生階段挑。",
  },
  {
    id: "grades",
    target: TOUR_TARGETS.tabGrades,
    title: "成績",
    body: "每個單元的最高分和程度。單元可以重做，只記最高的一次。",
  },
  {
    id: "settings",
    target: TOUR_TARGETS.tabSettings,
    title: "設定",
    body: "你的 6 碼登入代碼在這裡，換手機或電腦時要用。這段說明也可以從這裡重看。",
  },
  {
    // The side panel only (it is not on a phone, so this step drops there).
    id: "help",
    target: TOUR_TARGETS.tabHelp,
    title: "想再看一次？",
    body: "隨時按側邊的「使用說明」，這段說明會從頭再來一次。",
  },
  {
    id: "go",
    target: null,
    title: "準備好了",
    body: "從下一個單元開始吧。進去之後，會再告訴你作答的按鈕怎麼用。",
    go: true,
  },
];

/**
 * A unit, the first time a student reaches a question (2026-11-23). Starts
 * on the first question, not the 想一想 screen, because that is where the
 * document, the hint and the two check buttons first appear.
 */
const CHECK_STEP: TourStep = {
  id: "check",
  target: TOUR_TARGETS.unitCheck,
  title: "我有把握，還是我是猜的？",
  body: "選好答案，按其中一個就會馬上對答案。老實選：有把握卻答錯的題，之後會最先拿出來複習。",
};

export const UNIT_TOUR_STEPS: TourStep[] = [
  {
    id: "doc",
    target: TOUR_TARGETS.unitDoc,
    title: "文件在這裡",
    body: "題目要用到的薪資單、帳單或契約都在這裡。答案在文件裡找得到。",
  },
  {
    id: "progress",
    target: TOUR_TARGETS.unitProgress,
    title: "一題一頁",
    body: "這條是這個單元的題目。答完一題，才會出現下一題。左上角的叉叉可以先離開，做過的會保留。",
  },
  {
    id: "hint",
    target: TOUR_TARGETS.unitHint,
    title: "卡住了就看提示",
    body: "提示會給你一個方向，不影響分數。",
  },
  CHECK_STEP,
];

/** The two check buttons alone, for when they first appear after the unit tour ran without them. */
export const CHECK_TOUR_STEPS: TourStep[] = [CHECK_STEP];

/**
 * Each tour's content version. Bumping one shows that tour again to
 * students who have seen an older version. home, unit and check are stored
 * in profile.toursSeen; life keeps its older field, tutorialSeenVersion.
 */
export const TOURS: Record<TourId, { version: number; steps: TourStep[] }> = {
  home: { version: 1, steps: HOME_TOUR_STEPS },
  unit: { version: 1, steps: UNIT_TOUR_STEPS },
  check: { version: 1, steps: CHECK_TOUR_STEPS },
  life: { version: CURRENT_TUTORIAL_VERSION, steps: LIFE_TOUR_STEPS },
};

export function isTourId(v: unknown): v is TourId {
  return v === "home" || v === "unit" || v === "check" || v === "life";
}

/** Which version of a tour this student has seen, from their stored profile. */
export function seenVersionOf(profile: { tutorialSeenVersion?: number; toursSeen?: Record<string, number> }, tour: TourId): number | undefined {
  return tour === "life" ? profile.tutorialSeenVersion : profile.toursSeen?.[tour];
}

/** The browser's own record, for visitors without an account (the first unit is open to them). */
export const tourStorageKey = (tour: TourId) => `finline:tour:${tour}`;

