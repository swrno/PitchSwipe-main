// Run: npm test -- frameworks
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import ts from "typescript";

import {
  buildFrameworkSetup,
  developerMessage,
  FRAMEWORKS,
  installCopyText,
  type FrameworkId,
} from "../frameworks";
import { PLACEHOLDER_KEY } from "../snippet";
import type { SiteSetup } from "../types";

const KEY = "PublicClientKey123";
const SETUP: SiteSetup = {
  envKey: KEY,
  siteId: "site1",
  baseUrl: "https://pitchswipe.app/x",
  flags: [
    { flagName: "voice-khata_headline", text: 'Talk to your "ledger"', tag: "h1" },
    { flagName: "voice-khata_price", text: "Rs 99 </script>", tag: "span" },
  ],
};
const ids = FRAMEWORKS.map((f) => f.id);

function allCode(id: FrameworkId, setup = SETUP) {
  const s = buildFrameworkSetup(id, setup);
  return [...s.install.blocks, ...s.mark.blocks];
}

function assertParses(code: string, fileName: string) {
  const out = ts.transpileModule(code, {
    fileName,
    reportDiagnostics: true,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext },
  });
  const msgs = (out.diagnostics ?? []).map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
  assert.deepEqual(msgs, [], `${fileName}: ${msgs.join("; ")}`);
}

describe("framework setups", () => {
  for (const id of ids) {
    it(`${id}: has the public key (where it is code), the flags and no secret`, () => {
      const s = buildFrameworkSetup(id, SETUP);
      const text = developerMessage(s, "example.com") + installCopyText(s);
      for (const f of SETUP.flags) assert.ok(text.includes(f.flagName), `${f.flagName} missing`);
      assert.ok(!/\bser\.[A-Za-z0-9]|api-key\s|token\s[A-Za-z0-9]/i.test(text));
      assert.ok(installCopyText(s).includes(KEY));
      assert.ok(developerMessage(s, "example.com").includes(FRAMEWORKS.find((f) => f.id === id)!.label));
    });
  }

  it("every variant carries the flags URL and ping URL", () => {
    for (const id of ids) {
      const t = installCopyText(buildFrameworkSetup(id, SETUP));
      assert.ok(t.includes("https://edge.api.flagsmith.com/api/v1/flags/"), id);
      assert.ok(t.includes("https://pitchswipe.app/api/sites/ping?s=site1"), id);
    }
  });

  it("html keeps the existing script before </body> and data-pitchswipe markup", () => {
    const s = buildFrameworkSetup("html", SETUP);
    assert.ok(s.install.blocks[0].code.startsWith("<script>"));
    assert.ok(s.mark.blocks[0].code.includes('data-pitchswipe="voice-khata_headline"'));
  });

  it("react, next and vue pass the current text as the fallback and do not mutate the DOM", () => {
    for (const id of ["react", "next", "vue"] as const) {
      const code = allCode(id).filter((b) => !b.title?.startsWith("Optional")).map((b) => b.code).join("\n");
      assert.ok(code.includes('"Talk to your \\"ledger\\""'), id);
      assert.ok(!code.includes("querySelectorAll"), id);
    }
    assert.ok(buildFrameworkSetup("next", SETUP).install.blocks[0].code.startsWith('"use client"'));
  });

  it("JS/TS/JSX/Vue code is syntactically valid", () => {
    for (const id of ["react", "next"] as const) {
      for (const b of allCode(id)) assertParses(b.code, b.language === "tsx" ? "a.tsx" : "a.ts");
    }
    for (const b of allCode("vue")) {
      if (b.language === "ts") assertParses(b.code, "a.ts");
      else {
        const m = /<script setup lang="ts">([\s\S]*?)<\/script>/.exec(b.code);
        assert.ok(m);
        assertParses(m[1], "a.ts");
        assert.ok(b.code.includes("<template>") && b.code.includes("{{ "));
      }
    }
    for (const id of ["html", "wordpress", "webflow", "shopify"] as const) {
      const m = /^<script>\n([\s\S]*)\n<\/script>$/.exec(buildFrameworkSetup(id, SETUP).install.blocks[0].code);
      assert.ok(m, id);
      assertParses(m[1], "a.js");
    }
  });

  it("placeholder key and no flags still produce valid code", () => {
    const empty: SiteSetup = { ...SETUP, envKey: PLACEHOLDER_KEY, flags: [] };
    for (const id of ids) {
      const s = buildFrameworkSetup(id, empty);
      for (const b of [...s.install.blocks, ...s.mark.blocks]) {
        if (b.language === "ts" || b.language === "tsx") assertParses(b.code, b.language === "tsx" ? "a.tsx" : "a.ts");
      }
    }
  });

  it("rejects server keys", () => {
    assert.throws(() => buildFrameworkSetup("react", { ...SETUP, envKey: "ser.abcdefghijklmnop" }), /server key/);
  });
});
