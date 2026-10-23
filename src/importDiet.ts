import { toISO } from './date';
import { mealSummary } from './stats';
import type { DailyRecord, Level, MealChoice, Measurement, MeasureKey, Period } from './types';

/** 2023Diet.xlsx（シート diet）の行データを、からだログの記録に変換する。保存はしない */

export const IMPORT_TAG = 'excel-2023diet';

export interface ImportOptions {
  /** 元の表の食事欄（朝・昼・夜）の✕を「ジャンク」として取り込む（オフなら✕の食事は未入力のまま） */
  junkWhenCross: boolean;
}

export interface ImportResult {
  notes: string[]; // 表の上にある目標・メモ
  daily: DailyRecord[];
  measurements: Measurement[];
  skipped: { row: number; reason: string }[];
  warnings: string[];
  firstDate?: string;
  lastDate?: string;
}

type Cell = unknown;
const norm = (v: Cell) => (v == null ? '' : String(v).replace(/\s+/g, ''));

const YES = /^[◯○〇oO]$/;
const NO = /^[✕×xX✖]$/;

/** Excelのシリアル値・文字列（2023/4/1, 4/1, 令和5年4月1日, R5.4.1）を YYYY-MM-DD に */
export function parseDateCell(v: Cell, ctx: { year?: number; month?: number }): string | null {
  let d: Date | null = null;
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const ms = Date.UTC(1899, 11, 30) + Math.round(v) * 86400000;
    const u = new Date(ms);
    d = new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate());
  } else if (v instanceof Date && !isNaN(v.getTime())) {
    d = new Date(v.getFullYear(), v.getMonth(), v.getDate());
  } else if (typeof v === 'string') {
    const s = v.trim().replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
    let m: RegExpMatchArray | null;
    if ((m = s.match(/^(\d{4})[/\-.年](\d{1,2})[/\-.月](\d{1,2})日?$/))) d = new Date(+m[1], +m[2] - 1, +m[3]);
    else if ((m = s.match(/^(?:令和|R)(元|\d{1,2})[年.](\d{1,2})[月.](\d{1,2})日?$/i)))
      d = new Date(2018 + (m[1] === '元' ? 1 : +m[1]), +m[2] - 1, +m[3]);
    else if ((m = s.match(/^(\d{1,2})[/月](\d{1,2})日?$/)) && ctx.year) {
      let y = ctx.year;
      if (ctx.month != null && +m[1] - 1 < ctx.month - 6) y++; // 12月→1月の年またぎ
      d = new Date(y, +m[1] - 1, +m[2]);
    }
  }
  if (!d || isNaN(d.getTime())) return null;
  ctx.year = d.getFullYear();
  ctx.month = d.getMonth();
  return toISO(d);
}

function numIn(v: Cell, min: number, max: number): number | undefined | 'bad' {
  if (v == null || v === '' || v === '-' || v === '−' || v === 'ー') return undefined;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.]/g, ''));
  if (!isFinite(n) || String(v).trim() === '') return 'bad';
  return n >= min && n <= max ? Math.round(n * 100) / 100 : 'bad';
}

/** 睡眠：Excelの時刻(1日の割合)、時間数、"7:30" のどれでも分に */
function sleepMinutes(v: Cell): number | undefined {
  if (typeof v === 'number') {
    if (v > 0 && v < 1) return Math.round(v * 1440);
    if (v >= 1 && v <= 16) return Math.round(v * 60);
    return undefined;
  }
  const m = typeof v === 'string' && v.match(/^(\d{1,2}):(\d{2})/);
  return m ? +m[1] * 60 + +m[2] : undefined;
}

const MEASURE_COLS: Record<string, MeasureKey> = {
  首周り: 'neck',
  おへその所: 'waist',
  おへそ周り: 'waist',
  ヒップ: 'hip',
  太もも右: 'thigh',
  ふくらはぎ右: 'calf',
  足首: 'ankle',
  二の腕: 'upperArm',
};
const EXTRA_MEASURE_COLS = ['バストトップ', 'アンダー', 'ウエスト', '太もも左', 'ふくらはぎ左'];

