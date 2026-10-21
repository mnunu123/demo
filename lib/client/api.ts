"use client";

// 브라우저에서 API를 부르는 함수. 접근 코드가 있으면 헤더에 붙인다.

const CODE_KEY = "lurk:access-code";

export function getAccessCode(): string {
  try {
    return window.localStorage.getItem(CODE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setAccessCode(code: string) {
  try {
    if (code) window.localStorage.setItem(CODE_KEY, code);
    else window.localStorage.removeItem(CODE_KEY);
  } catch {
    /* 저장이 막힌 브라우저에서는 이번 방문 동안만 쓴다 */
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly data: Record<string, unknown>,
  ) {
    super(message);
  }
}

export async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const code = getAccessCode();
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", ...(code ? { "x-access-code": code } : {}) },
    body: JSON.stringify(body),
  });
  let data: Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {
    /* 본문이 JSON이 아니면 아래에서 일반 오류로 처리 */
  }
  if (!res.ok) {
    const msg = typeof data.error === "string" ? data.error : `요청이 실패했어요 (${res.status})`;
    throw new ApiError(msg, res.status, data);
  }
  return data as T;
}

const HISTORY_KEY = "lurk:last-session";

export function saveSession(value: unknown) {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(value));
  } catch {
    /* 용량 초과나 저장 차단은 무시 */
  }
}

export function loadSession<T>(): T | null {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  try {
    window.localStorage.removeItem(HISTORY_KEY);
  } catch {
    /* 무시 */
  }
}
