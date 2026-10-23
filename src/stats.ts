import { addDays, weekStart } from './date';
import { type DailyRecord, type ExerciseEntry, type Level, type Meal, MEAL_SLOTS, type MealChoice, type MeasureKey, type Measurement, type Settings } from './types';

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

/** 運動詳細の有酸素分数の合計 */
export function cardioMinutes(entries: ExerciseEntry[]) {
  return entries.filter((e) => e.kind === 'cardio').reduce((sum, e) => sum + (e.minutes ?? 0), 0);
}

/** 有酸素の分数から設定の基準で ×/○/◎ を提案（0分なら提案しない） */
export function suggestCardioLevel(minutes: number, settings: Settings): Level | undefined {
  if (minutes <= 0) return undefined;
  if (minutes >= settings.cardioGoodMin) return 'good';
  if (minutes >= settings.cardioLightMin) return 'light';
  return 'none';
}

/** 指定日の計測と、前回・初回の計測 */
export function measurementContext(list: Measurement[], date: string, from = '') {
  // 前回・開始時は今回のダイエット期間（from 以降）の計測から選ぶ
  const sorted = [...list].filter((m) => m.date >= from).sort((a, b) => a.date.localeCompare(b.date));
  const current = list.find((m) => m.date === date);
  const before = sorted.filter((m) => m.date < date);
  const previous = before[before.length - 1];
  const first = sorted[0] && sorted[0].date < date ? sorted[0] : undefined;
  return { current, previous, first };
}

export function measureDiff(a: Measurement | undefined, b: Measurement | undefined, key: MeasureKey) {
  const x = a?.[key];
  const y = b?.[key];
  return typeof x === 'number' && typeof y === 'number' ? x - y : null;
}

/** 運動したとみなす日：○◎の筋トレ・有酸素、または運動詳細の記録あり */
export function didExercise(r: DailyRecord | undefined, entryCount: number) {
  return entryCount > 0 || ['light', 'good'].includes(r?.strength ?? '') || ['light', 'good'].includes(r?.cardio ?? '');
}

/** 第1目標（最終目標より上で一番重いマイルストーン） */
export function firstGoal(settings: Settings) {
  const above = settings.milestones.filter((m) => m > settings.goalWeight);
  return above.length ? Math.max(...above) : null;
}

/** 開始体重から最終目標までの進み具合（0〜1）。増えた場合は0にとどめる */
export function goalProgress(start: number | null, current: number | null, goal: number) {
  if (start == null || current == null || start <= goal) return null;
  return Math.min(1, Math.max(0, (start - current) / (start - goal)));
}

/** 今回のダイエット期間（開始日以降）の記録だけ */
export function currentPeriod<T extends { date: string }>(list: T[], settings: Settings): T[] {
  const from = settings.startDate ?? '';
  return list.filter((r) => r.date >= from);
}

export type Trend = 'down' | 'up' | 'flat' | 'insufficient';

/**
 * 「横ばい」とみなす差の幅（14日平均どうしの差）。
 * 体重は水分などで日に0.5〜1kg動き、家庭用体組成計の体脂肪率は日に1ポイント前後ぶれるため、
 * 平均しても残る誤差より小さい差は横ばいとする。
 */
export const TREND_FLAT: Record<NumKey, number> = { weight: 0.3, bodyFat: 0.5 };
/** 比較に必要な最低記録日数（各14日のうち） */
export const MIN_DAYS_FOR_TREND = 5;

/** 直近14日と前の14日の平均を比べて、減少・増加・横ばいを判定。記録が少なければ判定しない */
export function judgeTrend(cmp: { current: WindowAvg; previous: WindowAvg; diff: number | null }, flatRange: number): Trend {
  if (cmp.diff == null || cmp.current.count < MIN_DAYS_FOR_TREND || cmp.previous.count < MIN_DAYS_FOR_TREND) return 'insufficient';
  if (Math.abs(cmp.diff) < flatRange) return 'flat';
  return cmp.diff < 0 ? 'down' : 'up';
}

/** 食事ごとの記録から1日のまとめを出す：1つでもジャンクならジャンク、ヘルシーがあればヘルシー */
export function mealSummary(choices: (MealChoice | undefined)[]): Meal | undefined {
  if (choices.includes('junk')) return 'junk';
  if (choices.includes('healthy')) return 'healthy';
  return undefined;
}

export function hasMealDetail(r: DailyRecord | undefined) {
  return !!r && MEAL_SLOTS.some((k) => r[k] != null);
}
