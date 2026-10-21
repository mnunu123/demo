import Link from "next/link";
import { StartForm } from "@/components/StartForm";
import { scoreAdSmell } from "@/lib/analysis/adsmell";
import { analyzeCommunity } from "@/lib/analysis/community";
import { analyzeRules } from "@/lib/analysis/rules";
import { findPlaceholders } from "@/lib/analysis/fit";
import { getSample } from "@/lib/fixtures/communities";
import { SAMPLE_PRODUCT } from "@/lib/fixtures/sample-product";
import { templateDrafts } from "@/lib/generate/templates";
import type { CommunityRef, Draft } from "@/lib/types";

const AD_TEXT = "🚀 Introducing Shiplog — the revolutionary AI-powered changelog tool every developer needs! Sign up now!!";
const LOCAL_TEXT =
  "I got tired of writing release notes by hand, so I built a small tool that drafts them from my git commits. It's free while it's in beta. Would you use something like this, or is it a non-problem for you?";

function sampleDraft(ref: Pick<CommunityRef, "platform" | "id">): Draft | null {
  const s = getSample(ref, new Date("2026-10-21T00:00:00Z"));
  if (!s) return null;
  const stats = analyzeCommunity(s.posts, s.community.platform);
  const rules = analyzeRules(s.rules, s.community.platform, s.about?.description);
  return templateDrafts({ profile: SAMPLE_PRODUCT, ref: s.community, stats, rules })[0] ?? null;
}

function Filled({ text }: { text: string }) {
  const parts = findPlaceholders(text);
  const out: React.ReactNode[] = [];
  let pos = 0;
  parts.forEach((p, i) => {
    if (p.start > pos) out.push(text.slice(pos, p.start));
    out.push(
      <span key={i} className="mark-fill px-0.5">
        {p.text}
      </span>,
    );
    pos = p.end;
  });
  if (pos < text.length) out.push(text.slice(pos));
  return <>{out}</>;
}

function Highlight({ text, phrases }: { text: string; phrases: string[] }) {
  const out: React.ReactNode[] = [];
  let rest = text;
  let key = 0;
  while (rest.length) {
    const hit = phrases
      .map((p) => ({ p, i: rest.indexOf(p) }))
      .filter((x) => x.i >= 0)
      .sort((a, b) => a.i - b.i)[0];
    if (!hit) {
      out.push(rest);
      break;
    }
    if (hit.i > 0) out.push(rest.slice(0, hit.i));
    out.push(
      <mark key={key++} className="mark-local">
        {hit.p}
      </mark>,
    );
    rest = rest.slice(hit.i + hit.p.length);
  }
  return <>{out}</>;
}

