"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StartForm } from "@/components/StartForm";
import { Button, Chip, SectionTitle, SourceBadge, cx } from "@/components/ui";
import { ApiError, clearSession, getAccessCode, loadSession, postJSON, saveSession, setAccessCode } from "@/lib/client/api";
import type {
  CollectResult,
  CommunityAnalysis,
  CommunityRef,
  CommunitySuggestion,
  GenerateResult,
  HealthInfo,
  Platform,
  ProductProfile,
  ShortsScript,
} from "@/lib/types";
import { GuidePanel } from "./GuidePanel";
import { Manuscript, editFromDraft, type DraftEdit } from "./Manuscript";
import { ShortsBoard } from "./ShortsBoard";
import { exportMarkdown } from "./export";

type StepKey = "product" | "communities" | "collect" | "analyze" | "generate";
type StepStatus = "wait" | "run" | "done" | "fail";
interface Step {
  key: StepKey;
  label: string;
  status: StepStatus;
  detail?: string;
}

const STEP_LABELS: Record<StepKey, string> = {
  product: "제품 페이지 읽기",
  communities: "어울리는 커뮤니티 고르기",
  collect: "커뮤니티 글 모으기",
  analyze: "말투와 반응 패턴 분석하기",
  generate: "게시글 초안과 쇼츠 대본 쓰기",
};

const freshSteps = (): Step[] =>
  (Object.keys(STEP_LABELS) as StepKey[]).map((key) => ({ key, label: STEP_LABELS[key], status: "wait" }));

export interface Session {
  url: string;
  platforms: Platform[];
  sample: boolean;
  profile: ProductProfile;
  suggestions: CommunitySuggestion[];
  order: string[];
  analyses: Record<string, CommunityAnalysis>;
  results: Record<string, GenerateResult>;
  failures: Record<string, string>;
  shorts: ShortsScript | null;
  edits: Record<string, DraftEdit>;
  notices: string[];
  savedAt: string;
}

const keyOf = (r: Pick<CommunityRef, "platform" | "id">) => `${r.platform}:${r.id}`;
const toRef = (s: CommunityRef): CommunityRef => ({ platform: s.platform, id: s.id, label: s.label, query: s.query });
const PLATFORM_SET = new Set<Platform>(["reddit", "x", "hn"]);

function hostOf(url: string) {
  try {
    return new URL(url.includes("://") ? url : `https://${url}`).hostname;
  } catch {
    return url;
  }
}

