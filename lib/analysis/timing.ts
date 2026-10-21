// 업로드 시간 분석. 커뮤니티 대부분이 미국 시간대라서 한국 시간으로 바꿔 보여 준다.

import type { TimeBlock } from "../types";

const KST_OFFSET = 9;
export const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];
const WEEKDAY_EN = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export function toKst(date: Date): { weekday: number; hour: number } {
  const shifted = new Date(date.getTime() + KST_OFFSET * 3600_000);
  return { weekday: shifted.getUTCDay(), hour: shifted.getUTCHours() };
}

function hourWord(h: number): string {
  const hh = ((h % 24) + 24) % 24;
  if (hh === 0) return "자정";
  if (hh === 12) return "낮 12시";
  if (hh < 6) return `새벽 ${hh}시`;
  if (hh < 12) return `오전 ${hh}시`;
  if (hh < 18) return `오후 ${hh - 12}시`;
  return `밤 ${hh - 12}시`;
}

export function blockLabelKo(startHour: number, span = 3): string {
  return `${hourWord(startHour)}~${hourWord(startHour + span)}`;
}

/** 미국 동부 시간으로 몇 시인지 (서머타임 자동 반영) */
export function easternHour(kstHour: number, reference = new Date()): number {
  const ref = new Date(reference);
  ref.setUTCHours(kstHour - KST_OFFSET, 0, 0, 0);
  const parts = new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "America/New_York" }).formatToParts(ref);
  return Number(parts.find((p) => p.type === "hour")?.value ?? 0);
}

function easternWord(h: number): string {
  const hh = ((h % 24) + 24) % 24;
  const suffix = hh < 12 ? "AM" : "PM";
  const twelve = hh % 12 === 0 ? 12 : hh % 12;
  return `${twelve}${suffix}`;
}

export function analyzeTiming(
  items: { createdAt: string; engagement: number }[],
): { blocks: TimeBlock[]; bestLabelKo: string; sampleSize: number } {
  const sorted = [...items].sort((a, b) => b.engagement - a.engagement);
  const top = sorted.slice(0, Math.max(4, Math.ceil(sorted.length / 2)));
  const counts = new Array(8).fill(0);
  const dayCounts = new Array(7).fill(0);
  for (const it of top) {
    const d = new Date(it.createdAt);
    if (Number.isNaN(d.getTime())) continue;
    const { weekday, hour } = toKst(d);
    counts[Math.floor(hour / 3)] += 1;
    dayCounts[weekday] += 1;
  }
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  const blocks: TimeBlock[] = counts.map((c, i) => ({ startHourKst: i * 3, share: c / total }));

  if (top.length < 6) {
    return { blocks, bestLabelKo: "표본이 적어 시간 추천을 하지 않아요", sampleSize: top.length };
  }

  // 연속된 두 블록(6시간) 중 가장 많이 몰린 구간
  let best = 0;
  let bestShare = -1;
  for (let i = 0; i < 8; i++) {
    const s = blocks[i].share + blocks[(i + 1) % 8].share;
    if (s > bestShare) {
      bestShare = s;
      best = i;
    }
  }
  const start = best * 3;
  // 서머타임 판단 기준일: 데이터의 가장 최근 글 날짜 (현재 시각을 쓰지 않아서 결과가 항상 같다)
  const latest = items.reduce((m, it) => Math.max(m, new Date(it.createdAt).getTime() || 0), 0);
  const et = easternHour(start, latest ? new Date(latest) : new Date("2026-01-01T00:00:00Z"));
  let dayNote = "";
  const dayTotal = dayCounts.reduce((a, b) => a + b, 0) || 1;
  const weekdayShare = (dayCounts[1] + dayCounts[2] + dayCounts[3] + dayCounts[4] + dayCounts[5]) / dayTotal;
  if (weekdayShare >= 0.8) dayNote = "평일 ";
  else if ((dayCounts[0] + dayCounts[6]) / dayTotal >= 0.5) dayNote = "주말 ";

  return {
    blocks,
    bestLabelKo: `${dayNote}${blockLabelKo(start, 6)} (미국 동부 ${easternWord(et)}~${easternWord(et + 6)})`,
    sampleSize: top.length,
  };
}

/** "Saturday만 홍보 가능" 같은 규칙을 한국 시간 창으로 바꾼다.
 *  미국 본토 모든 시간대와 UTC에서 모두 그 요일인 구간만 고른다:
 *  한국 시간 그 요일 오후 5시(태평양 표준시 0시) ~ 다음 날 오전 9시(UTC 자정). 서머타임과 상관없이 안전한 쪽이다. */
export function usDayToKstWindow(dayEn: string): string | null {
  const i = WEEKDAY_EN.indexOf(dayEn.toLowerCase().replace(/s$/, ""));
  if (i < 0) return null;
  return `한국 시간 ${WEEKDAY_KO[i]}요일 오후 5시 ~ ${WEEKDAY_KO[(i + 1) % 7]}요일 오전 9시`;
}

export function dayKo(dayEn: string): string | null {
  const i = WEEKDAY_EN.indexOf(dayEn.toLowerCase().replace(/s$/, ""));
  return i < 0 ? null : `${WEEKDAY_KO[i]}요일`;
}
