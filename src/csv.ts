import { ENERGY_LABEL, KIND_LABEL, LEVEL_LABEL, MEAL_CHOICE_LABEL, MEAL_LABEL, MEASURE_LABEL, PERIOD_LABEL, SNACK_LABEL, STOOL_LABEL } from './labels';
import { type DailyRecord, type ExerciseEntry, MEASURE_KEYS, type Measurement } from './types';

const HEADER = [
  '日付', '体重(kg)', '体脂肪率(%)', '睡眠(分)', '元気度', '歩数',
  'NEAT', '筋トレ', '有酸素', '食事(1日のまとめ)', '生理', 'メモ', '間食(以前の形式)', 'お通じ(回)', '便の状態', '体調の変化', '区分',
  '朝食', '昼食', '夕食', '間食',
];

function cell(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** 日次データのCSV。Excelで文字化けしないよう UTF-8 BOM 付き・CRLF */
export function dailyToCsv(records: DailyRecord[]): string {
  const rows = [...records]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) =>
      [
        r.date,
        r.weight,
        r.bodyFat,
        r.sleepMinutes,
        r.energy && ENERGY_LABEL[r.energy],
        r.steps,
        r.neat && LEVEL_LABEL[r.neat],
        r.strength && LEVEL_LABEL[r.strength],
        r.cardio && LEVEL_LABEL[r.cardio],
        r.meal && MEAL_LABEL[r.meal],
        r.period && PERIOD_LABEL[r.period],
        r.memo,
        r.snack && SNACK_LABEL[r.snack],
        r.bowelCount,
        r.stool && STOOL_LABEL[r.stool],
        r.condition,
        r.importedFrom ? '過去データ' : '',
        r.breakfast && MEAL_CHOICE_LABEL[r.breakfast],
        r.lunch && MEAL_CHOICE_LABEL[r.lunch],
        r.dinner && MEAL_CHOICE_LABEL[r.dinner],
        r.snackFood && MEAL_CHOICE_LABEL[r.snackFood],
      ].map(cell).join(','),
    );
  return '﻿' + [HEADER.join(','), ...rows].join('\r\n') + '\r\n';
}

export function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function toCsv(header: string[], rows: unknown[][]) {
  return '﻿' + [header.join(','), ...rows.map((r) => r.map(cell).join(','))].join('\r\n') + '\r\n';
}

export function exercisesToCsv(list: ExerciseEntry[]): string {
  const rows = [...list]
    .sort((a, b) => a.date.localeCompare(b.date) || (a.id ?? 0) - (b.id ?? 0))
    .map((e) => [e.date, KIND_LABEL[e.kind], e.name, e.minutes, e.weightKg, e.reps, e.sets]);
  return toCsv(['日付', '種類', '種目', '分', '重さ(kg)', '回数', 'セット'], rows);
}

export function measurementsToCsv(list: Measurement[]): string {
  const rows = [...list]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => [m.date, ...MEASURE_KEYS.map((k) => m[k]), m.memo]);
  return toCsv(['日付', ...MEASURE_KEYS.map((k) => `${MEASURE_LABEL[k]}(cm)`), 'メモ'], rows);
}
