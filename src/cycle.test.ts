import { describe, expect, it } from 'vitest';
import { addDays } from './date';
import { cycleStats, dayPhases, periodRuns } from './cycle';
import type { DailyRecord } from './types';

const during = (start: string, days: number): DailyRecord[] =>
  Array.from({ length: days }, (_, i) => ({ date: addDays(start, i), period: 'during', updatedAt: '' }));

describe('periodRuns', () => {
  it('連続した生理中の日をまとめ、1日の記録漏れはつなげる', () => {
    const recs = [...during('2026-09-01', 2), ...during('2026-09-04', 2), ...during('2026-09-29', 5)];
    expect(periodRuns(recs)).toEqual([
      { start: '2026-09-01', end: '2026-09-05' },
      { start: '2026-09-29', end: '2026-10-03' },
    ]);
  });
});

describe('cycleStats', () => {
  it('開始日の間隔から平均周期、日数の平均を出す', () => {
    const runs = periodRuns([...during('2026-08-01', 5), ...during('2026-08-30', 5), ...during('2026-09-29', 6)]);
    expect(cycleStats(runs)).toEqual({ avgCycle: 30, avgLength: 5, cycles: 2 });
  });
  it('記録の空白（60日超）は周期に数えない。記録が少なければ28日', () => {
    const runs = periodRuns([...during('2024-01-01', 5), ...during('2026-10-01', 5)]);
    expect(cycleStats(runs).avgCycle).toBe(28);
    expect(cycleStats(runs).cycles).toBe(0);
  });
});

describe('dayPhases', () => {
  const recs = [...during('2026-08-30', 5), ...during('2026-09-29', 5)];
  const runs = periodRuns(recs);
  const stats = cycleStats(runs); // 周期30日・5日間
  const { map, next } = dayPhases(runs, stats, '2026-10-23');

  it('記録した生理期は予測ではない', () => {
    expect(map.get('2026-09-29')).toEqual({ phase: 'period', predicted: false });
  });
  it('生理終了の翌日から、次の生理の15日前までがキラキラ期', () => {
    // 8/30開始 → 次は9/29 → 9/14まで
    expect(map.get('2026-09-04')).toEqual({ phase: 'kirakira', predicted: false });
    expect(map.get('2026-09-14')?.phase).toBe('kirakira');
    expect(map.get('2026-09-15')).toBeUndefined();
  });
  it('次の生理予定日を予測し、予測は区別される', () => {
    expect(next).toBe('2026-10-29');
    expect(map.get('2026-10-29')).toEqual({ phase: 'period', predicted: true });
    expect(map.get('2026-11-03')).toEqual({ phase: 'kirakira', predicted: true });
  });
  it('今日まで続いている生理は、平均日数まで予測で延ばす', () => {
    const r = periodRuns([...recs, ...during('2026-10-22', 2)]);
    const { map: m } = dayPhases(r, cycleStats(r), '2026-10-23');
    expect(m.get('2026-10-23')).toEqual({ phase: 'period', predicted: false });
    expect(m.get('2026-10-24')).toEqual({ phase: 'period', predicted: true });
  });
  it('記録がなければ何も出さない', () => {
    expect(dayPhases([], stats, '2026-10-23').map.size).toBe(0);
  });
});
