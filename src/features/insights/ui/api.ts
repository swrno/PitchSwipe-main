"use client";

import { resultsJson } from "@/features/results/ui/api";
import type { InsightsPayload } from "@/features/insights/types";

/** Product insights for the signed-in founder (sends the Firebase token). */
export const loadInsightsPayload = (productId: string) => resultsJson<InsightsPayload>(`/api/insights/${encodeURIComponent(productId)}`);
