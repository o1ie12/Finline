import type { Metadata } from "next";
import { QuizPlay } from "@/components/class/QuizPlay";

export const metadata: Metadata = { title: "加入房間", robots: { index: false } };

/** A student joins a quiz room with the code. No account needed (spec 12 TCH-5). */
export default function ClassPlayPage() {
  return <QuizPlay />;
}
