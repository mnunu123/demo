"use client";

import type { CommunityAnalysis } from "@/lib/types";
import { TITLE_CASE_KO } from "@/lib/text";
import { Chip, PolicyStamp, SectionTitle, SourceBadge, cx } from "@/components/ui";

const pct = (x: number) => `${Math.round(x * 100)}%`;
const REGISTER_KO = { casual: "편한 구어체", neutral: "담백한 설명체", formal: "격식 있는 문어체" };

function ago(iso: string): string {
  const d = new Date(iso).getTime();
  const h = Math.max(0, Math.round((Date.now() - d) / 3600_000));
  if (h < 1) return "방금";
  if (h < 24) return `${h}시간 전`;
  return `${Math.round(h / 24)}일 전`;
}

export function GuidePanel({ analysis, part }: { analysis: CommunityAnalysis; part: "overview" | "reference" }) {
  const { stats, rules, playbook, community } = analysis;
  const isX = community.platform === "x";
  const maxBlock = Math.max(...stats.timing.blocks.map((b) => b.share), 0.0001);

  if (part === "reference") return <GuideReference analysis={analysis} />;

  return (
    <div className="space-y-8">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[22px] font-bold leading-tight">{community.label}</h2>
          <SourceBadge source={analysis.source} />
        </div>
        <p className="mt-1 text-[13px] text-ink-soft">
          글 {stats.n}개 분석
          {analysis.about?.members ? `, 구성원 ${analysis.about.members.toLocaleString("ko-KR")}명` : ""}
          {analysis.source === "live" ? `, ${ago(analysis.fetchedAt)} 수집` : ""}
          {playbook.engine === "llm" ? ", 가이드는 LLM이 통계를 읽고 정리" : ", 가이드는 통계로 자동 정리"}
        </p>
        {analysis.noticeKo && <p className="mt-2 text-[13px] text-ink-soft">{analysis.noticeKo}</p>}
      </header>

      <section>
        <p className="text-[17px] leading-relaxed">{playbook.vibeKo}</p>
        <p className="mt-3 border-l-2 border-blue pl-3 text-[15px]">
          <span className="font-bold">이 제품이라면 </span>
          {playbook.bestAngleKo}
        </p>
      </section>

      <section>
        <SectionTitle aside={rules.selfPromo.evidence.length ? `근거 규칙 ${rules.selfPromo.evidence.length}개` : undefined}>
          홍보 규칙
        </SectionTitle>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <PolicyStamp policy={rules.selfPromo.policy} label={rules.selfPromo.labelKo} />
          {rules.aiContent.level === "banned" && <PolicyStamp policy="restricted" label="AI 글 금지" />}
          {rules.aiContent.level === "limited" && <PolicyStamp policy="conditional" label="AI 글 제한" />}
          {rules.flairRequired && <PolicyStamp policy="conditional" label="플레어 필수" />}
        </div>
        <ul className="space-y-1.5 text-[14px]">
          {rules.checklistKo.map((c, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-ink-faint" />
              <span>{c}</span>
            </li>
          ))}
        </ul>
        {analysis.rulesRaw.length > 0 && (
          <details className="mt-2 text-[13px] text-ink-soft">
            <summary className="cursor-pointer select-none">규칙 원문 {analysis.rulesRaw.length}개 보기</summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              {analysis.rulesRaw.map((r, i) => (
                <li key={i}>
                  <span className="font-medium text-ink">{r.title}</span>
                  {r.description ? ` — ${r.description}` : ""}
                </li>
              ))}
            </ol>
            {analysis.source === "sample" && <p className="mt-1">샘플 규칙은 데모용으로 만든 글이에요. 실제 규칙과 다를 수 있어요.</p>}
          </details>
        )}
      </section>

      <section>
        <SectionTitle aside="비중 / 평균 대비 반응">잘 되는 글 유형</SectionTitle>
        <ul className="space-y-2">
          {stats.archetypes.map((a) => (
            <li key={a.type} className="grid grid-cols-[6.5rem_1fr_5.5rem] items-center gap-2 text-[14px]">
              <span className="truncate">{a.labelKo}</span>
              <span className="h-2.5 rounded-sm bg-rule">
                <span
                  className={cx("block h-full rounded-sm", a.performance >= 1.05 ? "bg-good" : a.performance <= 0.9 ? "bg-ink-faint" : "bg-ink-soft")}
                  style={{ width: `${Math.max(3, a.share * 100)}%` }}
                />
              </span>
              <span className="text-right tabular-nums text-ink-soft">
                {pct(a.share)} <span className={cx(a.performance >= 1.05 && "font-bold text-good")}>×{a.performance}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionTitle>{isX ? "첫 줄과 말투" : "제목과 말투"}</SectionTitle>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[14px]">
          <div>
            <dt className="text-[12px] text-ink-soft">{isX ? "첫 줄 길이" : "제목 길이"}</dt>
            <dd className="font-medium tabular-nums">
              {stats.title.chars.p25}~{stats.title.chars.p75}자
            </dd>
          </div>
          {!isX && (
            <div>
              <dt className="text-[12px] text-ink-soft">제목 표기</dt>
              <dd className="font-medium">
                {TITLE_CASE_KO[stats.title.caseStyle]} {pct(stats.title.caseShare)}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-[12px] text-ink-soft">질문형 / 숫자 / 1인칭</dt>
            <dd className="font-medium tabular-nums">
              {pct(stats.title.questionRate)} / {pct(stats.title.numberRate)} / {pct(stats.title.firstPersonRate)}
            </dd>
          </div>
          {!isX && (
            <div>
              <dt className="text-[12px] text-ink-soft">본문 길이</dt>
              <dd className="font-medium tabular-nums">
                {stats.body.words.p25}~{stats.body.words.p75}단어
              </dd>
            </div>
          )}
          <div>
            <dt className="text-[12px] text-ink-soft">말투</dt>
            <dd className="font-medium">{REGISTER_KO[stats.tone.register]}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-ink-soft">이모지 / 느낌표 (글당)</dt>
            <dd className="font-medium tabular-nums">
              {stats.tone.emojiPerPost} / {stats.tone.exclamationsPerPost}
            </dd>
          </div>
          {!isX && (
            <div>
              <dt className="text-[12px] text-ink-soft">본문에 링크 / 질문으로 끝남</dt>
              <dd className="font-medium tabular-nums">
                {pct(stats.body.linkRate)} / {pct(stats.body.endsWithQuestionRate)}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-[12px] text-ink-soft">만든 사람이라고 밝힌 글</dt>
            <dd className="font-medium tabular-nums">{pct(stats.tone.disclosureRate)}</dd>
          </div>
        </dl>
      </section>

      {stats.lifts.length > 0 && (
        <section>
          <SectionTitle aside="상위 25% / 나머지">반응 좋은 글은 이게 달라요</SectionTitle>
          <ul className="space-y-2.5">
            {stats.lifts.map((l) => (
              <li key={l.key} className="text-[14px]">
                <div className="mb-1">{l.labelKo}</div>
                <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                  <div className="space-y-1">
                    <span className="block h-2 rounded-sm bg-rule">
                      <span className="block h-full rounded-sm bg-ink" style={{ width: `${Math.max(2, l.topRate * 100)}%` }} />
                    </span>
                    <span className="block h-2 rounded-sm bg-rule">
                      <span className="block h-full rounded-sm bg-ink-faint" style={{ width: `${Math.max(2, l.restRate * 100)}%` }} />
                    </span>
                  </div>
                  <span className="text-right text-[13px] tabular-nums text-ink-soft">
                    {pct(l.topRate)}
                    <br />
                    {pct(l.restRate)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(stats.tone.lexicon.length > 0 || stats.phrases.length > 0) && (
        <section>
          <SectionTitle>현지 표현</SectionTitle>
          {stats.tone.lexicon.length > 0 && (
            <ul className="flex flex-wrap gap-x-3 gap-y-2 text-[14px]">
              {stats.tone.lexicon.map((l) => (
                <li key={l.term}>
                  <Chip tone="local">{l.term}</Chip> <span className="text-[13px] text-ink-soft">{l.glossKo}</span>
                </li>
              ))}
            </ul>
          )}
          {stats.phrases.length > 0 && (
            <p className="mt-3 text-[13px] text-ink-soft">
              여러 글에 반복된 구절:{" "}
              {stats.phrases.map((p, i) => (
                <span key={p.text}>
                  <span className="font-serif text-ink">{p.text}</span>
                  {i < stats.phrases.length - 1 ? ", " : ""}
                </span>
              ))}
            </p>
          )}
        </section>
      )}

      {stats.timing.blocks.length > 0 && (
        <section>
          <SectionTitle aside={`반응 좋은 글 ${stats.timing.sampleSize}개 기준`}>올릴 시간 (한국 시간)</SectionTitle>
          <div className="flex h-20 items-end gap-1" role="img" aria-label={`추천 시간 ${stats.timing.bestLabelKo}`}>
            {stats.timing.blocks.map((b) => (
              <div key={b.startHourKst} className="flex h-full flex-1 flex-col justify-end">
                <div
                  className={cx("rounded-t-sm", b.share === maxBlock ? "bg-blue" : "bg-rule-strong")}
                  style={{ height: `${Math.max(4, (b.share / maxBlock) * 100)}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1 flex gap-1 text-[11px] text-ink-faint">
            {stats.timing.blocks.map((b) => (
              <span key={b.startHourKst} className="flex-1 text-center tabular-nums">
                {b.startHourKst}시
              </span>
            ))}
          </div>
          <p className="mt-2 text-[14px]">{stats.timing.bestLabelKo}</p>
          {rules.promoDaysNoteKo && <p className="mt-1 text-[14px] text-blue">홍보 글은 {rules.promoDaysNoteKo}</p>}
        </section>
      )}

      {playbook.removalRisksKo.length > 0 && (
        <section>
          <SectionTitle>지워질 수 있는 이유</SectionTitle>
          <ul className="space-y-1.5 text-[14px]">
            {playbook.removalRisksKo.map((r, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden className="text-redpen">!</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** 원고 옆에 두고 보는 참고 자료: 쓰는 법, 제목 공식, 지금 반응 좋은 글 */
function GuideReference({ analysis }: { analysis: CommunityAnalysis }) {
  const { stats, playbook, community } = analysis;
  const isX = community.platform === "x";
  return (
    <div className="space-y-8">
      <section className="grid gap-6 sm:grid-cols-2">
        <div>
          <SectionTitle>이렇게 쓰세요</SectionTitle>
          <ul className="space-y-1.5 text-[14px]">
            {playbook.doKo.map((d, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden className="font-bold text-good">+</span>
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <SectionTitle>피하세요</SectionTitle>
          <ul className="space-y-1.5 text-[14px]">
            {playbook.dontKo.map((d, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden className="font-bold text-redpen">−</span>
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {playbook.titleFormulas.length > 0 && (
        <section>
          <SectionTitle>{isX ? "첫 줄 공식" : "제목 공식"}</SectionTitle>
          <ul className="space-y-3">
            {playbook.titleFormulas.map((f, i) => (
              <li key={i} className="text-[14px]">
                <div className="text-[12px] text-ink-soft">{f.labelKo}</div>
                <div className="font-medium">{f.pattern}</div>
                {f.example && <div className="font-serif text-[14px] text-ink-soft">예: {f.example}</div>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <SectionTitle aside="반응 순">지금 반응 좋은 글</SectionTitle>
        <ol className="divide-y divide-rule border-y border-rule">
          {stats.topPosts.map((p) => (
            <li key={p.id} className="py-3">
              <div className="font-serif text-[15px] leading-snug">
                {p.permalink && analysis.source === "live" ? (
                  <a href={p.permalink} target="_blank" rel="noreferrer" className="hover:underline">
                    {p.title}
                  </a>
                ) : (
                  p.title
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-soft">
                <span className="tabular-nums">{isX ? "좋아요" : community.platform === "hn" ? "포인트" : "추천"} {p.score.toLocaleString("ko-KR")}</span>
                <span className="tabular-nums">댓글 {p.comments.toLocaleString("ko-KR")}</span>
                <span>{p.archetypeKo}</span>
                <span className="tabular-nums">광고 냄새 {p.adSmell}</span>
              </div>
              {p.whyKo.length > 0 && <div className="mt-1 text-[13px] text-ink">{p.whyKo.join(", ")}</div>}
            </li>
          ))}
        </ol>
      </section>

    </div>
  );
}
