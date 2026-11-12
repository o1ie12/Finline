/**
 * The program (2026-11-12): the twelve lines as one curriculum. Each line is
 * a course with a code, a place in the sequence (core, elective, capstone),
 * a topic area, the courses to take first and 3 to 5 learning objectives.
 *
 * What a course contains (its modules, tasks, minutes, documents) is never
 * typed here: lib/curriculum.ts reads it from the line's own content, so the
 * syllabus cannot drift from what the student actually does.
 *
 * Objectives say what a student can do afterwards, each one traceable to a
 * module of that line. They never promise a job or an outcome (06 F3.9).
 * tests/curriculum.test.ts holds the counts and the copy rules.
 */
import type { LineSlug } from "@/lib/lines";

export const PROGRAM = {
  name: "錢途個人理財學程",
  enName: "Finline Personal Finance Program",
  promise: "從第一份薪水到第一份租約：用真實格式的帳單、契約和薪資單，把錢的事一件一件學會。",
  audience: "高中生、大學新鮮人，和剛開始自己管錢的人。不需要任何基礎。",
} as const;

/** The six topic areas a personal finance curriculum covers, plus the capstone. */
export const AREAS = {
  income: { name: "收入", en: "Earning Income", blurb: "薪水怎麼來、被扣了什麼、實際拿到多少。" },
  spending: { name: "消費與預算", en: "Spending", blurb: "錢怎麼分、哪些該花、合約怎麼看。" },
  saving: { name: "儲蓄", en: "Saving", blurb: "訂目標、算每月要存多少、讓時間幫忙。" },
  credit: { name: "信用與借貸", en: "Managing Credit", blurb: "借錢的代價，和銀行怎麼看你。" },
  investing: { name: "投資", en: "Investing", blurb: "先準備好，再看懂風險和工具。" },
  risk: { name: "風險與保障", en: "Managing Risk", blurb: "認出詐騙，分清保險保什麼。" },
  capstone: { name: "總整", en: "Capstone", blurb: "把前面學的放進同一個決定。" },
} as const;
export type AreaId = keyof typeof AREAS;

export const TRACKS = {
  core: { name: "核心課程", en: "Core", blurb: "照順序上。六門課各對應一個主題領域，是整個學程的基礎。" },
  elective: { name: "選修課程", en: "Electives", blurb: "遇到了再上：上大學、開始打工、搬出去住之前，挑需要的那一門。" },
  capstone: { name: "總整課程", en: "Capstone", blurb: "最後上。它會用到你在核心課程裡做過的決定。" },
} as const;
export type TrackId = keyof typeof TRACKS;

export interface CourseInfo {
  slug: LineSlug;
  /** FL + level (1 入門, 2 中等, 3 進階, 4 總整) + two digits. */
  code: string;
  track: TrackId;
  area: AreaId;
  /** Courses to take first. A suggestion, never a lock. */
  prerequisites: LineSlug[];
  /** Why those come first, in one sentence; absent when there are none. */
  prerequisiteNote?: string;
  /** 學完這門課，你能夠…… */
  objectives: string[];
}

