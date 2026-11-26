import type { Metadata } from "next";
import { PracticeFlow } from "@/components/quality/practice-flow";
import { parseMode } from "@/lib/quality";

export const metadata: Metadata = { title: "Quality check" };

export default async function PracticePage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;
  return <PracticeFlow mode={parseMode(mode)} />;
}
