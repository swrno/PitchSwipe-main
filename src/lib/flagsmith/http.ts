/** Injectable HTTP client so every Flagsmith call is unit-testable with canned responses. */

export interface HttpRequest {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  headers: Record<string, string>;
  body?: unknown;
}

export interface HttpResponse {
  status: number;
  /** Parsed JSON body, or null when empty / not JSON. */
  json: unknown;
}

export type HttpClient = (request: HttpRequest) => Promise<HttpResponse>;

/** Default client: global fetch with a timeout. */
export function createFetchClient(timeoutMs = 15_000): HttpClient {
  return async (request) => {
    const response = await fetch(request.url, {
      method: request.method,
      headers: {
        Accept: "application/json",
        ...(request.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...request.headers,
      },
      body: request.body !== undefined ? JSON.stringify(request.body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    const text = await response.text();
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }
    return { status: response.status, json };
  };
}
