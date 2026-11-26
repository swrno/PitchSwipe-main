/** Cron guard for the audio cleanup route (server only). Same rule as /api/cron/assistant: closed by default, constant-time. */
import { timingSafeEqual } from "node:crypto";

export type CronAuth = "unconfigured" | "unauthorized" | "ok";

export function cronAuth(authorizationHeader: string | null, secret: string | undefined = process.env.CRON_SECRET): CronAuth {
  if (!secret) return "unconfigured";
  const a = Buffer.from(authorizationHeader ?? "");
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b) ? "ok" : "unauthorized";
}
