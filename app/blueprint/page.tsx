import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "기획과 구조 — Lurk" };

const REPO = "https://github.com/mnunu123/demo/blob/main";

const TIMELINE: { date: string; text: string; src: string; href: string; today?: boolean; future?: boolean }[] = [
  { date: "2025-11-11", text: "Reddit, API 셀프 신청 종료. 승인제(Responsible Builder Policy)로 전환", src: "Reddit Help", href: "https://support.reddithelp.com/hc/en-us/articles/42728983564564-Responsible-Builder-Policy" },
  { date: "2025-11-30", text: "Reddit 리서치 도구 GummySearch 판매 중단. 상업 라이선스 조건을 맞추지 못함", src: "GummySearch", href: "https://gummysearch.com/final-chapter" },
  { date: "2026-02-06", text: "X API 종량제 시작. 게시물 읽기 1건 $0.005", src: "X Docs", href: "https://docs.x.com/x-api/getting-started/pricing" },
  { date: "2026-06-09", text: "r/SaaS, 홍보 글 생성 도구의 홍보 금지 (미러 사이트로 확인)", src: "r/SaaS", href: "https://redlib.groet-infra.nl/r/SaaS" },
  { date: "2026-09-30", text: "Reddit, RSS 종료와 공개 API 단계적 종료 발표. 상업 도구는 계약 필요", src: "TechCrunch", href: "https://techcrunch.com/2026/09/30/reddit-is-killing-rss-feeds-ending-public-api-access-because-of-ai-bots/" },
  { date: "2026-10-21", text: "오늘", src: "", href: "", today: true },
  { date: "2026-10-31", text: "Reddit 신규 공개 API 신청 마감", src: "TechRepublic", href: "https://www.techrepublic.com/article/news-reddit-rss-public-api-shutdown/", future: true },
  { date: "2026-11-13", text: "Reddit RSS 종료", src: "TechCrunch", href: "https://techcrunch.com/2026/09/30/reddit-is-killing-rss-feeds-ending-public-api-access-because-of-ai-bots/", future: true },
  { date: "2027-01-12", text: "Reddit, 등록하지 않은 앱의 API 접근 제거 시작", src: "TechCrunch", href: "https://techcrunch.com/2026/09/30/reddit-is-killing-rss-feeds-ending-public-api-access-because-of-ai-bots/", future: true },
  { date: "2027-03", text: "Reddit 남은 공개 API 종료", src: "TechRepublic", href: "https://www.techrepublic.com/article/news-reddit-rss-public-api-shutdown/", future: true },
];