export default function Studio() {
  const params = useSearchParams();
  const router = useRouter();
  const urlParam = params.get("url")?.trim() ?? "";
  const sampleParam = params.get("sample") === "1";
  const platformsParam = useMemo(() => {
    const ps = params.getAll("p").flatMap((v) => v.split(",")).filter((v): v is Platform => PLATFORM_SET.has(v as Platform));
    return ps.length ? ps : (["reddit", "x", "hn"] as Platform[]);
  }, [params]);
  const runKey = `${sampleParam ? "sample" : urlParam}|${platformsParam.join(",")}`;

  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [phase, setPhase] = useState<"input" | "running" | "manual" | "done" | "error">("input");
  const [steps, setSteps] = useState<Step[]>(freshSteps);
  const [error, setError] = useState<string>("");
  const [session, setSession] = useState<Session | null>(null);
  const [activeTab, setActiveTab] = useState<string>("");
  const [activeDraft, setActiveDraft] = useState<Record<string, number>>({});
  const [mobilePane, setMobilePane] = useState<"guide" | "draft">("draft");
  const [busy, setBusy] = useState<string>("");
  const [showProfile, setShowProfile] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [restorable, setRestorable] = useState<Session | null>(() => loadSession<Session>());
  const [restored, setRestored] = useState(false);
  const started = useRef<string>("");
  const hasQuery = Boolean(urlParam || sampleParam);
  const view = hasQuery ? phase : restored && session ? "done" : "input";

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  const mark = useCallback((key: StepKey, status: StepStatus, detail?: string) => {
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, status, detail: detail ?? s.detail } : s)));
  }, []);

  const runPipeline = useCallback(
    async (input: { url: string; platforms: Platform[]; sample: boolean; manual?: { name: string; description: string } }) => {
      setPhase("running");
      setRestored(false);
      setError("");
      setSteps(freshSteps());
      const notices: string[] = [];
      const url = input.sample ? "https://shiplog.example" : input.url;

      // 1. 제품
      let profile: ProductProfile;
      mark("product", "run", input.sample ? "샘플 제품 Shiplog" : hostOf(url));
      try {
        const r = await postJSON<{ profile: ProductProfile; noticeKo?: string }>("/api/product", input.manual ? { url, manual: input.manual } : { url });
        profile = r.profile;
        if (r.noticeKo) notices.push(r.noticeKo);
        mark("product", "done", `${profile.name}${profile.extractedBy === "llm" ? ", LLM으로 정리" : profile.extractedBy === "heuristic" ? ", 페이지 내용으로 정리" : ""}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "제품 페이지를 읽지 못했어요.";
        mark("product", "fail", msg);
        if (e instanceof ApiError && e.data.needManual) {
          setError(msg);
          setPhase("manual");
        } else {
          setError(msg);
          setPhase("error");
        }
        return;
      }

      // 2. 커뮤니티 고르기
      mark("communities", "run");
      let suggestions: CommunitySuggestion[] = [];
      let selected: CommunitySuggestion[] = [];
      try {
        const r = await postJSON<{ suggestions: CommunitySuggestion[]; selected: string[] }>("/api/communities", {
          profile,
          platforms: input.platforms,
        });
        suggestions = r.suggestions;
        selected = r.selected.map((k) => suggestions.find((s) => keyOf(s) === k)).filter((s): s is CommunitySuggestion => Boolean(s));
        mark("communities", "done", selected.map((s) => s.label).join(", "));
      } catch (e) {
        mark("communities", "fail", e instanceof Error ? e.message : "");
        setError("커뮤니티를 고르지 못했어요.");
        setPhase("error");
        return;
      }

      // 3. 수집
      mark("collect", "run", `0/${selected.length}`);
      let count = 0;
      const failures: Record<string, string> = {};
      const collected: Record<string, CollectResult> = {};
      await Promise.all(
        selected.map(async (s) => {
          try {
            const res = await postJSON<CollectResult>("/api/collect", { community: toRef(s), preferSample: input.sample });
            collected[keyOf(s)] = res;
          } catch (e) {
            failures[keyOf(s)] = e instanceof Error ? e.message : "수집 실패";
          } finally {
            count += 1;
            mark("collect", "run", `${count}/${selected.length}`);
          }
        }),
      );
      const okKeys = selected.map(keyOf).filter((k) => collected[k]);
      const liveCount = okKeys.filter((k) => collected[k].source === "live").length;
      const postCount = okKeys.reduce((a, k) => a + collected[k].posts.length, 0);
      if (!okKeys.length) {
        mark("collect", "fail", "모든 커뮤니티에서 글을 모으지 못했어요");
        setError(Object.values(failures)[0] ?? "글을 모으지 못했어요.");
        setPhase("error");
        return;
      }
      mark("collect", "done", `글 ${postCount}개 (실시간 ${liveCount}곳, 샘플 ${okKeys.length - liveCount}곳)`);

      // 4. 분석
      mark("analyze", "run");
      const analyses: Record<string, CommunityAnalysis> = {};
      await Promise.all(
        okKeys.map(async (k) => {
          try {
            analyses[k] = await postJSON<CommunityAnalysis>("/api/analyze", { collected: collected[k], profile });
          } catch (e) {
            failures[k] = e instanceof Error ? e.message : "분석 실패";
          }
        }),
      );
      const analyzedKeys = okKeys.filter((k) => analyses[k]);
      mark("analyze", analyzedKeys.length ? "done" : "fail", `${analyzedKeys.length}곳`);
      if (!analyzedKeys.length) {
        setError("분석에 실패했어요.");
        setPhase("error");
        return;
      }

      // 5. 초안 + 쇼츠
      mark("generate", "run");
      const results: Record<string, GenerateResult> = {};
      let shorts: ShortsScript | null = null;
      await Promise.all([
        ...analyzedKeys.map(async (k) => {
          try {
            // 커뮤니티별 안내(noticeKo)는 그 탭 안에서 보여 준다
            results[k] = await postJSON<GenerateResult>("/api/generate", { profile, analysis: analyses[k] });
          } catch (e) {
            failures[k] = e instanceof Error ? e.message : "초안 실패";
          }
        }),
        (async () => {
          try {
            const r = await postJSON<{ script: ShortsScript; noticeKo?: string }>("/api/shorts", {
              profile,
              analyses: analyzedKeys.map((k) => analyses[k]),
            });
            shorts = r.script;
            if (r.noticeKo && !notices.includes(r.noticeKo)) notices.push(r.noticeKo);
          } catch {
            shorts = null;
          }
        })(),
      ]);
      const engines = new Set(Object.values(results).map((r) => r.engine));
      mark("generate", "done", engines.has("llm") ? "LLM으로 작성" : "템플릿으로 작성");

      const edits: Record<string, DraftEdit> = {};
      for (const r of Object.values(results)) for (const d of r.drafts) edits[d.id] = editFromDraft(d);

      const next: Session = {
        url,
        platforms: input.platforms,
        sample: input.sample,
        profile,
        suggestions,
        order: analyzedKeys.filter((k) => results[k]),
        analyses,
        results,
        failures,
        shorts,
        edits,
        notices,
        savedAt: new Date().toISOString(),
      };
      setSession(next);
      setActiveTab(next.order[0] ?? "shorts");
      setPhase("done");
    },
    [mark],
  );

  // 주소(쿼리)가 바뀌면 새로 분석
  useEffect(() => {
    if (!hasQuery) {
      started.current = ""; // 같은 URL을 다시 넣어도 새로 분석하도록
      return;
    }
    if (started.current === runKey) return;
    started.current = runKey;
    void runPipeline({ url: urlParam, platforms: platformsParam, sample: sampleParam });
  }, [hasQuery, runKey, urlParam, sampleParam, platformsParam, runPipeline]);

  // 결과와 고친 내용은 이 브라우저에만 저장
  useEffect(() => {
    if (!session) return;
    const t = window.setTimeout(() => saveSession(session), 500);
    return () => window.clearTimeout(t);
  }, [session]);

  const regenerate = useCallback(
    async (profile: ProductProfile, keys?: string[], opts: { tone?: string; length?: string } = {}) => {
      if (!session) return;
      const targets = keys ?? session.order;
      setBusy("초안을 다시 쓰는 중");
      const results = { ...session.results };
      const edits = { ...session.edits };
      const notices = session.notices;
      await Promise.all(
        targets.map(async (k) => {
          try {
            const r = await postJSON<GenerateResult>("/api/generate", { profile, analysis: session.analyses[k], ...opts });
            results[k] = r;
            for (const d of r.drafts) edits[d.id] = editFromDraft(d);
          } catch {
            /* 실패하면 원래 초안을 그대로 둔다 */
          }
        }),
      );
      let shorts = session.shorts;
      if (!keys) {
        try {
          const r = await postJSON<{ script: ShortsScript }>("/api/shorts", {
            profile,
            analyses: session.order.map((k) => session.analyses[k]),
            format: shorts?.format,
            seconds: shorts?.seconds,
          });
          shorts = r.script;
        } catch {
          /* 그대로 */
        }
      }
      setSession({ ...session, profile, results, edits, shorts, notices });
      setBusy("");
    },
    [session],
  );

  const refreshShorts = useCallback(
    async (o: { format: ShortsScript["format"]; seconds: number }) => {
      if (!session) return;
      setBusy("쇼츠 대본을 다시 쓰는 중");
      try {
        const r = await postJSON<{ script: ShortsScript }>("/api/shorts", {
          profile: session.profile,
          analyses: session.order.map((k) => session.analyses[k]),
          format: o.format,
          seconds: o.seconds,
        });
        setSession({ ...session, shorts: r.script });
      } finally {
        setBusy("");
      }
    },
    [session],
  );

  const addCommunity = useCallback(
    async (ref: CommunityRef, pasted?: { posts: string; rules?: string }) => {
      if (!session) return;
      const k = keyOf(ref);
      setBusy(`${ref.label} 분석 중`);
      try {
        const collected = await postJSON<CollectResult>("/api/collect", { community: toRef(ref), preferSample: session.sample, pasted });
        const analysis = await postJSON<CommunityAnalysis>("/api/analyze", { collected, profile: session.profile });
        const result = await postJSON<GenerateResult>("/api/generate", { profile: session.profile, analysis });
        const edits = { ...session.edits };
        for (const d of result.drafts) edits[d.id] = editFromDraft(d);
        const order = session.order.includes(k) ? session.order : [...session.order, k];
        setSession({ ...session, order, analyses: { ...session.analyses, [k]: analysis }, results: { ...session.results, [k]: result }, edits });
        setActiveTab(k);
        setShowAdd(false);
        return null;
      } catch (e) {
        return e instanceof Error ? e.message : "추가하지 못했어요";
      } finally {
        setBusy("");
      }
    },
    [session],
  );

  const removeCommunity = (k: string) => {
    if (!session) return;
    const order = session.order.filter((x) => x !== k);
    setSession({ ...session, order });
    if (activeTab === k) setActiveTab(order[0] ?? "shorts");
  };

  /* ---------- 화면 ---------- */

  return (
    <div className="min-h-dvh">
      <StudioHeader health={health} />

      <main className="mx-auto max-w-[1280px] px-4 pb-24 sm:px-6">
        {view === "input" && (
          <section className="mx-auto max-w-2xl pt-12 sm:pt-20">
            <h1 className="text-[30px] font-bold leading-tight sm:text-[36px]">어떤 제품을 올릴까요?</h1>
            <p className="mt-2 text-[16px] text-ink-soft">
              URL을 넣으면 제품을 읽고, 어울리는 커뮤니티의 지금 반응 좋은 글을 모아 분석한 뒤 초안을 써요.
            </p>
            <div className="mt-8">
              <StartForm />
            </div>
            {restorable && (
              <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-rule pt-6 text-[14px]">
                <span className="text-ink-soft">
                  지난번 분석: <span className="font-medium text-ink">{restorable.profile.name}</span>
                </span>
                <Button
                  size="sm"
                  onClick={() => {
                    setSession(restorable);
                    setActiveTab(restorable.order[0] ?? "shorts");
                    setRestored(true);
                  }}
                >
                  이어 보기
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    clearSession();
                    setRestorable(null);
                  }}
                >
                  지우기
                </Button>
              </div>
            )}
          </section>
        )}

        {(view === "running" || view === "manual" || view === "error") && (
          <section className="mx-auto max-w-2xl pt-12 sm:pt-16">
            <h1 className="text-[26px] font-bold leading-tight">{phase === "running" ? "먼저 눈팅하는 중이에요" : "여기서 막혔어요"}</h1>
            <ol className="mt-6 space-y-3">
              {steps.map((s, i) => (
                <li key={s.key} className="flex gap-3">
                  <span
                    aria-hidden
                    className={cx(
                      "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[12px] font-bold tabular-nums",
                      s.status === "done" && "border-good bg-good text-sheet",
                      s.status === "run" && "animate-pulse border-blue text-blue",
                      s.status === "fail" && "border-redpen bg-redpen text-sheet",
                      s.status === "wait" && "border-rule-strong text-ink-faint",
                    )}
                  >
                    {s.status === "done" ? "✓" : s.status === "fail" ? "!" : i + 1}
                  </span>
                  <span>
                    <span className={cx("block text-[16px]", s.status === "wait" ? "text-ink-faint" : "text-ink")}>{s.label}</span>
                    {s.detail && <span className="block text-[13px] text-ink-soft">{s.detail}</span>}
                  </span>
                </li>
              ))}
            </ol>
            {phase === "manual" && (
              <ManualForm
                error={error}
                onSubmit={(manual) => runPipeline({ url: urlParam, platforms: platformsParam, sample: false, manual })}
              />
            )}
            {phase === "error" && (
              <div className="mt-8 rounded-md border border-redpen/40 bg-redpen-wash px-4 py-3 text-[15px]">
                <p>{error}</p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => runPipeline({ url: urlParam, platforms: platformsParam, sample: sampleParam })}>
                    다시 시도
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => router.push("/studio")}>
                    다른 URL 넣기
                  </Button>
                </div>
              </div>
            )}
          </section>
        )}

        {view === "done" && session && (
          <Results
            session={session}
            setSession={setSession}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            activeDraft={activeDraft}
            setActiveDraft={setActiveDraft}
            mobilePane={mobilePane}
            setMobilePane={setMobilePane}
            busy={busy}
            showProfile={showProfile}
            setShowProfile={setShowProfile}
            showAdd={showAdd}
            setShowAdd={setShowAdd}
            onRegenerate={regenerate}
            onShorts={refreshShorts}
            onAdd={addCommunity}
            onRemove={removeCommunity}
            llmOn={Boolean(health && health.llm !== "none")}
          />
        )}
      </main>
    </div>
  );
}

/* ---------- 머리말 ---------- */

function StudioHeader({ health }: { health: HealthInfo | null }) {
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState(() => getAccessCode());
  return (
    <header className="border-b border-rule bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/75">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="font-serif text-[22px] font-semibold tracking-tight">
          Lurk
        </Link>
        <Link href="/studio" className="text-[14px] text-ink-soft hover:text-ink">
          새로 분석
        </Link>
        <Link href="/blueprint" className="text-[14px] text-ink-soft hover:text-ink">
          기획과 구조
        </Link>
        <div className="ml-auto flex flex-wrap items-center gap-1.5 text-[12px]" aria-label="연결 상태">
          {health ? (
            <>
              <StatusPill on={health.llm !== "none"} label={health.llm === "none" ? "LLM 없음: 템플릿 모드" : `LLM ${health.model ?? health.llm}`} />
              <StatusPill on={health.reddit === "oauth"} label={health.reddit === "oauth" ? "Reddit OAuth" : "Reddit 공개 주소(막힐 수 있음)"} />
              <StatusPill on={health.x} label={health.x ? "X 연결됨" : "X 키 없음"} />
              <StatusPill on label="HN 실시간" />
              {health.accessCodeRequired && (
                <button type="button" className="rounded-full border border-rule-strong px-2 py-0.5 hover:border-ink-faint" onClick={() => setCodeOpen((v) => !v)}>
                  접근 코드{code ? " 입력됨" : ""}
                </button>
              )}
            </>
          ) : (
            <span className="text-ink-faint">연결 상태 확인 중</span>
          )}
        </div>
      </div>
      {codeOpen && (
        <div className="mx-auto flex max-w-[1280px] items-center gap-2 px-4 pb-3 sm:px-6">
          <label htmlFor="access-code" className="text-[13px] text-ink-soft">
            접근 코드
          </label>
          <input
            id="access-code"
            className="h-8 rounded border border-rule-strong bg-sheet px-2 text-[14px]"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Button
            size="sm"
            onClick={() => {
              setAccessCode(code.trim());
              setCodeOpen(false);
            }}
          >
            저장
          </Button>
          <span className="text-[12px] text-ink-faint">코드가 맞으면 LLM으로, 아니면 템플릿으로 작성해요</span>
        </div>
      )}
    </header>
  );
}

function StatusPill({ on, label }: { on: boolean; label: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full border px-2 py-0.5", on ? "border-good/40 text-ink" : "border-rule-strong text-ink-soft")}>
      <span aria-hidden className={cx("h-1.5 w-1.5 rounded-full", on ? "bg-good" : "bg-ink-faint")} />
      {label}
    </span>
  );
}

/* ---------- URL을 못 읽었을 때 ---------- */

function ManualForm({ error, onSubmit }: { error: string; onSubmit: (m: { name: string; description: string }) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  return (
    <form
      className="mt-8 rounded-md border border-rule bg-sheet px-4 py-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim() && description.trim().length >= 10) onSubmit({ name: name.trim(), description: description.trim() });
      }}
    >
      <p className="text-[15px]">{error}</p>
      <p className="mt-1 text-[14px] text-ink-soft">
        상품 상세 글을 그대로 복사해 붙여 넣어도 돼요. 한국어도 되지만, LLM 키가 없으면 영어 초안에 채울 칸이 많이 남아요. 영어로 쓰면 바로 문장으로 들어가요.
      </p>
      <label className="mt-4 block text-[13px] font-medium" htmlFor="m-name">
        제품 이름
      </label>
      <input id="m-name" className="mt-1 h-10 w-full rounded border border-rule-strong bg-paper px-3" value={name} onChange={(e) => setName(e.target.value)} />
      <label className="mt-3 block text-[13px] font-medium" htmlFor="m-desc">
        설명 (첫 줄은 한 줄 소개, 다음 줄부터 기능을 한 줄씩)
      </label>
      <textarea
        id="m-desc"
        rows={8}
        maxLength={8000}
        className="mt-1 w-full rounded border border-rule-strong bg-paper px-3 py-2 font-serif"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={"Turns your git commits into release notes people actually read\n- drafts notes from merged PRs\n- hosted changelog page"}
      />
      <Button variant="primary" className="mt-3" type="submit">
        이 설명으로 계속
      </Button>
    </form>
  );
}

/* ---------- 결과 ---------- */

function Results(props: {
  session: Session;
  setSession: (s: Session) => void;
  activeTab: string;
  setActiveTab: (k: string) => void;
  activeDraft: Record<string, number>;
  setActiveDraft: (v: Record<string, number>) => void;
  mobilePane: "guide" | "draft";
  setMobilePane: (v: "guide" | "draft") => void;
  busy: string;
  showProfile: boolean;
  setShowProfile: (v: boolean) => void;
  showAdd: boolean;
  setShowAdd: (v: boolean) => void;
  onRegenerate: (p: ProductProfile, keys?: string[], opts?: { tone?: string; length?: string }) => Promise<void>;
  onShorts: (o: { format: ShortsScript["format"]; seconds: number }) => Promise<void>;
  onAdd: (ref: CommunityRef, pasted?: { posts: string; rules?: string }) => Promise<string | null | undefined>;
  onRemove: (k: string) => void;
  llmOn: boolean;
}) {
  const { session, activeTab } = props;
  const analysis = session.analyses[activeTab];
  const result = session.results[activeTab];
  const draftIndex = Math.min(props.activeDraft[activeTab] ?? 0, Math.max(0, (result?.drafts.length ?? 1) - 1));
  const draft = result?.drafts[draftIndex];
  const failed = Object.entries(session.failures).filter(([k]) => !session.order.includes(k));

  return (
    <div className="pt-6">
      {/* 제품 */}
      <section className="flex flex-wrap items-start justify-between gap-4 border-b border-rule pb-5">
        <div className="min-w-0 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[26px] font-bold leading-tight">{session.profile.name}</h1>
            {session.sample && <SourceBadge source="sample" />}
          </div>
          <p className="mt-1 font-serif text-[17px]">{session.profile.oneLiner}</p>
          {session.profile.oneLinerKo && <p className="text-[14px] text-ink-soft">{session.profile.oneLinerKo}</p>}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Chip>{session.profile.category}</Chip>
            {session.profile.audience.map((a) => (
              <Chip key={a}>{a}</Chip>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => props.setShowProfile(!props.showProfile)} aria-expanded={props.showProfile}>
            제품 정보 고치기
          </Button>
          <Button
            size="sm"
            onClick={() => {
              const md = exportMarkdown(session);
              const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `lurk-${session.profile.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "drafts"}.md`;
              a.click();
              URL.revokeObjectURL(a.href);
            }}
          >
            전체 내보내기 (.md)
          </Button>
        </div>
      </section>

      {props.showProfile && (
        <ProfileEditor
          profile={session.profile}
          busy={Boolean(props.busy)}
          onCancel={() => props.setShowProfile(false)}
          onSave={async (p) => {
            await props.onRegenerate(p);
            props.setShowProfile(false);
          }}
        />
      )}

      {(session.notices.length > 0 || failed.length > 0 || props.busy) && (
        <div className="mt-4 space-y-1 text-[13px] text-ink-soft" role="status">
          {props.busy && <p className="text-blue">{props.busy}…</p>}
          {session.notices.map((n) => (
            <p key={n}>{n}</p>
          ))}
          {failed.map(([k, msg]) => (
            <p key={k}>{msg}</p>
          ))}
        </div>
      )}

      {/* 탭 */}
      <nav className="no-scrollbar -mx-4 mt-5 flex gap-1 overflow-x-auto border-b border-rule px-4 sm:mx-0 sm:px-0" aria-label="커뮤니티">
        {session.order.map((k) => {
          const a = session.analyses[k];
          return (
            <button
              key={k}
              type="button"
              onClick={() => props.setActiveTab(k)}
              aria-current={activeTab === k ? "page" : undefined}
              className={cx(
                "-mb-px shrink-0 border-b-2 px-3 py-2.5 text-[15px] transition-colors",
                activeTab === k ? "border-ink font-bold text-ink" : "border-transparent text-ink-soft hover:text-ink",
              )}
            >
              {a.community.label}
              {a.source !== "live" && <span className="ml-1 text-[11px] font-normal text-ink-faint">{a.source === "sample" ? "샘플" : "붙여넣기"}</span>}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => props.setActiveTab("shorts")}
          aria-current={activeTab === "shorts" ? "page" : undefined}
          className={cx(
            "-mb-px shrink-0 border-b-2 px-3 py-2.5 text-[15px]",
            activeTab === "shorts" ? "border-ink font-bold text-ink" : "border-transparent text-ink-soft hover:text-ink",
          )}
        >
          쇼츠 대본
        </button>
        <button
          type="button"
          onClick={() => props.setShowAdd(!props.showAdd)}
          aria-expanded={props.showAdd}
          className="-mb-px shrink-0 border-b-2 border-transparent px-3 py-2.5 text-[15px] text-blue hover:underline"
        >
          커뮤니티 추가
        </button>
      </nav>

      {props.showAdd && <AddCommunity session={session} busy={Boolean(props.busy)} onAdd={props.onAdd} onClose={() => props.setShowAdd(false)} />}

      {activeTab === "shorts" ? (
        <div className="mx-auto mt-8 max-w-4xl">
          <ShortsBoard script={session.shorts} busy={Boolean(props.busy)} onChange={props.onShorts} />
        </div>
      ) : analysis && result ? (
        <>
          <div className="mt-4 flex gap-1 rounded-md border border-rule bg-sheet p-1 lg:hidden" role="tablist" aria-label="보기 전환">
            {(["draft", "guide"] as const).map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={props.mobilePane === p}
                onClick={() => props.setMobilePane(p)}
                className={cx("flex-1 rounded px-3 py-1.5 text-[14px]", props.mobilePane === p ? "bg-ink text-sheet" : "text-ink-soft")}
              >
                {p === "draft" ? "원고" : "현지 가이드"}
              </button>
            ))}
          </div>
          <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <div className={cx(props.mobilePane === "guide" ? "block" : "hidden", "lg:block")}>
              <GuidePanel analysis={analysis} part="overview" />
              <div className="mt-8 border-t border-rule pt-4">
                <Button size="sm" variant="ghost" onClick={() => props.onRemove(activeTab)}>
                  이 커뮤니티 빼기
                </Button>
              </div>
            </div>
            <div className={cx(props.mobilePane === "draft" ? "block" : "hidden", "lg:block")}>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap gap-1" role="tablist" aria-label="초안 종류">
                  {result.drafts.map((d, i) => (
                    <button
                      key={d.id}
                      type="button"
                      role="tab"
                      aria-selected={i === draftIndex}
                      onClick={() => props.setActiveDraft({ ...props.activeDraft, [activeTab]: i })}
                      className={cx(
                        "rounded-full border px-3 py-1 text-[14px]",
                        i === draftIndex ? "border-ink bg-ink text-sheet" : "border-rule-strong text-ink hover:border-ink-faint",
                      )}
                    >
                      {d.angleKo}
                    </button>
                  ))}
                </div>
                <span className="ml-auto text-[12px] text-ink-faint">{result.engine === "llm" ? "LLM 초안" : "템플릿 초안"}</span>
              </div>
              {result.noticeKo && <p className="mb-3 text-[13px] text-ink-soft">{result.noticeKo}</p>}
              {draft && (
                <Manuscript
                  key={draft.id}
                  draft={draft}
                  edit={session.edits[draft.id] ?? editFromDraft(draft)}
                  onEdit={(e) => props.setSession({ ...session, edits: { ...session.edits, [draft.id]: e } })}
                  onReset={() => props.setSession({ ...session, edits: { ...session.edits, [draft.id]: editFromDraft(draft) } })}
                  analysis={analysis}
                  productName={session.profile.name}
                  productUrl={session.profile.url}
                />
              )}
              {draft && draft.mode === "draft" && (
                <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-rule pt-4">
                  <span className="text-[13px] text-ink-soft">다시 쓰기</span>
                  {props.llmOn ? (
                    <>
                      {[
                        { label: "더 짧게", opts: { length: "shorter" } },
                        { label: "더 편한 말투로", opts: { tone: "more casual" } },
                        { label: "더 기술적으로", opts: { tone: "more technical" } },
                      ].map((b) => (
                        <Button key={b.label} size="sm" disabled={Boolean(props.busy)} onClick={() => props.onRegenerate(session.profile, [activeTab], b.opts)}>
                          {b.label}
                        </Button>
                      ))}
                    </>
                  ) : (
                    <span className="text-[13px] text-ink-faint">LLM 키를 연결하면 말투와 길이를 바꿔 다시 쓸 수 있어요</span>
                  )}
                </div>
              )}
              <div className="mt-10 border-t border-rule pt-6">
                <GuidePanel analysis={analysis} part="reference" />
              </div>
            </div>
          </div>
        </>
      ) : (
        <p className="mt-8 text-ink-soft">이 커뮤니티 결과가 없어요.</p>
      )}
    </div>
  );
}

/* ---------- 제품 정보 고치기 ---------- */

function ProfileEditor({
  profile,
  busy,
  onSave,
  onCancel,
}: {
  profile: ProductProfile;
  busy: boolean;
  onSave: (p: ProductProfile) => Promise<void>;
  onCancel: () => void;
}) {
  const [p, setP] = useState(profile);
  const lines = (xs: string[]) => xs.join("\n");
  const split = (s: string) =>
    s
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);
  const field = "mt-1 w-full rounded border border-rule-strong bg-paper px-3 py-2 text-[15px]";
  return (
    <form
      className="mt-4 grid gap-4 rounded-md border border-rule bg-sheet px-4 py-4 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        await onSave(p);
      }}
    >
      <p className="text-[14px] text-ink-soft sm:col-span-2">
        초안은 이 정보로만 써요. 영어로 적어야 초안에 그대로 들어가요. 저장하면 모든 초안을 새로 쓰고, 고친 내용은 새 초안으로 바뀌어요.
      </p>
      <label className="text-[13px] font-medium">
        제품 이름
        <input className={field} value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
      </label>
      <label className="text-[13px] font-medium">
        가격 (영어)
        <input className={field} value={p.pricing} placeholder="free for one project, $9/month after that" onChange={(e) => setP({ ...p, pricing: e.target.value })} />
      </label>
      <label className="text-[13px] font-medium sm:col-span-2">
        한 줄 소개 (영어, &quot;Turns X into Y&quot;처럼 동사로 시작하면 자연스러워요)
        <input className={cx(field, "font-serif")} value={p.oneLiner} onChange={(e) => setP({ ...p, oneLiner: e.target.value })} />
      </label>
      <label className="text-[13px] font-medium">
        해결하는 불편 (영어, 한 줄에 하나, ~ing 형태)
        <textarea rows={3} className={cx(field, "font-serif")} value={lines(p.problems)} onChange={(e) => setP({ ...p, problems: split(e.target.value) })} />
      </label>
      <label className="text-[13px] font-medium">
        기능 (영어, 한 줄에 하나)
        <textarea rows={3} className={cx(field, "font-serif")} value={lines(p.features)} onChange={(e) => setP({ ...p, features: split(e.target.value) })} />
      </label>
      <label className="text-[13px] font-medium">
        누구를 위한 제품인지 (영어, 한 줄에 하나)
        <textarea rows={2} className={cx(field, "font-serif")} value={lines(p.audience)} onChange={(e) => setP({ ...p, audience: split(e.target.value) })} />
      </label>
      <label className="text-[13px] font-medium">
        단계
        <select className={field} value={p.stage} onChange={(e) => setP({ ...p, stage: e.target.value as ProductProfile["stage"] })}>
          <option value="idea">아이디어 (대기자 명단)</option>
          <option value="beta">베타</option>
          <option value="launched">출시</option>
          <option value="unknown">모름</option>
        </select>
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <Button variant="primary" type="submit" disabled={busy}>
          {busy ? "새로 쓰는 중" : "저장하고 초안 새로 쓰기"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          취소
        </Button>
      </div>
    </form>
  );
}

/* ---------- 커뮤니티 추가 ---------- */

function AddCommunity({
  session,
  busy,
  onAdd,
  onClose,
}: {
  session: Session;
  busy: boolean;
  onAdd: (ref: CommunityRef, pasted?: { posts: string; rules?: string }) => Promise<string | null | undefined>;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"list" | "paste">("list");
  const [err, setErr] = useState("");
  const [platform, setPlatform] = useState<Platform>("reddit");
  const [name, setName] = useState("");
  const [posts, setPosts] = useState("");
  const [rules, setRules] = useState("");
  const candidates = session.suggestions.filter((s) => !session.order.includes(keyOf(s))).slice(0, 18);

  return (
    <section className="mt-4 rounded-md border border-rule bg-sheet px-4 py-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SectionTitle>커뮤니티 추가</SectionTitle>
        <div className="ml-auto flex gap-1">
          <Button size="sm" variant={mode === "list" ? "primary" : "quiet"} onClick={() => setMode("list")}>
            추천 목록
          </Button>
          <Button size="sm" variant={mode === "paste" ? "primary" : "quiet"} onClick={() => setMode("paste")}>
            직접 붙여넣기
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>
            닫기
          </Button>
        </div>
      </div>
      {err && <p className="mb-3 text-[14px] text-redpen">{err}</p>}
      {mode === "list" ? (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {candidates.map((c) => (
            <li key={keyOf(c)}>
              <button
                type="button"
                disabled={busy}
                className="w-full rounded border border-rule px-3 py-2 text-left hover:border-rule-strong disabled:opacity-50"
                onClick={async () => {
                  setErr("");
                  const e = await onAdd(c);
                  if (e) setErr(e);
                }}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{c.label}</span>
                  <span className="text-[12px] tabular-nums text-ink-faint">어울림 {c.fit}</span>
                </span>
                <span className="block text-[13px] text-ink-soft">{c.topicKo}</span>
                <span className="block text-[12px] text-ink-faint">
                  {c.reasonKo}
                  {c.hasSample ? "" : ", 실시간 수집이 안 되면 건너뛰어요"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <form
          className="grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setErr("");
            const id = name.trim().replace(/^r\//i, "").replace(/[^\w.-]+/g, "-").slice(0, 60) || "pasted";
            const label = platform === "reddit" ? `r/${id}` : name.trim() || "붙여 넣은 커뮤니티";
            const out = await onAdd({ platform, id: `pasted-${id}`, label }, { posts, rules });
            if (out) setErr(out);
          }}
        >
          <p className="text-[14px] text-ink-soft">
            API로 가져올 수 없는 곳도 분석할 수 있어요. 그 커뮤니티에서 반응 좋은 글을 직접 복사해 붙여 넣으세요. 글마다 <code>---</code> 줄로 나누고, 첫 줄은 제목,
            나머지는 본문이에요. 점수를 알면 첫 줄을 <code>120 | 제목</code>처럼 쓰세요.
          </p>
          <div className="flex flex-wrap gap-3">
            <label className="text-[13px] font-medium">
              어떤 형식의 글인가요
              <select className="mt-1 block h-9 rounded border border-rule-strong bg-paper px-2" value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}>
                <option value="reddit">게시판형 (제목 + 본문)</option>
                <option value="x">짧은 글형 (X, Threads 등)</option>
                <option value="hn">Show HN형</option>
              </select>
            </label>
            <label className="min-w-[14rem] flex-1 text-[13px] font-medium">
              커뮤니티 이름
              <input className="mt-1 block h-9 w-full rounded border border-rule-strong bg-paper px-2" value={name} placeholder="예: r/selfhosted" onChange={(e) => setName(e.target.value)} />
            </label>
          </div>
          <label className="text-[13px] font-medium">
            글 (3개 이상)
            <textarea rows={8} className="mt-1 w-full rounded border border-rule-strong bg-paper px-3 py-2 font-serif text-[14px]" value={posts} onChange={(e) => setPosts(e.target.value)} />
          </label>
          <label className="text-[13px] font-medium">
            규칙 (선택, 한 줄에 하나)
            <textarea rows={3} className="mt-1 w-full rounded border border-rule-strong bg-paper px-3 py-2 text-[14px]" value={rules} onChange={(e) => setRules(e.target.value)} />
          </label>
          <div>
            <Button variant="primary" type="submit" disabled={busy || posts.trim().length < 20}>
              붙여 넣은 글로 분석
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
