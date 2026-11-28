import type { Industry, Role, State } from "@/shared/lib/lists";

/** GET /api/profile `user`, as this screen reads it (a superset of ProfileDoc in the auth provider). */
export interface ProfileView {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role?: Role;
  state?: State;
  interests: Industry[];
  counting: boolean;
  qualityScore: number;
  /** False until the swiper has taken the quality check (a 0 score then means "not checked", not "scored 0"). */
  qualityChecked: boolean;
  countsTowardPay: boolean;
  countingThreshold: number;
  /** False while the quality check is set aside: every signed-in swiper counts. Absent (older API) means on. */
  qualityCheck?: boolean;
  createdAt: string | null;
}

export interface ProfileFields {
  name: string;
  role: Role | "";
  state: State | "";
  interests: Industry[];
}
