/**
 * State from the request's IP, server side. We never read, store or return the raw IP:
 * the hosting edge (Vercel) resolves it to an ISO 3166-2 region code and sends it as a header.
 * The headers are trusted only when running on Vercel (env VERCEL); elsewhere the region is simply unknown.
 */
import type { State } from "@/shared/lib/lists";

const ISO_TO_STATE: Record<string, State> = {
  AN: "Andaman and Nicobar Islands",
  AP: "Andhra Pradesh",
  AR: "Arunachal Pradesh",
  AS: "Assam",
  BR: "Bihar",
  CH: "Chandigarh",
  CT: "Chhattisgarh",
  CG: "Chhattisgarh",
  DH: "Dadra and Nagar Haveli and Daman and Diu",
  DD: "Dadra and Nagar Haveli and Daman and Diu",
  DN: "Dadra and Nagar Haveli and Daman and Diu",
  DL: "Delhi",
  GA: "Goa",
  GJ: "Gujarat",
  HR: "Haryana",
  HP: "Himachal Pradesh",
  JK: "Jammu and Kashmir",
  JH: "Jharkhand",
  KA: "Karnataka",
  KL: "Kerala",
  LA: "Ladakh",
  LD: "Lakshadweep",
  MP: "Madhya Pradesh",
  MH: "Maharashtra",
  MN: "Manipur",
  ML: "Meghalaya",
  MZ: "Mizoram",
  NL: "Nagaland",
  OR: "Odisha",
  OD: "Odisha",
  PY: "Puducherry",
  PB: "Punjab",
  RJ: "Rajasthan",
  SK: "Sikkim",
  TN: "Tamil Nadu",
  TG: "Telangana",
  TS: "Telangana",
  TR: "Tripura",
  UP: "Uttar Pradesh",
  UT: "Uttarakhand",
  UK: "Uttarakhand",
  WB: "West Bengal",
};

/** Maps an ISO region code ("GJ", "IN-GJ") to a standard state name, or undefined. */
export function stateFromRegionCode(code: string | null | undefined): State | undefined {
  if (!code) return undefined;
  const clean = code.trim().toUpperCase().replace(/^IN-/, "");
  return ISO_TO_STATE[clean];
}

/** Only India is in scope; a different country means no state. */
export function stateFromHeaders(headers: { get(name: string): string | null }): State | undefined {
  // Off Vercel (or behind a proxy that does not strip it) a client can send these headers itself.
  if (!process.env.VERCEL) return undefined;
  const country = headers.get("x-vercel-ip-country");
  if (country && country.toUpperCase() !== "IN") return undefined;
  return stateFromRegionCode(headers.get("x-vercel-ip-country-region"));
}
