// API 보호: 공개 배포했을 때 남이 내 LLM 키를 마구 쓰지 못하게 한다.
// ACCESS_CODE를 설정하면 코드를 넣은 사람만 LLM을 쓰고, 나머지는 템플릿 모드로 돌아간다.
// 사용량 제한은 서버 인스턴스 메모리 기준이라 대략적인 보호다. 실서비스는 Upstash 같은 외부 저장소로 바꿔야 한다.

const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = Number(process.env.LLM_RATE_LIMIT || 40);
const hits = new Map<string, { count: number; reset: number }>();

function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

export function accessCodeRequired(): boolean {
  return Boolean(process.env.ACCESS_CODE);
}

/** 이 요청에서 LLM을 써도 되는지. false면 템플릿 모드로 처리한다. */
export function canUseLLM(req: Request): { ok: boolean; reasonKo?: string } {
  const code = process.env.ACCESS_CODE;
  if (code && req.headers.get("x-access-code") !== code) {
    return { ok: false, reasonKo: "접근 코드가 없어서 템플릿 모드로 보여 줘요" };
  }
  const ip = clientIp(req);
  const now = Date.now();
  const cur = hits.get(ip);
  if (!cur || cur.reset < now) {
    hits.set(ip, { count: 1, reset: now + WINDOW_MS });
    return { ok: true };
  }
  if (cur.count >= LIMIT) return { ok: false, reasonKo: "10분 동안 LLM 호출 한도를 넘어서 템플릿 모드로 보여 줘요" };
  cur.count += 1;
  return { ok: true };
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  return Response.json(data, { ...init, headers: { "cache-control": "no-store", ...(init.headers ?? {}) } });
}

export function errorKo(messageKo: string, status = 400): Response {
  return json({ error: messageKo }, { status });
}

export async function readJson<T>(req: Request, maxBytes = 2_000_000): Promise<T | null> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) return null;
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
