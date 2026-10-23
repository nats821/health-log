import { addDays, parseISO } from './date';
import type { DailyRecord } from './types';

/** 生理周期の計算。記録（日々の「生理中」）から期間・平均周期を出し、予定日とキラキラ期を目安として予測する */

export interface Run {
  start: string;
  end: string;
}

export interface CycleStats {
  avgCycle: number; // 平均周期（日）
  avgLength: number; // 平均の生理日数
  cycles: number; // 平均に使った周期の数
}

export type Phase = 'period' | 'kirakira';
export interface DayPhase {
  phase: Phase;
  predicted: boolean; // 予測（目安）なら true
}

const DEFAULT_CYCLE = 28;
const DEFAULT_LENGTH = 5;
const MAX_GAP_FOR_CYCLE = 60; // これより離れた開始日の間は周期として数えない（記録の空白期間）

const daysBetween = (a: string, b: string) => Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);

/** 「生理中」の連続した日をまとめる（1日の記録漏れはつなげる） */
export function periodRuns(records: DailyRecord[]): Run[] {
  const days = records.filter((r) => r.period === 'during').map((r) => r.date).sort();
  const runs: Run[] = [];
  for (const d of days) {
    const last = runs[runs.length - 1];
    if (last && daysBetween(last.end, d) <= 2) last.end = d;
    else runs.push({ start: d, end: d });
  }
  return runs;
}

export function cycleStats(runs: Run[]): CycleStats {
  const cycles: number[] = [];
  for (let i = 1; i < runs.length; i++) {
    const len = daysBetween(runs[i - 1].start, runs[i].start);
    if (len >= 15 && len <= MAX_GAP_FOR_CYCLE) cycles.push(len);
  }
  const recent = cycles.slice(-6);
  const lengths = runs.slice(-6).map((r) => daysBetween(r.start, r.end) + 1).filter((n) => n >= 2 && n <= 10);
  const avg = (xs: number[], fallback: number) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : fallback);
  return { avgCycle: avg(recent, DEFAULT_CYCLE), avgLength: avg(lengths, DEFAULT_LENGTH), cycles: recent.length };
}

/**
 * 各日の周期の状態（生理期・キラキラ期）を返す。
 * キラキラ期 = 生理終了の翌日 〜 排卵日の目安（次の生理開始の14日前）の前日。
 */
export function dayPhases(runs: Run[], stats: CycleStats, today: string, aheadDays = 100) {
  const map = new Map<string, DayPhase>();
  const set = (d: string, phase: Phase, predicted: boolean) => {
    if (!map.has(d) || map.get(d)!.phase === 'kirakira') map.set(d, { phase, predicted });
  };
  const fill = (from: string, to: string, phase: Phase, predicted: (d: string) => boolean) => {
    for (let d = from; d <= to; d = addDays(d, 1)) set(d, phase, predicted(d));
  };
  const future = (d: string) => d > today;
  if (!runs.length) return { map, next: null as string | null };

  // 記録された生理期とその後のキラキラ期
  runs.forEach((run, i) => {
    fill(run.start, run.end, 'period', () => false);
    const nextActual = runs[i + 1] && daysBetween(run.start, runs[i + 1].start) <= MAX_GAP_FOR_CYCLE ? runs[i + 1].start : null;
    if (!nextActual && i < runs.length - 1) return; // 記録の空白期間には推定しない
    const nextStart = nextActual ?? addDays(run.start, stats.avgCycle);
    const kEnd = addDays(nextStart, -15);
    if (addDays(run.end, 1) <= kEnd) fill(addDays(run.end, 1), kEnd, 'kirakira', (d) => !nextActual && future(d));
  });

  // 最新の生理が続いている場合（終わりの記録が昨日か今日）は残りを予測
  const last = runs[runs.length - 1];
  if (daysBetween(last.end, today) <= 1) {
    const expectedEnd = addDays(last.start, stats.avgLength - 1);
    if (expectedEnd > last.end) fill(addDays(last.end, 1), expectedEnd, 'period', () => true);
  }

  // 次回以降の予定（最後の記録から一定期間が空いていたら予測しない）
  let next: string | null = null;
  if (daysBetween(last.start, today) <= MAX_GAP_FOR_CYCLE * 2) {
    const limit = addDays(today, aheadDays);
    for (let k = 1; ; k++) {
      const ps = addDays(last.start, stats.avgCycle * k);
      if (ps > limit) break;
      if (ps <= last.end) continue;
      if (!next && ps >= addDays(today, -stats.avgLength + 1)) next = ps;
      const pe = addDays(ps, stats.avgLength - 1);
      fill(ps, pe, 'period', () => true);
      const kEnd = addDays(ps, stats.avgCycle - 15);
      if (addDays(pe, 1) <= kEnd) fill(addDays(pe, 1), kEnd, 'kirakira', () => true);
    }
  }
  return { map, next };
}
