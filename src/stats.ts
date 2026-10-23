import { addDays, weekStart } from './date';
import type { DailyRecord, Settings } from './types';

export type NumKey = 'weight' | 'bodyFat';

export interface WindowAvg {
  avg: number | null;
  count: number; // 有効な測定日数
  days: number;
  start: string;
  end: string;
}

function indexByDate(records: DailyRecord[]) {
  return new Map(records.map((r) => [r.date, r]));
}

/** end を含む直近 days 暦日の平均（記録件数ではなく暦日で区切る） */
export function windowAverage(
  records: DailyRecord[] | Map<string, DailyRecord>,
  key: NumKey,
  end: string,
  days = 14,
): WindowAvg {
  const map = records instanceof Map ? records : indexByDate(records);
  let sum = 0;
  let count = 0;
  for (let i = 0; i < days; i++) {
    const v = map.get(addDays(end, -i))?.[key];
    if (typeof v === 'number') {
      sum += v;
      count++;
    }
  }
  return { avg: count ? sum / count : null, count, days, start: addDays(end, -(days - 1)), end };
}

/** 直近14暦日と、その直前14暦日の平均・差 */
export function compareWindows(records: DailyRecord[], key: NumKey, end: string, days = 14) {
  const map = indexByDate(records);
  const current = windowAverage(map, key, end, days);
  const previous = windowAverage(map, key, addDays(end, -days), days);
  const diff = current.avg != null && previous.avg != null ? current.avg - previous.avg : null;
  return { current, previous, diff };
}

export interface SeriesPoint {
  date: string;
  value: number | null;
  avg: number | null;
  count: number;
}

/** from〜to の各暦日について、その日の値と14暦日平均を返す（グラフ用） */
export function rollingSeries(records: DailyRecord[], key: NumKey, from: string, to: string, days = 14) {
  const map = indexByDate(records);
  const out: SeriesPoint[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const w = windowAverage(map, key, d, days);
    const v = map.get(d)?.[key];
    out.push({ date: d, value: typeof v === 'number' ? v : null, avg: w.avg, count: w.count });
  }
  return out;
}

export function latest(records: DailyRecord[], key: NumKey) {
  let best: { date: string; value: number } | null = null;
  for (const r of records) {
    const v = r[key];
    if (typeof v === 'number' && (!best || r.date > best.date)) best = { date: r.date, value: v };
  }
  return best;
}

/** 開始体重：設定値があればそれ、なければ開始日以降で最初の体重 */
export function startWeight(records: DailyRecord[], settings: Settings) {
  if (settings.startWeight != null) return settings.startWeight;
  const from = settings.startDate ?? '';
  let best: DailyRecord | null = null;
  for (const r of records) {
    if (r.weight == null || r.date < from) continue;
    if (!best || r.date < best.date) best = r;
  }
  return best?.weight ?? null;
}

/** 今週（月曜はじまり）の筋トレ回数（○と◎を数える） */
export function weeklyStrengthCount(records: DailyRecord[], day: string) {
  const start = weekStart(day);
  const end = addDays(start, 6);
  return records.filter(
    (r) => r.date >= start && r.date <= end && (r.strength === 'light' || r.strength === 'good'),
  ).length;
}

/** 次に目指すマイルストーン（現在値より下で一番近いもの） */
export function nextMilestone(current: number, settings: Settings) {
  const sorted = [...settings.milestones, settings.goalWeight].sort((a, b) => b - a);
  return sorted.find((m) => m < current) ?? null;
}

export const round1 = (n: number) => Math.round(n * 10) / 10;
