import type { Metadata } from "next";
import { ResultView } from "@/components/quality/result-view";

export const metadata: Metadata = { title: "Quality result" };

export default async function PracticeResultPage({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
  const { demo } = await searchParams;
  return <ResultView demo={demo} />;
}
