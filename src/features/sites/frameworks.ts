/**
 * Framework-specific setup steps for the Website tab. Pure.
 *
 * Every variant is built from the SAME public config as the HTML snippet (resolveConfig): the public
 * client key, the flags URL, the ping URL, the flag names and the current text (the fallback). No
 * secret ever reaches this module. Framework apps get a small hook that returns the live value
 * (never a script that rewrites the DOM under React or Vue).
 */
import { buildScriptBody, buildSnippet, js, markupExample, resolveConfig } from "./snippet";
import type { SiteSetup } from "./types";

export const FRAMEWORKS = [
  { id: "html", label: "HTML" },
  { id: "react", label: "React" },
  { id: "next", label: "Next.js" },
  { id: "vue", label: "Vue" },
  { id: "wordpress", label: "WordPress" },
  { id: "webflow", label: "Webflow / Framer" },
  { id: "shopify", label: "Shopify" },
] as const;

export type FrameworkId = (typeof FRAMEWORKS)[number]["id"];
export const DEFAULT_FRAMEWORK: FrameworkId = "html";

export function isFrameworkId(v: unknown): v is FrameworkId {
  return FRAMEWORKS.some((f) => f.id === v);
}

export function frameworkLabel(id: FrameworkId): string {
  return FRAMEWORKS.find((f) => f.id === id)?.label ?? "HTML";
}

export const frameworkStorageKey = (productId: string) => `ps:site-framework:${productId}`;

export interface CodeBlock {
  /** File name or short caption shown above the code. */
  title?: string;
  language: "html" | "tsx" | "ts" | "vue" | "liquid" | "text";
  code: string;
}

export interface FrameworkSetup {
  id: FrameworkId;
  /** Step 1: where to put it. Short sentences, one per paragraph. */
  install: { intro: string[]; blocks: CodeBlock[] };
  /** Step 2: mark what each test controls. */
  mark: { intro: string[]; blocks: CodeBlock[] };
}

const PLACEHOLDER_FLAG = { flagName: "your_flag_name", text: "Your current text", tag: "span" as const };

function flagsOf(setup: SiteSetup) {
  return setup.flags.length ? setup.flags : [PLACEHOLDER_FLAG];
}

/** A valid, unique JS identifier per flag (camelCase of the flag name). */
function identifiers(names: string[]): string[] {
  const used = new Set<string>();
  return names.map((name, i) => {
    let id = name
      .replace(/[^A-Za-z0-9]+(.)?/g, (_m, c: string | undefined) => (c ? c.toUpperCase() : ""))
      .replace(/^[A-Z]/, (c) => c.toLowerCase());
    if (!/^[a-z]/.test(id)) id = `text${i + 1}`;
    while (used.has(id)) id = `${id}${i + 1}`;
    used.add(id);
    return id;
  });
}

function hookCore(setup: SiteSetup): string {
  const { env, flags, ping, live } = resolveConfig(setup);
  return `// Public client key only. Your current text is the fallback until a winner ships.
const PS = { env: ${js(env)}, flags: ${js(flags)}, ping: ${js(ping)}, live: ${js(live)} };

type FlagMap = Record<string, string>;
let flagsPromise: Promise<FlagMap> | null = null;
const reported: FlagMap = {};
let lastSent = "";
let timer: ReturnType<typeof setTimeout> | undefined;

// Reads the flags once and keeps them in module state.
function loadFlags(): Promise<FlagMap> {
  if (!PS.live) return Promise.resolve({});
  flagsPromise ??= fetch(PS.flags, { headers: { "X-Environment-Key": PS.env }, credentials: "omit" })
    .then((r) => (r.ok ? r.json() : []))
    .then((list) => {
      const map: FlagMap = {};
      for (const f of Array.isArray(list) ? list : []) {
        if (f && f.enabled !== false && f.feature && typeof f.feature_state_value === "string") map[f.feature.name] = f.feature_state_value;
      }
      return map;
    })
    .catch(() => ({}) as FlagMap);
  return flagsPromise;
}

// Tells PitchSwipe what this page shows, so the Website tab can say "connected".
function report(flag: string, value: string) {
  reported[flag] = value.trim().slice(0, 500);
  clearTimeout(timer);
  timer = setTimeout(() => {
    const elements = Object.keys(reported)
      .slice(0, 50)
      .map((name) => ({ flag: name, value: reported[name] }));
    const body = JSON.stringify({ elements });
    if (body === lastSent) return;
    lastSent = body;
    fetch(PS.ping, { method: "POST", headers: { "content-type": "text/plain" }, body, keepalive: true, credentials: "omit" }).catch(() => {});
  }, 300);
}
`;
}

