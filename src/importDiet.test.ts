import { describe, expect, it } from 'vitest';
import { fillEmpty, parseDateCell, parseDietRows } from './importDiet';

const header5 = [null, null, null, null, null, '朝', null, null, null, null, null, null, null, null, null, 'ヘルシープレート'];
const header6 = [null, 'date', null, '写\n真', 'ブログ\n更新', '体重', '体脂\n肪率', 'BMI', '睡眠\n時間', '生理', '基礎\n代謝', '歩数', '筋トレ', 'きんに君', 'サボり筋', '朝', '昼', '夜', '間\n食', '首周り', 'ウエスト', 'おへそ\nの所', 'どれだけ痩せた？', '体重', '月の\n満欠', null];

function row(cells: Record<number, unknown>) {
  const r: unknown[] = Array(26).fill(null);
  for (const [k, v] of Object.entries(cells)) r[+k] = v;
  return r;
}

describe('parseDateCell', () => {
  it('Excelシリアル値', () => expect(parseDateCell(45017, {})).toBe('2023-04-01'));
  it('文字列・和暦', () => {
    expect(parseDateCell('2023/4/1', {})).toBe('2023-04-01');
    expect(parseDateCell('令和5年4月1日', {})).toBe('2023-04-01');
    expect(parseDateCell('R6.1.2', {})).toBe('2024-01-02');
  });
  it('年なしの日付は前の行から年を引き継ぎ、年またぎも処理', () => {
    const ctx = {};
    expect(parseDateCell('2023/12/31', ctx)).toBe('2023-12-31');
    expect(parseDateCell('1/1', ctx)).toBe('2024-01-01');
  });
  it('読めないものは null', () => expect(parseDateCell('メモ', {})).toBeNull());
});

describe('parseDietRows', () => {
  const rows = [
    ['（サンプル）早めに寝る'],
    [null, null, null, null, null, null, null, null, null, null, null, '（サンプル）目標メモ'],
    header5,
    header6,
    row({ 0: 1, 1: 45017, 2: '土', 5: 70, 6: 30, 7: 22, 8: 0.25, 11: 5000, 12: '◯', 15: '△', 16: '◯', 17: '◯', 18: '✕', 19: 30, 20: 70, 21: 80, 22: 0, 23: 69 }),
    row({ 1: 45018, 5: 69.5, 6: '-', 9: '生理前', 12: '胸/腹筋/下半身', 15: '◯', 16: '✕', 17: '◯', 25: 'からあげ食べた' }),
    row({ 1: 45019, 9: 'キラキラ', 12: 'お休みデー', 3: '★' }),
    row({ 1: 45019, 5: 60 }),
    row({ 1: 'あとで', 5: 60 }),
    row({ 1: 45020, 22: 3, 23: 60.9 }), // 数式の列だけ → 記録にしない
  ];
  const r = parseDietRows(rows, { junkWhenCross: true });

  it('表の上の目標メモを拾う', () => {
    expect(r.notes).toContain('（サンプル）目標メモ');
  });
  it('体重・体脂肪・睡眠・歩数を変換。「-」は空欄', () => {
    const d = r.daily[0];
    expect(d).toMatchObject({ date: '2023-04-01', weight: 70, bodyFat: 30, sleepMinutes: 360, steps: 5000, strength: 'light', meal: 'healthy' });
    expect(r.daily[1].bodyFat).toBeUndefined();
  });
  it('「どれだけ痩せた？」の体重列ではなく最初の体重列を使う', () => {
    expect(r.daily[0].weight).toBe(70);
  });
  it('生理・筋トレの文字・食事の✕・コメントをメモに残す', () => {
    const d = r.daily[1];
    expect(d.period).toBe('pre');
    expect(d.strength).toBe('light');
    expect(d.meal).toBe('junk');
    expect(d.memo).toContain('からあげ食べた');
    expect(d.memo).toContain('筋トレ:胸/腹筋/下半身');
    const d3 = r.daily[2];
    expect(d3.period).toBeUndefined();
    expect(d3.strength).toBe('none');
    expect(d3.memo).toContain('周期:キラキラ');
    expect(d3.memo).toContain('写真あり');
  });
  it('重複日と読めない日付はスキップして理由を出す', () => {
    expect(r.skipped.map((s) => s.reason)).toEqual([
      expect.stringContaining('重複'),
      expect.stringContaining('日付を読めません'),
    ]);
  });
  it('数式（計算結果）の列だけの日は記録にしない', () => {
    expect(r.daily.map((d) => d.date)).toEqual(['2023-04-01', '2023-04-02', '2023-04-03']);
  });
  it('計測：おへその所→おへそ周り、ウエストはメモへ', () => {
    expect(r.measurements).toHaveLength(1);
    expect(r.measurements[0]).toMatchObject({ date: '2023-04-01', neck: 30, waist: 80, memo: 'ウエスト 70' });
  });
  it('ジャンク判定はオプションで切れる', () => {
    expect(parseDietRows(rows, { junkWhenCross: false }).daily[1].meal).toBe('healthy');
  });
});

describe('fillEmpty', () => {
  it('既存の値は上書きせず、空欄だけ補う', () => {
    expect(fillEmpty({ date: 'x', weight: 60 } as Record<string, unknown>, { date: 'x', weight: 62, bodyFat: 30, importedFrom: 't' })).toEqual({ date: 'x', weight: 60, bodyFat: 30 });
  });
});
