/** State tile map layout (designs 20 and 23): abbreviation, standard-list state name, grid cell. */
import type { State } from "@/shared/lib/lists";

export interface StateTile {
  abbr: string;
  state: State;
  row: number;
  col: number;
}

const t = (abbr: string, state: State, row: number, col: number): StateTile => ({ abbr, state, row, col });

export const STATE_TILES: readonly StateTile[] = [
  t("JK", "Jammu and Kashmir", 0, 2),
  t("LA", "Ladakh", 0, 3),
  t("PB", "Punjab", 1, 1),
  t("HP", "Himachal Pradesh", 1, 2),
  t("UK", "Uttarakhand", 1, 3),
  t("SK", "Sikkim", 1, 5),
  t("AR", "Arunachal Pradesh", 1, 7),
  t("RJ", "Rajasthan", 2, 0),
  t("HR", "Haryana", 2, 1),
  t("DL", "Delhi", 2, 2),
  t("UP", "Uttar Pradesh", 2, 3),
  t("BR", "Bihar", 2, 4),
  t("AS", "Assam", 2, 6),
  t("NL", "Nagaland", 2, 7),
  t("GJ", "Gujarat", 3, 0),
  t("MP", "Madhya Pradesh", 3, 1),
  t("CG", "Chhattisgarh", 3, 2),
  t("JH", "Jharkhand", 3, 3),
  t("WB", "West Bengal", 3, 4),
  t("ML", "Meghalaya", 3, 5),
  t("MN", "Manipur", 3, 7),
  t("MH", "Maharashtra", 4, 1),
  t("TG", "Telangana", 4, 2),
  t("OD", "Odisha", 4, 3),
  t("TR", "Tripura", 4, 5),
  t("MZ", "Mizoram", 4, 6),
  t("GA", "Goa", 5, 0),
  t("KA", "Karnataka", 5, 1),
  t("AP", "Andhra Pradesh", 5, 2),
  t("KL", "Kerala", 6, 1),
  t("TN", "Tamil Nadu", 6, 2),
];

/** Shade bucket for a join rate (legend: under 10%, 10 to 14%, 15 to 19%, 20% or more). */
export function rateBucket(rate: number): 0 | 1 | 2 | 3 {
  const p = Math.round(rate * 100);
  if (p >= 20) return 3;
  if (p >= 15) return 2;
  if (p >= 10) return 1;
  return 0;
}