function reactHook(setup: SiteSetup, clientDirective: boolean): string {
  return `${clientDirective ? '"use client";\n\n' : ""}import { useEffect, useState } from "react";

${hookCore(setup)}
/** Returns the live text for a test, or your current text until it loads (and if it cannot). */
export function usePitchSwipe(flag: string, fallback: string): string {
  const [value, setValue] = useState(fallback);
  useEffect(() => {
    let active = true;
    loadFlags().then((map) => {
      const next = map[flag] || fallback;
      if (active) setValue(next);
      report(flag, next);
    });
    return () => {
      active = false;
    };
  }, [flag, fallback]);
  return value;
}
`;
}

function vueComposable(setup: SiteSetup): string {
  return `import { onMounted, ref } from "vue";

${hookCore(setup)}
/** Returns a ref with the live text for a test; it starts as your current text. */
export function usePitchSwipe(flag: string, fallback: string) {
  const text = ref(fallback);
  onMounted(async () => {
    const map = await loadFlags();
    text.value = map[flag] || fallback;
    report(flag, text.value);
  });
  return text;
}
`;
}

function tagOf(f: { tag?: "h1" | "span" | "p" }): "h1" | "span" | "p" {
  return f.tag ?? "span";
}

function reactUsage(setup: SiteSetup, importPath: string, clientDirective: boolean): string {
  const flags = flagsOf(setup).slice(0, 3);
  const ids = identifiers(flags.map((f) => f.flagName));
  const lines = flags.map((f, i) => `  const ${ids[i]} = usePitchSwipe(${js(f.flagName)}, ${js(f.text)});`).join("\n");
  const jsx = flags.map((f, i) => `      <${tagOf(f)}>{${ids[i]}}</${tagOf(f)}>`).join("\n");
  return `${clientDirective ? '"use client";\n\n' : ""}import { usePitchSwipe } from ${js(importPath)};

export function Hero() {
${lines}
  return (
    <section>
${jsx}
    </section>
  );
}
`;
}

function vueUsage(setup: SiteSetup): string {
  const flags = flagsOf(setup).slice(0, 3);
  const ids = identifiers(flags.map((f) => f.flagName));
  const lines = flags.map((f, i) => `const ${ids[i]} = usePitchSwipe(${js(f.flagName)}, ${js(f.text)});`).join("\n");
  const tpl = flags.map((f, i) => `    <${tagOf(f)}>{{ ${ids[i]} }}</${tagOf(f)}>`).join("\n");
  return `<script setup lang="ts">
import { usePitchSwipe } from "@/composables/usePitchSwipe";

${lines}
</script>

<template>
  <section>
${tpl}
  </section>
</template>
`;
}

function nextScript(setup: SiteSetup): string {
  const body = buildScriptBody(setup).replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
  return `import Script from "next/script";

// In app/layout.tsx, inside <body>, after {children}:
export function PitchSwipeScript() {
  return (
    <Script id="pitchswipe" strategy="afterInteractive">
      {\`${body}\`}
    </Script>
  );
}
`;
}

function markupBlock(setup: SiteSetup): CodeBlock {
  return { language: "html", code: markupExample(flagsOf(setup).slice(0, 2)) };
}

function attributeList(setup: SiteSetup): CodeBlock {
  return {
    language: "text",
    code: flagsOf(setup)
      .map((f) => `data-pitchswipe = ${f.flagName}`)
      .join("\n"),
  };
}

