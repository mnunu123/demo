// 편집기 표시 계산: 빨간 펜(광고 냄새), 형광펜(현지 표현), 파란 연필(직접 채울 칸)

import type { AdSmellHit, CommunityStats } from "../types";
import { LEXICON, normalizeQuotes } from "../text";
import { findPlaceholders } from "../analysis/fit";

export type MarkKind = "ad" | "local" | "fill";

export interface Mark {
  start: number;
  end: number;
  kind: MarkKind;
  note?: string;
}

export interface Segment {
  text: string;
  kind?: MarkKind;
  note?: string;
}

const PRIORITY: Record<MarkKind, number> = { fill: 3, ad: 2, local: 1 };

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 커뮤니티에서 자주 쓰는 표현 + 현지 용어 사전 */
export function localMarks(text: string, stats?: CommunityStats): Mark[] {
  const src = normalizeQuotes(text);
  const marks: Mark[] = [];
  for (const entry of LEXICON) {
    const re = new RegExp(entry.re.source, "gi");
    for (const m of src.matchAll(re)) {
      marks.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, kind: "local", note: entry.glossKo });
    }
  }
  if (stats) {
    const phrases = [...stats.phrases.map((p) => p.text), ...stats.title.openers.map((o) => o.text)].filter((p) => p.length >= 5);
    for (const p of phrases) {
      const re = new RegExp(`\\b${escapeRe(p).replace(/\s+/g, "\\s+")}\\b`, "gi");
      for (const m of src.matchAll(re)) {
        marks.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, kind: "local", note: "이 동네 상위글에 자주 나오는 표현" });
      }
    }
  }
  return marks;
}

export function buildMarks(text: string, field: "title" | "body", adHits: AdSmellHit[], stats?: CommunityStats): Mark[] {
  const all: Mark[] = [
    ...findPlaceholders(text).map((p) => ({ start: p.start, end: p.end, kind: "fill" as const, note: "직접 채울 칸" })),
    ...adHits.filter((h) => h.field === field).map((h) => ({ start: h.start, end: h.end, kind: "ad" as const, note: h.noteKo })),
    ...localMarks(text, stats),
  ].filter((m) => m.end > m.start && m.start >= 0 && m.end <= text.length);

  const sorted = all.sort((a, b) => PRIORITY[b.kind] - PRIORITY[a.kind] || a.start - b.start);
  const kept: Mark[] = [];
  for (const m of sorted) {
    if (kept.some((k) => m.start < k.end && k.start < m.end)) continue;
    kept.push(m);
  }
  return kept.sort((a, b) => a.start - b.start);
}

export function toSegments(text: string, marks: Mark[]): Segment[] {
  const out: Segment[] = [];
  let pos = 0;
  for (const m of marks) {
    if (m.start > pos) out.push({ text: text.slice(pos, m.start) });
    out.push({ text: text.slice(m.start, m.end), kind: m.kind, note: m.note });
    pos = m.end;
  }
  if (pos < text.length) out.push({ text: text.slice(pos) });
  return out;
}
