"use client";

import { useMemo, useRef, useState } from "react";
import { BAND_KO, scoreAdSmell } from "@/lib/analysis/adsmell";
import { scoreFit } from "@/lib/analysis/fit";
import { buildMarks } from "@/lib/client/marks";
import type { AdSmellHit, CommunityAnalysis, Draft } from "@/lib/types";
import { Button, Scale, SectionTitle, cx } from "@/components/ui";
import { MarkedField } from "./MarkedField";

export interface DraftEdit {
  title: string;
  body: string;
  thread?: string[];
  firstComment?: string;
}

export function editFromDraft(d: Draft): DraftEdit {
  return { title: d.title, body: d.body, thread: d.thread ? [...d.thread] : undefined, firstComment: d.firstComment };
}

function CopyButton({ text, label, onCopied }: { text: string; label: string; onCopied?: () => void }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      size="sm"
      variant="quiet"
      disabled={!text.trim()}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          onCopied?.();
          window.setTimeout(() => setDone(false), 1600);
        } catch {
          setDone(false);
        }
      }}
    >
      {done ? "복사됨" : label}
    </Button>
  );
}

export function Manuscript({
  draft,
  edit,
  onEdit,
  onReset,
  analysis,
  productName,
  productUrl,
}: {
  draft: Draft;
  edit: DraftEdit;
  onEdit: (e: DraftEdit) => void;
  onReset: () => void;
  analysis: CommunityAnalysis;
  productName: string;
  productUrl: string;
}) {
  const platform = analysis.community.platform;
  const isX = platform === "x";
  const isLink = draft.angle === "link";
  const isComment = draft.angle === "thread";
  const [showGloss, setShowGloss] = useState(false);
  const [copiedWithFills, setCopiedWithFills] = useState(false);
  const fields = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const scoredBody = isX ? (edit.thread ?? [edit.body]).join("\n\n") : isLink ? (edit.firstComment ?? "") : edit.body;
  const smell = useMemo(
    () => scoreAdSmell({ title: isX ? "" : edit.title, body: scoredBody, platform }),
    [edit.title, scoredBody, platform, isX],
  );
  const fit = useMemo(
    () =>
      scoreFit({
        title: isX ? "" : edit.title,
        body: scoredBody,
        thread: edit.thread,
        platform,
        stats: analysis.stats,
        rules: analysis.rules,
        productName,
        kind: isComment ? "comment" : "post",
      }),
    [edit.title, scoredBody, edit.thread, platform, analysis, productName, isComment, isX],
  );

  const tweetHits = useMemo(
    () => (edit.thread ?? []).map((t) => scoreAdSmell({ title: "", body: t, platform }).hits),
    [edit.thread, platform],
  );

  const titleMarks = buildMarks(edit.title, "title", smell.hits, analysis.stats);
  const bodyMarks = buildMarks(isLink ? (edit.firstComment ?? "") : edit.body, "body", smell.hits, analysis.stats);

  const allHits: (AdSmellHit & { where: string })[] = isX
    ? tweetHits.flatMap((hs, i) => hs.map((h) => ({ ...h, where: `t${i}` })))
    : smell.hits.map((h) => ({ ...h, where: h.field === "title" ? "title" : isLink ? "comment" : "body" }));

  const focusHit = (h: AdSmellHit & { where: string }) => {
    const el = fields.current[h.where];
    if (!el) return;
    el.focus();
    el.setSelectionRange(h.start, h.end);
  };

  const fullText = isX
    ? (edit.thread ?? []).map((t, i, arr) => (arr.length > 1 ? `${t}\n\n(${i + 1}/${arr.length})` : t)).join("\n\n---\n\n")
    : [edit.title, isLink ? productUrl : edit.body, edit.firstComment ? `첫 댓글:\n${edit.firstComment}` : ""].filter(Boolean).join("\n\n");
  const fills = fit.placeholders.length;
  const outlinePending = draft.mode === "outline" && fills > 0;

  const smellTone = smell.band === "native" ? "text-good" : smell.band === "light" ? "text-ink" : "text-redpen";

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_15rem]">
      <div className="min-w-0">
        {draft.mode === "outline" && (
          <p className="mb-3 rounded-md border border-blue/40 bg-blue-wash px-3 py-2 text-[14px] text-ink">
            이 커뮤니티는 AI가 쓴 글을 금지해서 대신 써 드리지 않아요. 파란 칸을 지우고 직접 영어로 써 넣으면, 쓰는 동안 계속 점검해 드려요.
          </p>
        )}

        <div className="sheet manuscript px-5 py-5 sm:px-8 sm:py-7">
          {!isX && !isComment && (
            <div className="mb-4 border-b border-rule pb-3">
              <div className="mb-1 flex items-center justify-between font-sans text-[12px] text-ink-faint">
                <span>제목</span>
                <span className={cx(platform === "hn" && edit.title.length > 80 && "font-bold text-redpen")}>
                  {edit.title.length}자{platform === "hn" ? " / 80" : ""}
                </span>
              </div>
              <MarkedField
                label="제목"
                singleLine
                className="text-[21px] font-semibold leading-snug"
                value={edit.title}
                marks={titleMarks}
                fieldRef={(el) => (fields.current.title = el)}
                onChange={(v) => onEdit({ ...edit, title: v })}
              />
            </div>
          )}

          {isX ? (
            <ol className="space-y-4">
              {(edit.thread ?? [edit.body]).map((t, i, arr) => {
                const n = [...t].length;
                return (
                  <li key={i} className="border-l-2 border-rule pl-4">
                    <div className="mb-1 flex justify-between font-sans text-[12px] text-ink-faint">
                      <span>{arr.length > 1 ? `트윗 ${i + 1}/${arr.length}` : "트윗"}</span>
                      <span className={cx(n > 280 && "font-bold text-redpen")}>{n} / 280</span>
                    </div>
                    <MarkedField
                      label={`트윗 ${i + 1}`}
                      value={t}
                      marks={buildMarks(t, "body", tweetHits[i] ?? [], analysis.stats)}
                      fieldRef={(el) => (fields.current[`t${i}`] = el)}
                      onChange={(v) => {
                        const next = [...(edit.thread ?? [edit.body])];
                        next[i] = v;
                        onEdit({ ...edit, thread: next, body: next.join("\n\n") });
                      }}
                    />
                  </li>
                );
              })}
            </ol>
          ) : isLink ? (
            <div>
              <div className="mb-4 font-sans text-[14px] text-ink-soft">
                URL 칸: <span className="text-ink">{productUrl}</span> (본문은 비워 둬요)
              </div>
              <div className="mb-1 font-sans text-[12px] text-ink-faint">올린 직후 남길 첫 댓글</div>
              <MarkedField
                label="첫 댓글"
                value={edit.firstComment ?? ""}
                marks={bodyMarks}
                fieldRef={(el) => (fields.current.comment = el)}
                onChange={(v) => onEdit({ ...edit, firstComment: v })}
              />
            </div>
          ) : (
            <div>
              {isComment && <div className="mb-2 font-sans text-[12px] text-ink-faint">정기 스레드에 다는 댓글 (제목 없음)</div>}
              <MarkedField
                label="본문"
                value={edit.body}
                marks={bodyMarks}
                fieldRef={(el) => (fields.current.body = el)}
                onChange={(v) => onEdit({ ...edit, body: v })}
              />
            </div>
          )}
        </div>

        {!isLink && !isX && draft.firstComment !== undefined && (
          <div className="mt-4 rounded-md border border-rule bg-sheet px-4 py-3">
            <div className="mb-1 text-[13px] font-medium text-ink-soft">첫 댓글 (링크는 여기에)</div>
            <textarea
              aria-label="첫 댓글"
              className="manuscript w-full resize-y bg-transparent text-[15px] outline-none"
              rows={3}
              value={edit.firstComment ?? ""}
              onChange={(e) => onEdit({ ...edit, firstComment: e.target.value })}
            />
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {!isX && !isComment && <CopyButton text={edit.title} label="제목 복사" onCopied={() => setCopiedWithFills(fills > 0)} />}
          {isX ? (
            (edit.thread ?? []).map((t, i) => (
              <CopyButton key={i} text={t} label={`트윗 ${i + 1} 복사`} onCopied={() => setCopiedWithFills(fills > 0)} />
            ))
          ) : isLink ? (
            <CopyButton text={edit.firstComment ?? ""} label="첫 댓글 복사" onCopied={() => setCopiedWithFills(fills > 0)} />
          ) : (
            <CopyButton text={edit.body} label="본문 복사" onCopied={() => setCopiedWithFills(fills > 0)} />
          )}
          {!isX && !isLink && edit.firstComment && <CopyButton text={edit.firstComment} label="첫 댓글 복사" />}
          <CopyButton text={fullText} label="전부 복사" onCopied={() => setCopiedWithFills(fills > 0)} />
          <Button size="sm" variant="ghost" onClick={() => setShowGloss((v) => !v)} aria-expanded={showGloss}>
            {showGloss ? "한국어 설명 닫기" : draft.glossKind === "translation" ? "한국어 번역 보기" : "문단별 설명 보기"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onReset}>
            처음 초안으로
          </Button>
        </div>
        {copiedWithFills && (
          <p className="mt-2 text-[13px] text-blue" role="status">
            아직 채우지 않은 칸 {fills}개가 그대로 복사됐어요. 올리기 전에 꼭 채워 주세요.
          </p>
        )}

        {showGloss && (
          <ol className="mt-4 space-y-2 border-l-2 border-hilite pl-4 text-[14px] text-ink-soft">
            {draft.glossKo.map((g, i) => (
              <li key={i}>
                <span className="mr-2 text-ink-faint">{i + 1}</span>
                {g}
              </li>
            ))}
          </ol>
        )}

        {(draft.whyKo.length > 0 || draft.postTimingKo || draft.flairSuggestion) && (
          <div className="mt-6">
            <SectionTitle>이 초안이 이렇게 생긴 이유</SectionTitle>
            <ul className="space-y-1.5 text-[14px] text-ink">
              {draft.whyKo.map((w, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden className="text-ink-faint">—</span>
                  <span>{w}</span>
                </li>
              ))}
              {draft.flairSuggestion && (
                <li className="flex gap-2">
                  <span aria-hidden className="text-ink-faint">—</span>
                  <span>플레어: {draft.flairSuggestion}</span>
                </li>
              )}
              {draft.postTimingKo && (
                <li className="flex gap-2">
                  <span aria-hidden className="text-ink-faint">—</span>
                  <span>{draft.postTimingKo}</span>
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      {/* 오른쪽 여백: 점수와 빨간 펜 메모 */}
      <aside className="space-y-6" aria-label="점검 결과">
        <div>
          <div className="flex items-baseline justify-between">
            <span className="text-[14px] font-bold">광고 냄새</span>
            <span className={cx("text-[22px] font-bold tabular-nums", smellTone)}>{smell.score}</span>
          </div>
          <Scale value={smell.score} baseline={analysis.stats.adSmell.median} tone="red" label={`광고 냄새 ${smell.score}점`} />
          <p className="mt-1.5 text-[13px] text-ink-soft">
            {BAND_KO[smell.band]}. 이 동네 상위권 중간값은 {analysis.stats.adSmell.median}점이에요.
          </p>
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <span className="text-[14px] font-bold">어울림</span>
            {outlinePending ? (
              <span className="text-[13px] text-ink-soft">칸을 채우면 매겨요</span>
            ) : (
              <span className="text-[22px] font-bold tabular-nums">{fit.score}</span>
            )}
          </div>
          {!outlinePending && <Scale value={fit.score} tone="green" label={`어울림 ${fit.score}점`} />}
          <ul className="mt-2 space-y-1 text-[13px]">
            {fit.checks.map((c) => (
              <li key={c.key} className="flex gap-1.5">
                <span aria-hidden className={cx("font-bold", c.ok ? "text-good" : "text-redpen")}>
                  {c.ok ? "✓" : "✕"}
                </span>
                <span className="min-w-0">
                  <span className="font-medium">{c.labelKo}</span> <span className="text-ink-soft">{c.detailKo}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {fills > 0 && (
          <div>
            <div className="mb-1 text-[14px] font-bold text-blue">직접 채울 칸 {fills}개</div>
            <ul className="space-y-1 text-[13px] text-ink-soft">
              {fit.placeholders.slice(0, 8).map((p, i) => (
                <li key={i} className="mark-fill inline-block px-1">
                  {p}
                </li>
              ))}
            </ul>
          </div>
        )}

        {allHits.length > 0 && (
          <div>
            <div className="mb-1.5 text-[14px] font-bold">빨간 펜</div>
            <ul className="space-y-2.5">
              {allHits.slice(0, 10).map((h, i) => (
                <li key={i}>
                  <button type="button" className="w-full text-left" onClick={() => focusHit(h)}>
                    <span className="pen block -rotate-1 text-[21px]">{h.noteKo}</span>
                    <span className="mark-ad text-[13px]">{h.text}</span>
                    <span className="mt-0.5 block text-[12px] text-ink-soft">{h.fixKo}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {smell.goodSignalsKo.length > 0 && (
          <div>
            <div className="mb-1 text-[14px] font-bold text-good">좋은 신호</div>
            <ul className="space-y-0.5 text-[13px] text-ink-soft">
              {smell.goodSignalsKo.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}
