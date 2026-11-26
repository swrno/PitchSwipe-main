"use client";

import { resultsJson } from "@/components/results/api";
import type { InsightsPayload } from "@/lib/insights/types";

/** Product insights for the signed-in founder (sends the Firebase token; demo mode needs none). */
export const loadInsightsPayload = (productId: string) => resultsJson<InsightsPayload>(`/api/insights/${encodeURIComponent(productId)}`);
