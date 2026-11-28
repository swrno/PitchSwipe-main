import type { Metadata } from "next";
import { PracticeFlow } from "@/features/quality/ui/practice-flow";
import { parseMode } from "@/features/quality";

export const metadata: Metadata = { title: "Quality check" };

export default async function PracticePage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;
  return <PracticeFlow mode={parseMode(mode)} />;
}
