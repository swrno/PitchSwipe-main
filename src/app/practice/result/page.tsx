import type { Metadata } from "next";
import { ResultView } from "@/features/quality/ui/result-view";

export const metadata: Metadata = { title: "Quality result" };

export default function PracticeResultPage() {
  return <ResultView />;
}
