import {
  CategoryScale, Chart as ChartJS, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip,
} from 'chart.js';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { addDays, formatJa, formatShort, parseISO, today } from '../date';
import { db } from '../db';
import { compareWindows, type NumKey, rollingSeries, round1 } from '../stats';
import type { DailyRecord } from '../types';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const RANGES = [
  { id: '1w', label: '1週', days: 7 },
  { id: '1m', label: '1月', days: 30 },
  { id: '3m', label: '3月', days: 91 },
  { id: '6m', label: '6月', days: 182 },
  { id: '1y', label: '1年', days: 365 },
  { id: 'all', label: '全期間', days: 0 },
];

export default function Graph() {
  const records = useLiveQuery(() => db.daily.toArray(), []);
  const [range, setRange] = useState('1m');
  if (!records) return null;
  const earliest = records.reduce((min, r) => (r.date < min ? r.date : min), today());
  const fixed = RANGES.find((r) => r.id === range)!.days;
  const days = fixed || Math.max(7, Math.round((parseISO(today()).getTime() - parseISO(earliest).getTime()) / 86400000) + 1);

  return (
    <div className="stack">
      <header className="page-head">
        <h1>グラフ</h1>
      </header>
      <div className="chips">
        {RANGES.map((r) => (
          <button key={r.id} className={r.id === range ? 'on' : ''} onClick={() => setRange(r.id)}>{r.label}</button>
        ))}
      </div>
      <MetricChart records={records} metric="weight" title="体重" unit="kg" days={days} color="#a58fd0" avgColor="#e58fae" />
      <MetricChart records={records} metric="bodyFat" title="体脂肪率" unit="%" days={days} color="#7fb6d9" avgColor="#e58fae" />
      <p className="muted small center">平均は「記録件数」ではなく「直近14暦日」で計算しています。</p>
    </div>
  );
}

function MetricChart(props: {
  records: DailyRecord[]; metric: NumKey; title: string; unit: string; days: number; color: string; avgColor: string;
}) {
  const { records, metric, title, unit, days, color, avgColor } = props;
  const t = today();
  const cmp = compareWindows(records, metric, t);
  const series = useMemo(() => rollingSeries(records, metric, addDays(t, -(days - 1)), t), [records, metric, days, t]);
  const hasData = series.some((p) => p.value != null);

  return (
    <section className="card">
      <div className="row-between">
        <h2>{title}</h2>
        <span className="muted small">{formatJa(cmp.current.start)}〜{formatJa(cmp.current.end)}</span>
      </div>
      <div className="grid3">
        <div className="stat">
          <p className="label">直近14日平均</p>
          <p className="value">{cmp.current.avg != null ? round1(cmp.current.avg).toFixed(1) : '—'}<span className="unit">{unit}</span></p>
          <p className="muted small">{cmp.current.count}/14日分</p>
        </div>
        <div className="stat">
          <p className="label">その前の14日</p>
          <p className="value">{cmp.previous.avg != null ? round1(cmp.previous.avg).toFixed(1) : '—'}<span className="unit">{unit}</span></p>
          <p className="muted small">{cmp.previous.count}/14日分</p>
        </div>
        <div className="stat">
          <p className="label">変化</p>
          <p className={`value trend ${trendClass(cmp.diff)}`}>{cmp.diff != null ? diffText(cmp.diff) : '—'}<span className="unit">{cmp.diff != null ? unit : ''}</span></p>
          <p className="muted small">{trendWord(cmp.diff)}</p>
        </div>
      </div>
      {hasData ? (
        <div className="chart-box">
          <Line
            data={{
              labels: series.map((p) => (days > 400 ? p.date.slice(2, 7).replace('-', '/') : formatShort(p.date))),
              datasets: [
                {
                  label: '日々の値',
                  data: series.map((p) => p.value),
                  borderColor: color,
                  backgroundColor: color,
                  pointRadius: days > 400 ? 1 : days > 100 ? 1.5 : 3,
                  showLine: false,
                },
                {
                  label: '14日平均',
                  data: series.map((p) => (p.avg != null ? round1(p.avg) : null)),
                  borderColor: avgColor,
                  backgroundColor: avgColor,
                  borderWidth: 2,
                  pointRadius: 0,
                  tension: 0.3,
                  spanGaps: true,
                },
              ],
            }}
            options={{
              maintainAspectRatio: false,
              animation: false,
              interaction: { mode: 'index', intersect: false },
              plugins: {
                legend: { labels: { boxWidth: 10, font: { size: 11 } } },
                tooltip: {
                  callbacks: {
                    afterBody: (items) => {
                      const p = series[items[0].dataIndex];
                      return p ? `14日平均の対象：${p.count}日分` : '';
                    },
                  },
                },
              },
              scales: {
                x: { grid: { display: false }, ticks: { maxTicksLimit: 6, font: { size: 10 } } },
                y: { grid: { color: '#f0ecf5' }, ticks: { font: { size: 10 } } },
              },
            }}
          />
        </div>
      ) : (
        <p className="muted small center empty">この期間の記録はまだありません</p>
      )}
    </section>
  );
}

function diffText(d: number) {
  const r = round1(d);
  return (r > 0 ? '+' : r < 0 ? '−' : '±') + Math.abs(r).toFixed(1);
}
function trendClass(d: number | null) {
  if (d == null) return '';
  const r = round1(d);
  return r < 0 ? 'down' : r > 0 ? 'up' : '';
}
function trendWord(d: number | null) {
  if (d == null) return 'データがたまると表示';
  const r = round1(d);
  if (r < 0) return 'ゆるやかに減少';
  if (r > 0) return '少し増加・波はつきもの';
  return 'キープ';
}