export function buildFrameworkSetup(id: FrameworkId, setup: SiteSetup): FrameworkSetup {
  const snippet: CodeBlock = { language: "html", code: buildSnippet(setup) };
  const keep = "Keep your current text inside; it shows until a winner ships.";
  switch (id) {
    case "react":
      return {
        id,
        install: {
          intro: ["Add this hook once, for example as src/usePitchSwipe.ts. It uses only your public client key.", "It reads your tests once and falls back to your current text."],
          blocks: [{ title: "src/usePitchSwipe.ts", language: "ts", code: reactHook(setup, false) }],
        },
        mark: {
          intro: ["Call the hook where the text is rendered, with the test's flag name and your current text. React stays in charge of the page; no script edits it."],
          blocks: [{ title: "Hero.tsx", language: "tsx", code: reactUsage(setup, "./usePitchSwipe", false) }],
        },
      };
    case "next":
      return {
        id,
        install: {
          intro: [
            "Add this hook once, for example as components/usePitchSwipe.ts. The \"use client\" line at the top is needed because it runs in the browser.",
            "Prefer a plain static page? Use the next/script option below instead of the hook.",
          ],
          blocks: [
            { title: "components/usePitchSwipe.ts", language: "ts", code: reactHook(setup, true) },
            { title: "Optional: static pages (app/layout.tsx)", language: "tsx", code: nextScript(setup) },
          ],
        },
        mark: {
          intro: ["Call the hook in a client component, with the test's flag name and your current text. With the optional next/script version, use data-pitchswipe attributes instead. " + keep],
          blocks: [{ title: "components/Hero.tsx", language: "tsx", code: reactUsage(setup, "./usePitchSwipe", true) }],
        },
      };
    case "vue":
      return {
        id,
        install: {
          intro: ["Add this composable once, for example as src/composables/usePitchSwipe.ts. It uses only your public client key."],
          blocks: [{ title: "src/composables/usePitchSwipe.ts", language: "ts", code: vueComposable(setup) }],
        },
        mark: {
          intro: ["Call it where the text is shown, with the test's flag name and your current text. Vue stays in charge of the page; no script edits it."],
          blocks: [{ title: "Hero.vue", language: "vue", code: vueUsage(setup) }],
        },
      };
    case "wordpress":
      return {
        id,
        install: {
          intro: ["Install a header and footer code plugin, for example WPCode.", "In the plugin, add a new snippet of type HTML, paste this, set the location to Site Wide Footer, and activate it."],
          blocks: [snippet],
        },
        mark: {
          intro: ["In the page editor, add a Custom HTML block where the text is and put the data-pitchswipe attribute on it. " + keep],
          blocks: [markupBlock(setup)],
        },
      };
    case "webflow":
      return {
        id,
        install: {
          intro: ["In Webflow open Site settings, then Custom code, and paste this into Footer code. In Framer open Site settings, then General, Custom code, and use End of body tag.", "Publish the site."],
          blocks: [snippet],
        },
        mark: {
          intro: ["Select the headline, price or reward element. In its settings, open Custom attributes (in Framer, the Attributes or code override panel) and add one attribute with the name and value below. " + keep],
          blocks: [attributeList(setup)],
        },
      };
    case "shopify":
      return {
        id,
        install: {
          intro: ["In Shopify admin open Online Store, then Themes, then Edit code. Open layout/theme.liquid and paste this just before </body>.", "Save."],
          blocks: [snippet],
        },
        mark: {
          intro: ["In the section file (for example sections/main-product.liquid or your hero section), add the attribute to the tag that shows the text. " + keep],
          blocks: [{ title: "sections/hero.liquid", language: "liquid", code: markupExample(flagsOf(setup).slice(0, 2)) }],
        },
      };
    default:
      return {
        id: "html",
        install: {
          intro: ["Paste it before </body> on your site. It uses only your public client key, so no secret leaves PitchSwipe."],
          blocks: [snippet],
        },
        mark: {
          intro: ["Add data-pitchswipe with the test's flag name. " + keep],
          blocks: [markupBlock(setup)],
        },
      };
  }
}

/** What "Copy snippet" puts on the clipboard: the install code for the chosen framework. */
export function installCopyText(s: FrameworkSetup): string {
  return s.install.blocks.map((b) => (s.install.blocks.length > 1 && b.title ? `// ${b.title}\n${b.code}` : b.code)).join("\n");
}

/** Plain-text email body for "Send to my developer" (a mail draft; nothing is sent from here). */
export function developerMessage(s: FrameworkSetup, domain: string): string {
  const block = (b: CodeBlock) => (b.title ? `${b.title}\n\n${b.code}` : b.code);
  return [
    "Hi,",
    `Please set up PitchSwipe on ${domain}. We use ${frameworkLabel(s.id)}. It only holds a public key.`,
    "1. Install",
    [...s.install.intro, ...s.install.blocks.map(block)].join("\n\n"),
    "2. Mark what each test controls",
    [...s.mark.intro, ...s.mark.blocks.map(block)].join("\n\n"),
  ].join("\n\n");
}
