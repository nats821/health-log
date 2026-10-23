import { describe, expect, it } from 'vitest';
import { dailyToCsv } from './csv';
import { addDays, weekStart } from './date';
import { compareWindows, firstGoal, goalProgress, latest, measureDiff, measurementContext, nextMilestone, rollingSeries, startWeight, suggestCardioLevel, weeklyStrengthCount, windowAverage } from './stats';
import type { DailyRecord, Settings } from './types';

const rec = (date: string, extra: Partial<DailyRecord> = {}): DailyRecord => ({ date, updatedAt: '', ...extra });
const settings: Settings = { id: 'main', goalWeight: 53, milestones: [60, 55, 53], sleepHighlightMinutes: 360, cardioLightMin: 10, cardioGoodMin: 30 };

describe('date', () => {
  it('月・年をまたいで暦日で加算する', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });
  it('週の始まりは月曜', () => {
    expect(weekStart('2026-10-25')).toBe('2026-10-19'); // 日曜
    expect(weekStart('2026-10-19')).toBe('2026-10-19'); // 月曜
  });
});

describe('14暦日平均', () => {
  it('件数ではなく暦日で区切り、有効日数を返す', () => {
    const records = [
      rec('2026-10-23', { weight: 64 }),
      rec('2026-10-10', { weight: 66 }), // 14日目（含む）
      rec('2026-10-09', { weight: 99 }), // 15日前（含まない）
      rec('2026-10-15', {}), // 体重なし
    ];
    const w = windowAverage(records, 'weight', '2026-10-23');
    expect(w.avg).toBe(65);
    expect(w.count).toBe(2);
    expect(w.start).toBe('2026-10-10');
  });

  it('記録がなければ null', () => {
    expect(windowAverage([], 'weight', '2026-10-23').avg).toBeNull();
  });

  it('直前14暦日との差', () => {
    const records = [rec('2026-10-20', { weight: 64 }), rec('2026-10-01', { weight: 65 })];
    const c = compareWindows(records, 'weight', '2026-10-23');
    expect(c.previous.start).toBe('2026-09-26');
    expect(c.previous.end).toBe('2026-10-09');
    expect(c.diff).toBeCloseTo(-1);
  });

  it('グラフ用の系列は暦日ごとに1点', () => {
    const s = rollingSeries([rec('2026-10-02', { weight: 65 })], 'weight', '2026-10-01', '2026-10-03');
    expect(s.map((p) => p.value)).toEqual([null, 65, null]);
    expect(s.map((p) => p.avg)).toEqual([null, 65, 65]);
  });
});

describe('ホーム用の値', () => {
  it('最新体重と開始体重', () => {
    const r = [rec('2026-09-01', { weight: 65.2 }), rec('2026-10-01', { weight: 64 }), rec('2026-08-01', { weight: 66 })];
    expect(latest(r, 'weight')).toEqual({ date: '2026-10-01', value: 64 });
    expect(startWeight(r, { ...settings, startDate: '2026-08-15' })).toBe(65.2);
    expect(startWeight(r, { ...settings, startWeight: 65 })).toBe(65);
  });

  it('筋トレは○と◎だけ数え、未入力と×は数えない', () => {
    const r = [
      rec('2026-10-19', { strength: 'good' }),
      rec('2026-10-20', { strength: 'light' }),
      rec('2026-10-21', { strength: 'none' }),
      rec('2026-10-22', {}),
      rec('2026-10-18', { strength: 'good' }), // 先週
    ];
    expect(weeklyStrengthCount(r, '2026-10-23')).toBe(2);
  });

  it('次のマイルストーン', () => {
    expect(nextMilestone(64.8, settings)).toBe(60);
    expect(nextMilestone(58, settings)).toBe(55);
    expect(nextMilestone(52.9, settings)).toBeNull();
  });
});

describe('CSV', () => {
  it('BOM付き・日付順・未入力は空欄・カンマや改行をエスケープ', () => {
    const csv = dailyToCsv([
      rec('2026-10-02', { neat: 'none', memo: 'むくみ, だるい\n早寝' }),
      rec('2026-10-01', { weight: 64.5, strength: 'good', meal: 'junk' }),
    ]);
    expect(csv.startsWith('﻿日付,')).toBe(true);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[1]).toBe('2026-10-01,64.5,,,,,,◎,,ジャンク,,');
    expect(lines[2]).toBe('2026-10-02,,,,,,×,,,,,"むくみ, だるい\n早寝"');
  });
});

describe('目標の進み具合', () => {
  it('第1目標は最終目標より上で一番重いマイルストーン', () => {
    expect(firstGoal(settings)).toBe(60);
    expect(firstGoal({ ...settings, milestones: [53] })).toBeNull();
  });
  it('開始65kg→目標53kgで現在59kgなら50%、増えても0%にとどめる', () => {
    expect(goalProgress(65, 59, 53)).toBeCloseTo(0.5);
    expect(goalProgress(65, 66, 53)).toBe(0);
    expect(goalProgress(65, 52, 53)).toBe(1);
    expect(goalProgress(null, 60, 53)).toBeNull();
  });
});

describe('月次計測の比較', () => {
  const list = [
    { date: '2026-08-01', waist: 86, updatedAt: '' },
    { date: '2026-09-01', waist: 85, updatedAt: '' },
    { date: '2026-10-01', waist: 83.5, hip: 96, updatedAt: '' },
  ];
  it('前回と開始時（最初の計測）を返し、差を計算する', () => {
    const { current, previous, first } = measurementContext(list, '2026-10-01');
    expect(previous?.date).toBe('2026-09-01');
    expect(first?.date).toBe('2026-08-01');
    expect(measureDiff(current, previous, 'waist')).toBeCloseTo(-1.5);
    expect(measureDiff(current, first, 'waist')).toBeCloseTo(-2.5);
    expect(measureDiff(current, previous, 'hip')).toBeNull();
  });
  it('最初の計測日には前回・開始時はない', () => {
    const c = measurementContext(list, '2026-08-01');
    expect(c.previous).toBeUndefined();
    expect(c.first).toBeUndefined();
  });
});

describe('有酸素の提案', () => {
  it('設定の分数で判定、1〜9分は×、0分は提案しない', () => {
    expect(suggestCardioLevel(0, settings)).toBeUndefined();
    expect(suggestCardioLevel(5, settings)).toBe('none');
    expect(suggestCardioLevel(10, settings)).toBe('light');
    expect(suggestCardioLevel(30, settings)).toBe('good');
  });
});