/** In teaching order: core, then electives, then the capstone. */
export const COURSES: CourseInfo[] = [
  {
    slug: "zhiya",
    code: "FL101",
    track: "core",
    area: "income",
    prerequisites: [],
    objectives: [
      "分清自己的興趣和擅長，找出兩者重疊的方向",
      "從月薪算出實領金額",
      "把房租和交通算進兩份工作的比較",
      "為一個職涯選擇說明取捨和理由",
    ],
  },
  {
    slug: "qixin",
    code: "FL102",
    track: "core",
    area: "spending",
    prerequisites: ["zhiya"],
    prerequisiteNote: "期末模擬會用你在職涯線選到的收入。",
    objectives: [
      "分辨需要和想要，認出特價的陷阱",
      "用「先存再花」的順序分配一個月的收入",
      "從記帳看出錢花到哪裡去",
      "月底遇到意外支出時，調整原本的分配",
    ],
  },
  {
    slug: "cunqian",
    code: "FL103",
    track: "core",
    area: "saving",
    prerequisites: ["qixin"],
    prerequisiteNote: "先知道每個月能留下多少，再決定存錢目標。",
    objectives: [
      "把一個願望寫成有金額和期限的目標",
      "算出達成目標每個月要存多少",
      "用 72 法則估算錢或債翻倍要多久",
      "比較守住計畫和每次都心動，到期時差多少",
    ],
  },
  {
    slug: "zhapian",
    code: "FL104",
    track: "core",
    area: "risk",
    prerequisites: [],
    objectives: [
      "在一段對話裡找出詐騙的可疑之處",
      "分辨假投資、假客服和借點數等常見手法",
      "說明出借帳戶可能要負的法律責任",
      "按順序排出遇到詐騙時的應變步驟",
    ],
  },
  {
    slug: "xinyong",
    code: "FL201",
    track: "core",
    area: "credit",
    prerequisites: ["qixin"],
    prerequisiteNote: "先會分配每個月的錢，再學用信用卡。",
    objectives: [
      "說出銀行決定借不借錢時會看的事",
      "在信用卡帳單上找出最重要的幾個數字",
      "說明只繳最低應繳金額的代價",
      "說出保護信用卡不被盜刷的做法",
    ],
  },
  {
    slug: "touzi",
    code: "FL202",
    track: "core",
    area: "investing",
    prerequisites: ["cunqian"],
    prerequisiteNote: "投資前要先有存款和緊急預備金。",
    objectives: [
      "檢查自己開始投資前該準備好的事",
      "解釋帳面虧損，說明大跌時為什麼不急著賣",
      "讀懂財經新聞裡的加權指數、本益比和殖利率",
      "從 ETF 代號分辨槓桿型和反向型商品",
    ],
  },
  {
    slug: "xuedai",
    code: "FL203",
    track: "elective",
    area: "credit",
    prerequisites: ["qixin"],
    objectives: [
      "把單學期的學費換算成四年總價",
      "估算畢業後學貸每個月要還多少",
      "比較住宿舍、租屋和通勤的成本",
      "用機會成本評估要不要打工",
      "找到獎助學金和校內資源",
    ],
  },
  {
    slug: "zuwu",
    code: "FL204",
    track: "elective",
    area: "spending",
    prerequisites: ["qixin"],
    objectives: [
      "用檢查表看房，知道房仲費的上限",
      "對照內政部的契約範本，找出無效的條款",
      "分清修繕責任在房東還是房客",
      "入住和退租時留下紀錄，保護押金",
    ],
  },
  {
    slug: "baoxian",
    code: "FL205",
    track: "elective",
    area: "risk",
    prerequisites: [],
    objectives: [
      "用避開、預防、轉移、承擔四種方法處理風險",
      "分清勞保、勞退和職災保險",
      "把人身四大風險配對到對應的保險",
      "聽推銷時分辨保障和儲蓄",
    ],
  },
  {
    slug: "baoshui",
    code: "FL301",
    track: "elective",
    area: "income",
    prerequisites: ["zhiya"],
    prerequisiteNote: "先會算實領薪資，再看稅怎麼算。",
    objectives: [
      "看懂薪資單上的每一項扣款",
      "分清免稅額、扣除額和累進稅率",
      "說明扣繳憑單的用途和為什麼要保存",
      "走完一次模擬申報，算出退稅或補稅",
    ],
  },
  {
    slug: "chuangye",
    code: "FL302",
    track: "elective",
    area: "income",
    prerequisites: ["qixin"],
    objectives: [
      "分清固定成本和變動成本",
      "算出毛利率和損益兩平點",
      "解釋為什麼有獲利不代表有現金",
      "說出開始做生意前要辦的登記和發票",
    ],
  },
  {
    slug: "caiwujuece",
    code: "FL401",
    track: "capstone",
    area: "capstone",
    prerequisites: ["zhiya", "qixin", "cunqian", "xinyong", "touzi"],
    prerequisiteNote: "期末模擬會讀你在這幾門課留下的收入、存款、信用和投資結果。",
    objectives: [
      "檢查頭期款夠不夠",
      "算出每月房貸在收入裡占多少",
      "判斷銀行會不會放款，利率大概落在哪裡",
      "把收入、存款、信用和投資放在一起，說明一個取捨",
    ],
  },
];

