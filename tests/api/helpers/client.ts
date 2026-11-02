import { APIResponse, expect } from "@playwright/test";

// Mirrors the envelope shapes from src/utils/apiResponse.ts: sendSuccess() -> {data, meta?},
// sendError() -> {data: {}, error: {code, message, details?}}. Every spec asserts through these
// two helpers instead of re-checking the envelope shape inline everywhere.

export interface SuccessEnvelope<T = unknown> {
  data: T;
  meta?: Record<string, unknown>;
}

export interface ErrorEnvelope {
  data: Record<string, never>;
  error: { code: string; message: string; details?: Array<{ field?: string; message: string }> };
}

export async function expectSuccess<T = unknown>(response: APIResponse, status = 200): Promise<SuccessEnvelope<T>> {
  const body = await response.json().catch(() => undefined);
  expect(
    response.status(),
    `expected ${status}, got ${response.status()} for ${response.url()} — body: ${JSON.stringify(body)}`
  ).toBe(status);
  expect(body).toHaveProperty("data");
  return body as SuccessEnvelope<T>;
}

export async function expectError(response: APIResponse, status: number, code?: string): Promise<ErrorEnvelope> {
  const body = await response.json().catch(() => undefined);
  expect(
    response.status(),
    `expected ${status}, got ${response.status()} for ${response.url()} — body: ${JSON.stringify(body)}`
  ).toBe(status);
  expect(body).toHaveProperty("error");
  if (code) {
    expect(body.error.code).toBe(code);
  }
  return body as ErrorEnvelope;
}
