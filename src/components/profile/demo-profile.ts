/**
 * The demo swiper shown on /profile in demo mode only. Server only: the profile page calls demoProfile() behind
 * isDemoMode() and passes the result as a prop, so real mode never reads these fixture values.
 */
import { SWIPER, WALLET } from "@/fixtures";
import type { ProfileView } from "./types";

export function demoProfile(): ProfileView {
  return {
    id: "demo",
    name: SWIPER.name,
    email: SWIPER.email,
    emailVerified: true,
    role: SWIPER.role,
    state: SWIPER.state,
    interests: [...SWIPER.interests],
    counting: WALLET.currentQualityScore >= WALLET.qualityThreshold,
    qualityScore: WALLET.currentQualityScore,
    qualityChecked: true,
    countsTowardPay: WALLET.currentQualityScore >= WALLET.qualityThreshold,
    countingThreshold: WALLET.qualityThreshold,
    createdAt: null,
  };
}