export function courseInfo(slug: string): CourseInfo | undefined {
  return COURSES.find((c) => c.slug === slug);
}

/**
 * How a module runs, in the order the station screen runs it
 * (components/flow/StationWorkspace.tsx). The names here are the course
 * vocabulary; content/flow.ts keeps the station screen's own labels.
 */
export const ITEM_TYPES = {
  hook: { name: "情境提問", note: "不計分" },
  concept: { name: "重點概念", note: "選讀" },
  task: { name: "實作任務", note: "計分" },
  review: { name: "解析與專家觀點", note: "作答後開放" },
  sim: { name: "期末模擬", note: "完成即可" },
} as const;

/** How each kind of question is scored (lib/tasks/scoring.ts). */
export const STEP_RUBRIC: Record<string, { name: string; how: string }> = {
  choice: { name: "選擇題", how: "選對得滿分。要選理由的題目，答案和理由各占一半。" },
  number: { name: "計算題", how: "算出的數字在容許誤差內得滿分。" },
  sort: { name: "分類題", how: "每放對一項得一份分數，按比例計分。" },
  order: { name: "排序題", how: "順序越接近正確順序，分數越高。" },
  find: { name: "文件標記題", how: "在文件上標出該注意的地方。標對得分，標錯會扣回。" },
  rate: { name: "評估題", how: "評估和建議答案相同得滿分，差一級得一半。" },
  write: { name: "簡答題", how: "不計分。寫完對照參考答案，自己用檢核項目檢查。" },
};

/** The documents a task can put in front of the student (lib/tasks/types.ts Material). */
export const DOCUMENT_NAMES: Record<string, string> = {
  payslip: "薪資單",
  cardStatement: "信用卡帳單",
  creditReport: "信用報告",
  chat: "對話紀錄",
  billSheet: "帳單明細",
  ledger: "記帳表",
  policy: "保單",
  lease: "租賃契約",
  snapshot: "財務狀況表",
  priceChart: "股價走勢圖",
  newsCard: "財經新聞",
};

/** The pass mark every scored task uses unless its content says otherwise. */
export const DEFAULT_PASS = 0.6;

/** Questions every course page answers; the course's own facts are filled in by the page. */
export const COURSE_FAQ: { q: string; a: string }[] = [
  { q: "要付費嗎？", a: "不用。所有課程、任務和完成紀錄都免費。" },
  { q: "一定要照順序上嗎？", a: "不一定。每門課都可以直接開始。課程頁列出的「建議先修」只是建議，不會鎖住任何內容。" },
  { q: "有期限嗎？", a: "沒有。進度照你自己的步調，每完成一個單元會自動存下來，下次從下一個單元接著上。" },
  { q: "答錯了會怎樣？", a: "不會怎樣。每個任務都可以重做，成績表顯示你的最高分。第二次作答後，就算沒達到及格標準，單元也會記為完成，讓你可以繼續往下走。" },
  { q: "任務裡的文件是真的嗎？", a: "格式照真實的帳單、契約和薪資單製作，數字的算法也一樣。上面的人名和機構名稱都是虛構的。" },
  { q: "完成後會拿到什麼？", a: "一份完成紀錄，列出你走過的每個單元和期末的結果。這是學習練習的紀錄，不是真實的工作經驗。" },
];