export function parseDietRows(rows: Cell[][], opts: ImportOptions): ImportResult {
  const res: ImportResult = { notes: [], daily: [], measurements: [], skipped: [], warnings: [] };
  const headerIdx = rows.findIndex((r) => r?.some((c) => ['date', '日付'].includes(norm(c).toLowerCase())));
  if (headerIdx < 0) {
    res.warnings.push('「date」または「日付」の見出し行が見つかりませんでした');
    return res;
  }
  const header = rows[headerIdx].map(norm);
  // 同名の列（体重・体脂肪率は「どれだけ痩せた？」にもある）は最初の列を使う
  const col = (name: string) => header.indexOf(name);
  const c = {
    date: header.findIndex((h) => ['date', '日付'].includes(h.toLowerCase())),
    weight: col('体重'), fat: col('体脂肪率'), sleep: col('睡眠時間'), period: col('生理'),
    bmr: col('基礎代謝'), steps: col('歩数'), strength: col('筋トレ'), kinnikun: col('きんに君'),
    saborikin: col('サボり筋'), breakfast: col('朝'), lunch: col('昼'), dinner: col('夜'), snack: col('間食'),
    photo: col('写真'), blog: col('ブログ更新'),
  };
  const moon = col('月の満欠');
  const commentCol = moon >= 0 && !header[moon + 1] ? moon + 1 : -1;

  for (const r of rows.slice(0, Math.max(0, headerIdx - 1)))
    for (const v of r ?? []) if (typeof v === 'string' && v.trim()) res.notes.push(v.trim());

  const ctx: { year?: number; month?: number } = {};
  const seen = new Set<string>();
  rows.slice(headerIdx + 1).forEach((r, i) => {
    const rowNo = headerIdx + 2 + i;
    if (!r || !r.some((v) => v != null && v !== '')) return;
    const dateCell = r[c.date];
    if (dateCell == null || dateCell === '') return;
    const date = parseDateCell(dateCell, ctx);
    if (!date) return res.skipped.push({ row: rowNo, reason: `日付を読めませんでした（${String(dateCell)}）` });
    if (seen.has(date)) return res.skipped.push({ row: rowNo, reason: `${date} がファイル内で重複（先の行を採用）` });
    seen.add(date);

    const get = (i: number) => (i >= 0 ? r[i] : undefined);
    const text = (i: number) => (i >= 0 && r[i] != null ? String(r[i]).trim() : '');
    const rec: DailyRecord = { date, updatedAt: new Date().toISOString(), importedFrom: IMPORT_TAG };
    const extra: string[] = [];

    const w = numIn(get(c.weight), 25, 200);
    if (w === 'bad') res.warnings.push(`${rowNo}行目：体重「${String(get(c.weight))}」は範囲外のため空欄にしました`);
    else if (w != null) rec.weight = Math.round(w * 100) / 100;
    const f = numIn(get(c.fat), 1, 70);
    if (f === 'bad') res.warnings.push(`${rowNo}行目：体脂肪率「${String(get(c.fat))}」は範囲外のため空欄にしました`);
    else if (f != null) rec.bodyFat = f;
    const sl = sleepMinutes(get(c.sleep));
    if (sl != null) rec.sleepMinutes = sl;
    const st = numIn(get(c.steps), 0, 100000);
    if (typeof st === 'number') rec.steps = Math.round(st);

    const p = text(c.period);
    const periodMap: Record<string, Period> = { 生理前: 'pre', 生理: 'during', 生理中: 'during' };
    if (periodMap[p]) rec.period = periodMap[p];
    else if (p) extra.push(`周期:${p}`);

    const s = text(c.strength);
    let level: Level | undefined;
    if (YES.test(s)) level = 'light';
    else if (NO.test(s) || /休/.test(s) || s.startsWith('✕')) level = 'none';
    else if (/筋|半身|腹|胸|尻|脚|腕/.test(s) && !/↓/.test(s)) level = 'light';
    if (s && !YES.test(s) && !NO.test(s)) extra.push(`筋トレ:${s}`);
    if (YES.test(text(c.kinnikun))) {
      if (level !== 'good') level = 'light';
      extra.push('きんに君');
    }
    if (level) rec.strength = level;
    const sab = text(c.saborikin);
    if (sab) extra.push(`サボり筋:${sab}`);

    const plate = [c.breakfast, c.lunch, c.dinner].map(text);
    const snack = text(c.snack);
    if (plate.some(Boolean) || snack) {
      // 元の記号はメモに残す（◯△✕の意味は元の表のまま）
      extra.push(`元の表の食事欄 朝${plate[0] || '-'}昼${plate[1] || '-'}夜${plate[2] || '-'}${snack ? ` 間食${snack}` : ''}`);
      // ◯△→ヘルシー、✕→ジャンク（オプション）。間食欄は意味が表によって違うため取り込まない
      const toChoice = (v: string): MealChoice | undefined =>
        YES.test(v) || v === '△' ? 'healthy' : NO.test(v) && opts.junkWhenCross ? 'junk' : undefined;
      const [b, l, d] = plate.map(toChoice);
      if (b) rec.breakfast = b;
      if (l) rec.lunch = l;
      if (d) rec.dinner = d;
      const summary = mealSummary([b, l, d]);
      if (summary) rec.meal = summary;
      else if (plate.some(Boolean)) rec.meal = 'healthy';
    }

    const bmr = numIn(get(c.bmr), 500, 4000);
    if (typeof bmr === 'number') extra.push(`基礎代謝${bmr}`);
    if (text(c.photo)) extra.push('写真あり');
    const blog = text(c.blog);
    if (blog.length > 2) extra.push(blog);

    const comment = commentCol >= 0 ? text(commentCol) : '';
    const memo = [comment, extra.length ? `［Excel］${extra.join(' / ')}` : ''].filter(Boolean).join('\n');
    if (memo) rec.memo = memo;

    const m: Measurement = { date, updatedAt: rec.updatedAt, importedFrom: IMPORT_TAG };
    let hasM = false;
    const mExtra: string[] = [];
    header.forEach((h, i) => {
      const v = numIn(r[i], 5, 200);
      if (typeof v !== 'number') return;
      if (MEASURE_COLS[h]) {
        m[MEASURE_COLS[h]] = v;
        hasM = true;
      } else if (EXTRA_MEASURE_COLS.includes(h)) {
        mExtra.push(`${h} ${v}`);
        hasM = true;
      }
    });
    if (hasM) {
      if (mExtra.length) m.memo = mExtra.join(' / ');
      res.measurements.push(m);
    }

    const hasData = Object.keys(rec).some((k) => !['date', 'updatedAt', 'importedFrom'].includes(k));
    if (hasData) res.daily.push(rec);
  });

  const dates = res.daily.map((d) => d.date).sort();
  res.firstDate = dates[0];
  res.lastDate = dates[dates.length - 1];
  return res;
}

/** 既存の記録に、空いている項目だけ補う（上書きはしない） */
export function fillEmpty<T extends object>(existing: T, incoming: T): T {
  const out = { ...existing } as Record<string, unknown>;
  for (const [k, v] of Object.entries(incoming)) if (out[k] === undefined && k !== 'importedFrom') out[k] = v;
  return out as T;
}