export default function Home() {
  const ad = scoreAdSmell({ body: AD_TEXT, platform: "reddit" });
  const local = scoreAdSmell({ body: LOCAL_TEXT, platform: "reddit" });
  const adNotes = [...new Set([...ad.hits].sort((a, b) => b.weight - a.weight).map((h) => h.noteKo))].slice(0, 4);

  const reddit = sampleDraft({ platform: "reddit", id: "SideProject" });
  const x = sampleDraft({ platform: "x", id: "buildinpublic" });
  const hn = sampleDraft({ platform: "hn", id: "show_hn" });

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-[1180px] items-center gap-5 px-4 py-4 sm:px-6">
        <Link href="/" className="font-serif text-[24px] font-semibold tracking-tight">
          Lurk
        </Link>
        <nav className="ml-auto flex items-center gap-4 text-[15px]">
          <Link href="/studio?sample=1" className="text-ink-soft hover:text-ink">
            체험하기
          </Link>
          <Link href="/blueprint" className="text-ink-soft hover:text-ink">
            기획과 구조
          </Link>
          <a href="https://github.com/mnunu123/demo" className="text-ink-soft hover:text-ink" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </nav>
      </header>

      <main>
        {/* 첫 화면 */}
        <section className="mx-auto grid max-w-[1180px] items-start gap-10 px-4 pb-16 pt-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14 lg:pt-16">
          <div className="lg:pt-6">
            <h1 className="text-[40px] font-bold leading-[1.15] tracking-tight sm:text-[52px]">
              <span className="block">올리기 전에,</span>
              <span className="block">그 동네 글부터</span>
              <span className="block">읽어 드려요.</span>
            </h1>
            <p className="mt-5 max-w-[34rem] text-[17px] leading-relaxed text-ink-soft">
              제품 URL만 넣으면 Reddit, X, Hacker News에서 지금 반응 좋은 글의 패턴과 말투를 분석해서, 그 커뮤니티에 맞는 게시글과 쇼츠 대본을 써 드려요.
              광고처럼 읽히는 문장은 빨간 펜으로 표시해요.
            </p>
            <div className="mt-8 max-w-[34rem]">
              <StartForm />
            </div>
          </div>

          <figure className="sheet relative px-5 py-6 sm:px-8 sm:py-8" aria-label="광고 같은 문장과 커뮤니티 말투로 고친 문장 비교">
            <div className="grid gap-x-6 sm:grid-cols-[minmax(0,1fr)_9.5rem]">
              <p className="manuscript text-[19px] leading-relaxed">
                <span className="strike strike-animate">{AD_TEXT}</span>
              </p>
              <div className="note-animate mt-3 -rotate-2 sm:mt-0" aria-label={`광고 냄새 ${ad.score}점`}>
                <div className="pen text-[30px]">광고 냄새 {ad.score}점</div>
                <ul className="pen mt-1 space-y-0.5 text-[21px]">
                  {adNotes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="my-6 border-t border-dashed border-rule-strong" />

            <div className="grid gap-x-6 sm:grid-cols-[minmax(0,1fr)_9.5rem]">
              <p className="manuscript text-[19px] leading-relaxed">
                <Highlight text={LOCAL_TEXT} phrases={["I got tired of", "so I built", "Would you use something like this"]} />
              </p>
              <div className="mt-3 sm:mt-0">
                <div className="text-[15px] font-bold text-good">광고 냄새 {local.score}점</div>
                <ul className="mt-1 space-y-0.5 text-[13px] text-ink-soft">
                  {local.goodSignalsKo.slice(0, 3).map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
              </div>
            </div>
            <figcaption className="mt-6 text-[12px] text-ink-faint">점수는 이 데모의 실제 채점기로 계산한 값이에요.</figcaption>
          </figure>
        </section>

        {/* 동네마다 다른 글 */}
        <section className="border-y border-rule bg-sheet/60">
          <div className="mx-auto max-w-[1180px] px-4 py-14 sm:px-6">
            <h2 className="text-[28px] font-bold leading-tight">같은 제품도 동네마다 다르게 써요</h2>
            <p className="mt-2 max-w-2xl text-[16px] text-ink-soft">
              가상의 제품 Shiplog로 만든 실제 결과예요. 샘플(합성) 데이터로 분석했고, 파란 칸은 만든 사람만 채울 수 있는 내용이에요.
            </p>
            <div className="mt-8 grid gap-8 md:grid-cols-3 md:gap-0 md:divide-x md:divide-rule">
              {[
                { label: "r/SideProject", sub: "1인칭 만든 이야기, 링크는 첫 댓글로", d: reddit },
                { label: "X #buildinpublic", sub: "짧게 끊어 쓰는 스레드", d: x },
                { label: "Show HN", sub: "AI가 쓴 글 금지라서 뼈대만", d: hn },
              ].map(({ label, sub, d }) => (
                <article key={label} className="md:px-6 md:first:pl-0 md:last:pr-0">
                  <h3 className="text-[17px] font-bold">{label}</h3>
                  <p className="text-[14px] text-ink-soft">{sub}</p>
                  {d && (
                    <div className="manuscript mt-4 text-[16px]">
                      {d.title && (
                        <p className="mb-2 font-semibold">
                          <Filled text={d.title} />
                        </p>
                      )}
                      <p className="whitespace-pre-line">
                        <Filled text={(d.thread?.[0] ?? d.body).split("\n\n").slice(0, 2).join("\n\n")} />
                      </p>
                    </div>
                  )}
                </article>
              ))}
            </div>
            <Link href="/studio?sample=1" className="mt-10 inline-block rounded-md bg-ink px-5 py-3 text-[15px] font-bold text-sheet hover:brightness-125">
              샘플 제품으로 전체 결과 보기
            </Link>
          </div>
        </section>

        {/* 진행 순서 */}
        <section className="mx-auto max-w-[1180px] px-4 py-16 sm:px-6">
          <h2 className="text-[28px] font-bold leading-tight">이렇게 진행돼요</h2>
          <ol className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["제품 읽기", "URL을 열어 무엇을, 누구에게, 얼마에 파는지 정리해요. 못 읽으면 직접 설명을 받아요."],
              ["먼저 눈팅", "고른 커뮤니티의 이번 주 상위글과 최근 글, 규칙을 모아요. 실시간 수집이 막히면 샘플이라고 표시해요."],
              ["패턴 분석", "제목 길이, 대소문자, 말투, 잘 되는 글 유형, 올리는 시간, 광고 냄새 기준선을 계산해요."],
              ["초안과 점검", "그 동네 문법으로 초안과 쇼츠 대본을 쓰고, 고칠 때마다 광고 냄새와 규칙 위반을 바로 표시해요."],
            ].map(([t, d], i) => (
              <li key={t} className="border-t-2 border-ink pt-4">
                <div className="text-[13px] font-bold tabular-nums text-ink-soft">{i + 1}</div>
                <h3 className="mt-1 text-[18px] font-bold">{t}</h3>
                <p className="mt-2 text-[15px] text-ink-soft">{d}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* 하지 않는 것 */}
        <section className="mx-auto max-w-[1180px] px-4 pb-20 sm:px-6">
          <h2 className="text-[28px] font-bold leading-tight">이건 안 해요</h2>
          <p className="mt-2 max-w-2xl text-[16px] text-ink-soft">커뮤니티를 속이는 홍보는 걸리면 계정이 막히고, 걸리지 않아도 신뢰를 잃어요.</p>
          <ul className="mt-8 grid gap-x-10 gap-y-6 sm:grid-cols-2">
            {[
              ["대신 올리기", "올리는 건 직접 해요. 자동 게시와 자동 댓글은 대부분의 커뮤니티에서 스팸으로 봐요."],
              ["남인 척하기", "제품 이야기를 할 땐 만든 사람이라는 문장을 기본으로 넣어요."],
              ["없는 숫자 지어내기", "사용자 수, 매출, 경험담처럼 모르는 사실은 파란 칸으로 남겨요."],
              ["AI 금지인 곳에 AI 글 쓰기", "Hacker News처럼 AI가 쓴 글을 금지하는 곳에서는 대신 쓰지 않고 뼈대와 점검만 해 드려요."],
            ].map(([bad, good]) => (
              <li key={bad}>
                <p className="text-[19px] font-bold">
                  <span className="strike">{bad}</span>
                </p>
                <p className="mt-1 text-[15px] text-ink-soft">{good}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="border-t border-rule">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-4 px-4 py-6 text-[13px] text-ink-soft sm:px-6">
          <span>Lurk 데모. 샘플 데이터는 데모용으로 직접 쓴 합성 글이에요.</span>
          <Link href="/blueprint" className="hover:text-ink">
            기획과 구조
          </Link>
          <a href="https://github.com/mnunu123/demo" className="hover:text-ink" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