function Group({ title, note, items }: { title: string; note?: string; items: { name: string; sub?: string; tone?: "live" | "sample" | "opt" }[] }) {
  return (
    <div className="sheet px-4 py-4">
      <div className="text-[15px] font-bold">{title}</div>
      {note && <div className="text-[12px] text-ink-soft">{note}</div>}
      <ul className="mt-3 space-y-1.5">
        {items.map((it) => (
          <li
            key={it.name}
            className={
              "rounded border px-2.5 py-1.5 text-[14px] " +
              (it.tone === "live"
                ? "border-good/50 bg-good-wash"
                : it.tone === "sample"
                  ? "border-rule-strong border-dashed"
                  : it.tone === "opt"
                    ? "border-blue/40 bg-blue-wash"
                    : "border-rule bg-paper/60")
            }
          >
            <div className="font-medium leading-snug">{it.name}</div>
            {it.sub && <div className="text-[12px] text-ink-soft">{it.sub}</div>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Link2({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-1 text-[12px] text-ink-soft lg:flex-col lg:py-0">
      <span aria-hidden className="text-[18px] leading-none text-ink-faint lg:hidden">
        ↓
      </span>
      <span aria-hidden className="hidden text-[18px] leading-none text-ink-faint lg:block">
        →
      </span>
      <span className="ml-2 lg:ml-0 lg:mt-1 lg:text-center">{label}</span>
    </div>
  );
}

function Section({ title, children, lead }: { title: string; children: ReactNode; lead?: string }) {
  return (
    <section className="border-t border-rule py-12">
      <h2 className="text-[26px] font-bold leading-tight">{title}</h2>
      {lead && <p className="mt-2 max-w-3xl text-[16px] text-ink-soft">{lead}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

export default function Blueprint() {
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
          <a href="https://github.com/mnunu123/demo" className="text-ink-soft hover:text-ink" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </nav>
      </header>

      <main className="mx-auto max-w-[1180px] px-4 pb-24 sm:px-6">
        <section className="py-10 sm:py-14">
          <h1 className="text-[38px] font-bold leading-tight sm:text-[46px]">기획과 구조</h1>
          <p className="mt-4 max-w-3xl text-[18px] leading-relaxed">
            마케팅 예산 없는 1인 창업가가 해외 커뮤니티에 제품을 알릴 때, 그 동네 상위글을 먼저 읽고 그 동네 방식으로 정직하게 쓰도록 돕는 도구입니다. 대신 써서
            대신 올리는 도구가 아니라, 데이터로 코치하는 도구로 설계했습니다.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-[15px]">
            <a className="rounded-md border border-rule-strong bg-sheet px-4 py-2 hover:border-ink-faint" href={`${REPO}/docs/PLAN.md`} target="_blank" rel="noreferrer">
              기획서 전문
            </a>
            <a className="rounded-md border border-rule-strong bg-sheet px-4 py-2 hover:border-ink-faint" href={`${REPO}/docs/ARCHITECTURE.md`} target="_blank" rel="noreferrer">
              구현 구상도 전문
            </a>
            <a className="rounded-md border border-rule-strong bg-sheet px-4 py-2 hover:border-ink-faint" href={`${REPO}/docs/HANDOFF.md`} target="_blank" rel="noreferrer">
              인수인계 문서
            </a>
          </div>
        </section>

        <Section
          title="먼저 알아야 할 것"
          lead="이 아이디어의 가장 큰 문제는 기술이 아니라 플랫폼 정책입니다. 특히 Reddit 데이터는 계약 없이는 쓸 수 없는 쪽으로 가고 있습니다."
        >
          <ol className="relative border-l-2 border-rule-strong pl-6">
            {TIMELINE.map((t) => (
              <li key={t.date + t.text} className="relative pb-5 last:pb-0">
                <span
                  aria-hidden
                  className={
                    "absolute -left-[33px] top-1.5 h-4 w-4 rounded-full border-2 " +
                    (t.today ? "border-redpen bg-redpen" : t.future ? "border-ink-faint bg-paper" : "border-ink bg-ink")
                  }
                />
                <div className={"text-[13px] font-bold tabular-nums " + (t.today ? "text-redpen" : "text-ink-soft")}>{t.date}</div>
                {t.today ? (
                  <div className="pen -rotate-1 text-[24px]">이 문서를 쓴 날. Reddit 신규 신청 마감까지 열흘</div>
                ) : (
                  <div className="text-[16px]">
                    {t.text}{" "}
                    <a href={t.href} target="_blank" rel="noreferrer" className="text-[13px] text-blue underline-offset-4 hover:underline">
                      {t.src}
                    </a>
                  </div>
                )}
              </li>
            ))}
          </ol>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {[
              ["Hacker News는 AI 글 금지", "가이드라인이 게시물에 생성된 글을 넣지 말라고 합니다. 그래서 HN에서는 뼈대만 주고 직접 쓰게 합니다."],
              ["큰 서브레딧도 AI 규칙이 늘어남", "상위 1% 서브레딧의 17.1%가 AI 관련 규칙을 두고 있고, AI 규칙의 55.2%는 전면 금지입니다(2024년 11월 기준, Cornell CHI '25 연구)."],
              ["HN은 키 없이 무료", "Algolia HN Search API는 키가 필요 없습니다. 데모에서 실시간 수집이 실제로 되는 소스입니다."],
            ].map(([t, d]) => (
              <div key={t}>
                <div className="text-[16px] font-bold">{t}</div>
                <p className="mt-1 text-[15px] text-ink-soft">{d}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="그래서 이렇게 만들었어요">
          <ul className="grid gap-x-10 gap-y-6 md:grid-cols-3">
            {[
              ["대필이 아니라 코치", "AI 글을 허용하는 곳에서만 초안을 주고, 금지하는 곳에서는 뼈대와 실시간 점검만 합니다."],
              ["Reddit에 덜 기대는 데이터 구조", "실시간은 HN과 X, Reddit은 승인된 OAuth 앱이나 붙여넣기. 붙여넣기는 API가 없는 국내 커뮤니티에도 그대로 씁니다."],
              ["정직이 기본값", "만든 사람 공개 문구, 모르는 사실은 [채울 칸], 자동 게시 없음. 그렇게 써야 실제로 덜 지워집니다."],
            ].map(([t, d]) => (
              <li key={t} className="border-t-2 border-ink pt-3">
                <div className="text-[18px] font-bold">{t}</div>
                <p className="mt-1 text-[15px] text-ink-soft">{d}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="구현 구상도" lead="브라우저가 단계별 API를 차례로 부르고, 분석과 점수 계산은 서버와 브라우저가 같은 코드를 씁니다. LLM은 키가 있을 때만 쓰고, 실패하면 규칙 기반 결과로 돌아갑니다.">
          <div className="grid items-stretch gap-2 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] lg:gap-3">
            <Group
              title="브라우저"
              note="Next.js 클라이언트"
              items={[
                { name: "스튜디오 화면", sub: "진행 단계, 커뮤니티 탭" },
                { name: "원고 편집기", sub: "광고 냄새, 어울림을 고칠 때마다 계산" },
                { name: "브라우저 저장", sub: "지난 분석, 접근 코드" },
              ]}
            />
            <Link2 label="단계별 호출" />
            <Group
              title="API"
              note="Vercel 함수"
              items={[
                { name: "/api/product", sub: "제품 페이지 읽기" },
                { name: "/api/communities", sub: "후보 35곳 중 추천" },
                { name: "/api/collect", sub: "수집, 실패 시 샘플" },
                { name: "/api/analyze", sub: "통계와 현지 가이드" },
                { name: "/api/generate", sub: "초안 또는 뼈대" },
                { name: "/api/shorts", sub: "쇼츠 대본" },
              ]}
            />
            <Link2 label="엔진 실행" />
            <Group
              title="엔진"
              note="lib/, 서버와 브라우저 공용"
              items={[
                { name: "특징 추출", sub: "유형, 제목, 말투, 시간" },
                { name: "커뮤니티 통계", sub: "상위 25% 비교" },
                { name: "광고 냄새 채점기" },
                { name: "규칙 해석기", sub: "홍보, 요일, AI 글, 플레어" },
                { name: "어울림 채점기" },
                { name: "템플릿 생성기", sub: "LLM이 없거나 실패할 때" },
              ]}
            />
            <Link2 label="수집과 생성" />
            <Group
              title="바깥"
              note="데이터와 LLM"
              items={[
                { name: "Hacker News", sub: "Algolia, 키 없음", tone: "live" },
                { name: "Reddit", sub: "OAuth 앱 (승인 필요)", tone: "opt" },
                { name: "X API v2", sub: "종량제", tone: "opt" },
                { name: "붙여넣기", sub: "어떤 커뮤니티든", tone: "live" },
                { name: "샘플(합성) 데이터", sub: "실시간이 안 될 때", tone: "sample" },
                { name: "Claude 또는 OpenAI 호환", sub: "키 있을 때만", tone: "opt" },
              ]}
            />
          </div>
          <p className="mt-4 text-[13px] text-ink-soft">
            초록: 키 없이 동작, 파랑: 키나 승인이 있으면 동작, 점선: 실시간이 안 될 때 쓰는 샘플. 실서비스에서는 Postgres(프로젝트, 초안), Redis(커뮤니티 분석 캐시, 사용량
            제한), 작업 큐(수집, 올린 글 추적, Reddit 삭제 동기화)를 붙입니다.
          </p>
        </Section>

        <Section title="데이터 소스" lead="모든 분석에는 출처가 붙습니다. 실시간 수집, 샘플(합성) 데이터, 붙여 넣은 글.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-[14px]">
              <thead>
                <tr className="border-b-2 border-ink">
                  <th className="py-2 pr-4">소스</th>
                  <th className="py-2 pr-4">접근</th>
                  <th className="py-2 pr-4">비용</th>
                  <th className="py-2">지금 상태와 대응</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                <tr>
                  <td className="py-2.5 pr-4 font-medium">Reddit</td>
                  <td className="py-2.5 pr-4">OAuth 앱 전용 토큰, 클라이언트당 분당 100회</td>
                  <td className="py-2.5 pr-4">상업 사용은 별도 계약</td>
                  <td className="py-2.5">승인제, 2027년 3월 공개 API 종료. 붙여넣기를 1급 기능으로</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 font-medium">X</td>
                  <td className="py-2.5 pr-4">v2 최근 검색(7일)</td>
                  <td className="py-2.5 pr-4">게시물 1건 $0.005</td>
                  <td className="py-2.5">커뮤니티별 결과를 캐시해 사용자끼리 비용 분담</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 font-medium">Hacker News</td>
                  <td className="py-2.5 pr-4">Algolia HN Search, 키 없음</td>
                  <td className="py-2.5 pr-4">무료</td>
                  <td className="py-2.5">실시간 기본 소스. AI 글 금지라 뼈대 모드</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 font-medium">Claude</td>
                  <td className="py-2.5 pr-4">Sonnet 5.5 (초안), Haiku 5.5 (가이드)</td>
                  <td className="py-2.5 pr-4">분석 1회 약 $0.20 (혼합 기준 추정)</td>
                  <td className="py-2.5">키가 없으면 템플릿 엔진</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="로드맵">
          <ol className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["지금", "Reddit 개발자 접근 신청(10/31 마감), 이 데모 배포, 지인 5명 사용성 테스트"],
              ["1~2주", "사용자 10명 인터뷰: 어디에 올렸고 왜 지워졌는지. 붙여넣기 흐름 다듬기"],
              ["3~5주", "로그인과 저장, 커뮤니티 분석 캐시, 올린 글 추적(HN과 X부터)"],
              ["6~8주", "GeekNews Show GN 지원, 결제, 직접 쓴 글로 출시, 지표 보고 방향 결정"],
            ].map(([w, d]) => (
              <li key={w} className="border-t-2 border-ink pt-3">
                <div className="text-[13px] font-bold text-ink-soft">{w}</div>
                <p className="mt-1 text-[15px]">{d}</p>
              </li>
            ))}
          </ol>
          <p className="mt-8 text-[15px]">
            북극성 지표는 <span className="font-bold">주간 &ldquo;지워지지 않고 살아남은 게시물 수&rdquo;</span>입니다. 사용자가 올린 URL을 추적해 반응과 삭제 여부를 기록하면, 그 데이터가 쌓여
            &ldquo;이 동네에서 살아남는 글&rdquo; 모델이 됩니다.
          </p>
        </Section>
      </main>
    </div>
  );
}
