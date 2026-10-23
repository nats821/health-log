import { ENERGY_LABEL, LEVEL_LABEL, MEAL_LABEL, PERIOD_LABEL } from './labels';
import type { DailyRecord } from './types';

const HEADER = [
  '日付', '体重(kg)', '体脂肪率(%)', '睡眠(分)', '元気度',
  'NEAT', '筋トレ', '有酸素', '食事', '生理', 'メモ',
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
        r.neat && LEVEL_LABEL[r.neat],
        r.strength && LEVEL_LABEL[r.strength],
        r.cardio && LEVEL_LABEL[r.cardio],
        r.meal && MEAL_LABEL[r.meal],
        r.period && PERIOD_LABEL[r.period],
        r.memo,
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
