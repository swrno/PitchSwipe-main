import { NextResponse } from "next/server";
import { NOT_CONFIGURED_MESSAGE } from "@/shared/lib/config";

/** The 503 every storage or sign-in route answers while the server is not configured. */
export function notConfiguredResponse(): NextResponse {
  return NextResponse.json({ error: NOT_CONFIGURED_MESSAGE, code: "not_configured" }, { status: 503 });
}
