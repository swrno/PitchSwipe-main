// Service check: which services are configured, and can this machine reach them with those keys?
//
//   npm run doctor             reads .env.local like `next dev` does
//   npm run doctor -- --offline  configuration only, no network
//
// Read-only. It never writes to a database, creates a flag, sends an email or spends model tokens (the LLM check
// looks the model up, it does not generate). It prints which variables are set or missing, never their values.
import Anthropic from "@anthropic-ai/sdk";
import nextEnv from "@next/env";
import mongoose from "mongoose";

import { normalizePrivateKey } from "../src/shared/lib/firebase/private-key.ts";

nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
const env = process.env;
const offline = process.argv.includes("--offline");
const TIMEOUT_MS = 10_000;

const set = (name) => Boolean(env[name]?.trim());
const missing = (names) => names.filter((n) => !set(n));

const results = [];
function report(service, status, detail) {
  results.push({ service, status, detail });
}

async function withTimeout(promise, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${TIMEOUT_MS / 1000} s`)), TIMEOUT_MS);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** Error text without anything that could be a secret (URIs, keys). */
function safe(error, secrets = []) {
  let text = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  for (const s of secrets) if (s) text = text.split(s).join("<redacted>");
  return text.replace(/mongodb(\+srv)?:\/\/[^\s]+/g, "<MONGODB_URI>").slice(0, 240);
}

async function check(service, required, run) {
  const gone = missing(required);
  if (gone.length === required.length) return report(service, "off", `not configured (${required.join(", ")})`);
  if (gone.length) return report(service, "fail", `partly configured, missing ${gone.join(", ")}`);
  if (offline || !run) return report(service, "set", "configured (not contacted)");
  try {
    report(service, "ok", await run());
  } catch (e) {
    report(service, "fail", safe(e, [env.MONGODB_URI, env.LLM_API_KEY, env.GROQ_API_KEY, env.FLAGSMITH_ADMIN_API_KEY]));
  }
}

await check("MongoDB", ["MONGODB_URI"], async () => {
  const conn = await withTimeout(mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: TIMEOUT_MS }), "MongoDB");
  try {
    await conn.connection.db.admin().ping();
    return `reachable, database "${conn.connection.db.databaseName}"`;
  } finally {
    await mongoose.disconnect();
  }
});

await check("Firebase (web sign-in)", ["NEXT_PUBLIC_FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "NEXT_PUBLIC_FIREBASE_PROJECT_ID", "NEXT_PUBLIC_FIREBASE_APP_ID"]);

await check("Firebase Admin (token checks)", ["FIREBASE_ADMIN_PROJECT_ID", "FIREBASE_ADMIN_CLIENT_EMAIL", "FIREBASE_ADMIN_PRIVATE_KEY"], async () => {
  const privateKey = normalizePrivateKey(env.FIREBASE_ADMIN_PRIVATE_KEY);
  if (!privateKey?.includes("BEGIN PRIVATE KEY")) throw new Error("FIREBASE_ADMIN_PRIVATE_KEY does not look like a PEM private key");
  const { cert, initializeApp } = await import("firebase-admin/app");
  const credential = cert({ projectId: env.FIREBASE_ADMIN_PROJECT_ID, clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL, privateKey });
  initializeApp({ credential }, "pitchswipe-doctor");
  await withTimeout(credential.getAccessToken(), "Firebase Admin");
  const sameProject = !set("NEXT_PUBLIC_FIREBASE_PROJECT_ID") || env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === env.FIREBASE_ADMIN_PROJECT_ID;
  if (!sameProject) throw new Error("the service account belongs to a different project than NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  return "service account accepted by Google";
});

const flagsmithUrl = (env.FLAGSMITH_API_URL || "https://api.flagsmith.com").replace(/\/+$/, "");
await check("Flagsmith (admin)", ["FLAGSMITH_ADMIN_API_KEY", "FLAGSMITH_PROJECT_ID"], async () => {
  const scheme = env.FLAGSMITH_ADMIN_AUTH_SCHEME || "Api-Key";
  const res = await withTimeout(
    fetch(`${flagsmithUrl}/api/v1/projects/${encodeURIComponent(env.FLAGSMITH_PROJECT_ID)}/`, {
      headers: { Authorization: `${scheme} ${env.FLAGSMITH_ADMIN_API_KEY}` },
    }),
    "Flagsmith",
  );
  if (!res.ok) throw new Error(`GET project answered ${res.status}`);
  const project = await res.json();
  return `project "${project?.name ?? env.FLAGSMITH_PROJECT_ID}" readable`;
});
await check("Flagsmith (client key)", ["NEXT_PUBLIC_FLAGSMITH_ENV_KEY"], async () => {
  const res = await withTimeout(fetch(`${flagsmithUrl}/api/v1/flags/`, { headers: { "X-Environment-Key": env.NEXT_PUBLIC_FLAGSMITH_ENV_KEY } }), "Flagsmith");
  if (!res.ok) throw new Error(`GET flags answered ${res.status}`);
  const flags = await res.json();
  return `environment readable, ${Array.isArray(flags) ? flags.length : 0} flags`;
});

const { llmVendor } = await import("../src/shared/lib/ai/llm-env.ts");
const { GROQ_BASE_URL, GROQ_DEFAULT_MODEL, GROQ_FAST_MODEL } = await import("../src/shared/lib/ai/groq-provider.ts");
const vendor = llmVendor(env);

if (vendor === "groq") {
  await check("Groq (AI drafting, Ask, insights, voice)", [env.GROQ_API_KEY?.trim() ? "GROQ_API_KEY" : "LLM_API_KEY"], async () => {
    const key = env.GROQ_API_KEY?.trim() || env.LLM_API_KEY?.trim();
    const base = (env.LLM_BASE_URL?.trim() || GROQ_BASE_URL).replace(/\/+$/, "");
    const res = await withTimeout(fetch(`${base}/models`, { headers: { Authorization: `Bearer ${key}` } }), "Groq");
    if (!res.ok) throw new Error(`Groq answered ${res.status}`);
    const ids = new Set(((await res.json()).data ?? []).map((m) => m.id));
    const wanted = [env.LLM_MODEL?.trim() || GROQ_DEFAULT_MODEL, env.LLM_FALLBACK_MODEL?.trim() || GROQ_FAST_MODEL].filter((m) => m !== "none");
    const missing = wanted.filter((m) => !ids.has(m));
    if (missing.length > 0) throw new Error(`key accepted, but ${missing.join(", ")} is not available any more: set LLM_MODEL`);
    return `key accepted, ${wanted.join(" + fallback ")} available`;
  });
} else await check("Claude (AI drafting, Ask, insights)", ["LLM_API_KEY"], async () => {
  const model = env.LLM_MODEL?.trim() || "claude-opus-5-5";
  const client = new Anthropic({ apiKey: env.LLM_API_KEY, ...(set("LLM_BASE_URL") ? { baseURL: env.LLM_BASE_URL.trim() } : {}), timeout: TIMEOUT_MS });
  const info = await client.models.retrieve(model);
  return `key accepted, model ${info.id} available`;
});

await check("Resend (email)", ["RESEND_API_KEY"]);

// Settings that are not services but decide how the app behaves.
const notes = [];
const secret = env.SWIPE_SIGNING_SECRET ?? "";
if (secret.length < 16) notes.push("SWIPE_SIGNING_SECRET is missing or shorter than 16 characters (required in production).");
else if (/local-dev|not-for-prod/i.test(secret)) notes.push("SWIPE_SIGNING_SECRET is the local development value. Use a new random one for any deployment.");
if (!set("CRON_SECRET")) notes.push("CRON_SECRET is not set: the 'Test decided' watcher route answers 503.");
if (!set("NEXT_PUBLIC_APP_URL")) notes.push("NEXT_PUBLIC_APP_URL is not set: email and share links have no base URL (required for real mode).");

// Web sign-in config cannot be contacted from here, so "set" is the best it gets. The other two must answer
// (or, offline, at least be set). The app also needs a swipe signing secret and the public app URL.
const status = (service) => results.find((r) => r.service === service)?.status;
const reached = (service) => status(service) === "ok" || (offline && status(service) === "set");
const realReady =
  reached("MongoDB") &&
  reached("Firebase Admin (token checks)") &&
  status("Firebase (web sign-in)") === "set" &&
  secret.length >= 16 &&
  set("NEXT_PUBLIC_APP_URL");

const icon = { ok: "ok  ", set: "set ", off: "--  ", fail: "FAIL" };
console.log(`\nPitchSwipe service check${offline ? " (offline)" : ""}\n`);
for (const r of results) console.log(`  ${icon[r.status]}  ${r.service.padEnd(38)} ${r.detail}`);
if (notes.length) {
  console.log("\nNotes");
  for (const n of notes) console.log(`  - ${n}`);
}
console.log(
  `\nReady (MongoDB + Firebase + SWIPE_SIGNING_SECRET + NEXT_PUBLIC_APP_URL): ${realReady ? "ready" : "not ready"}`,
);
console.log(
  [
    "Optional services marked -- fall back without breaking anything. Without an LLM key (Groq or Claude): AI drafting says it needs a key,",
    "Ask runs a scripted planner over your real data (code fills every figure), insights use code templates.",
    "Voice notes are turned into text by the browser; without an LLM key the swiper types the English. Without Resend, email stays off.",
    "",
  ].join("\n"),
);

process.exit(results.some((r) => r.status === "fail") ? 1 : 0);
