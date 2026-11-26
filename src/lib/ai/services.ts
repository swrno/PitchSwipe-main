/**
 * Typed access to the AI engine in ./engine (WP12; was services/ai). The JS package has no types and tsconfig has allowJs off, so
 * the module is cast to the hand-written `AiServices` in services-ai.d.ts. Import from `@/lib/ai`,
 * not from this file.
 */
// @ts-expect-error TS7016: plain JavaScript package, typed by services-ai.d.ts
import * as raw from "./engine/src/index.js";

import type { AiServices } from "./services-ai";

export const ai = raw as unknown as AiServices;
