import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import type { Go } from '../App';
import { cycleStats, dayPhases, periodRuns } from '../cycle';
import { addDays, formatJa, parseISO, toISO, today } from '../date';
import { db, getSettings, saveDaily } from '../db';
import { ENERGY_LABEL, LEVEL_LABEL, MEAL_LABEL, PERIOD_LABEL, SNACK_LABEL, STOOL_LABEL } from '../labels';
import { didExercise } from '../stats';

const WEEK = ['月', '火', '水', '木', '金', '土', '日'];

const ic = { width: 11, height: 11, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const ExIcon = () => (<svg {...ic}><path d="M7 7v10M4 9.5v5M17 7v10M20 9.5v5M7 12h10" /></svg>);
const MoonIcon = () => (<svg {...ic}><path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z" /></svg>);
const RulerIcon = () => (<svg {...ic}><rect x="3" y="8" width="18" height="8" rx="2" /><path d="M7 8v3M11 8v4M15 8v3" /></svg>);

export default function CalendarScreen({ go, initialDate }: { go: Go; initialDate?: string }) {
  const t = today();
  const [selected, setSelected] = useState(initialDate ?? t);
  const sel = parseISO(selected);
  const [month, setMonth] = useState({ y: sel.getFullYear(), m: sel.getMonth() });

  const first = toISO(new Date(month.y, month.m, 1));
  const last = toISO(new Date(month.y, month.m + 1, 0));
  const daily = useLiveQuery(() => db.daily.toArray(), []);
  const monthData = useLiveQuery(async () => {
    const [ex, meas] = await Promise.all([
      db.exercises.where('date').between(first, last, true, true).toArray(),
      db.measurements.where('date').between(first, last, true, true).toArray(),
    ]);
    return { ex: new Set(ex.map((e) => e.date)), meas: new Set(meas.map((m) => m.date)) };
  }, [first, last]);
  const detail = useLiveQuery(
    async () => ({
      ex: await db.exercises.where('date').equals(selected).toArray(),
      meas: await db.measurements.get(selected),
    }),
    [selected],
  );
  const settings = useLiveQuery(getSettings, []);

  const byDate = useMemo(() => new Map((daily ?? []).map((r) => [r.date, r])), [daily]);
  const cycle = useMemo(() => {
    const runs = periodRuns(daily ?? []);
    const stats = cycleStats(runs);
    return { runs, stats, ...dayPhases(runs, stats, t) };
  }, [daily, t]);

  const lead = (new Date(month.y, month.m, 1).getDay() + 6) % 7; // 月曜はじまり
  const days = new Date(month.y, month.m + 1, 0).getDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => toISO(new Date(month.y, month.m, i + 1)))];
  const shift = (n: number) => setMonth(({ y, m }) => ({ y: m + n < 0 ? y - 1 : m + n > 11 ? y + 1 : y, m: (m + n + 12) % 12 }));

  // 生理の開始・終了の記録
  const rec = byDate.get(selected);
  const openRun = [...cycle.runs].reverse().find((r) => r.start <= selected && (parseISO(selected).getTime() - parseISO(r.start).getTime()) / 86400000 <= 10);
  const markStart = () => saveDaily(selected, { period: 'during' });
  const markEnd = async () => {
    if (!openRun) return;
    for (let d = openRun.start; d <= selected; d = addDays(d, 1)) if (byDate.get(d)?.period !== 'during') await saveDaily(d, { period: 'during' });
    // 終了日より後に「生理中」が付いていたら外す（終了日を前にずらしたとき）
    for (let d = addDays(selected, 1); d <= openRun.end; d = addDays(d, 1)) await saveDaily(d, { period: undefined });
  };
  const unmark = () => saveDaily(selected, { period: undefined });

  const phase = cycle.map.get(selected);
  const shortSleep = !!settings?.sleepHighlightMinutes && rec?.sleepMinutes != null && rec.sleepMinutes < settings.sleepHighlightMinutes;
  const hasAny = rec || detail?.ex.length || detail?.meas;

  return (
    <div className="stack">
      <header className="page-head">
        <h1>カレンダー</h1>
      </header>
      <section className="card">
        <div className="row-between month-nav">
          <button className="icon-btn" onClick={() => shift(-1)} aria-label="前の月">‹</button>
          <h2>{month.y}年{month.m + 1}月</h2>
          <button className="icon-btn" onClick={() => shift(1)} aria-label="次の月">›</button>
        </div>
        <div className="cal">
          {WEEK.map((w) => <div key={w} className="cal-head">{w}</div>)}
          {cells.map((d, i) => {
            if (!d) return <div key={`e${i}`} />;
            const r = byDate.get(d);
            const ph = cycle.map.get(d);
            const evening = r?.eveningAt != null || r?.neat != null || r?.strength != null || r?.cardio != null;
            return (
              <button
                key={d}
                className={[
                  'cal-day',
                  ph ? `ph-${ph.phase}` : '',
                  ph?.predicted ? 'predicted' : '',
                  d === selected ? 'sel' : '',
                  d === t ? 'today' : '',
                  d > t ? 'future' : '',
                ].join(' ')}
                onClick={() => setSelected(d)}
              >
                <span className="cal-num">{parseISO(d).getDate()}</span>
                <span className="cal-weight">{r?.weight != null ? r.weight.toFixed(1) : ''}</span>
                <span className="cal-icons">
                  {didExercise(r, monthData?.ex.has(d) ? 1 : 0) && <i className="ci ex"><ExIcon /></i>}
                  {evening && <i className="ci ev"><MoonIcon /></i>}
                  {monthData?.meas.has(d) && <i className="ci ms"><RulerIcon /></i>}
                </span>
              </button>
            );
          })}
        </div>
        <div className="legend small muted">
          <span><i className="sw ph-period" />生理期</span>
          <span><i className="sw ph-kirakira" />キラキラ期</span>
          <span><i className="sw predicted" />予測（目安）</span>
          <span><i className="ci ex"><ExIcon /></i>運動</span>
          <span><i className="ci ev"><MoonIcon /></i>夜の記録</span>
          <span><i className="ci ms"><RulerIcon /></i>計測</span>
        </div>
        {cycle.next && (
          <p className="small cycle-next">
            次の生理予定：<b>{formatJa(cycle.next)}ごろ</b>
            <span className="muted">
              （{cycle.stats.cycles ? `平均周期${cycle.stats.avgCycle}日` : '記録が少ないため28日で計算'}・あくまで目安です）
            </span>
          </p>
        )}
      </section>

      <section className="card form">
        <div className="row-between">
          <h2>{formatJa(selected)}{selected.slice(0, 4) !== t.slice(0, 4) && `・${selected.slice(0, 4)}`}</h2>
          {phase && (
            <span className={`tag ph-${phase.phase}`}>
              {phase.phase === 'period' ? '生理期' : 'キラキラ期'}
              {phase.predicted || phase.phase === 'kirakira' ? '（目安）' : ''}
            </span>
          )}
        </div>
        {rec?.importedFrom && <p className="muted small">過去のダイエット記録（Excelから取り込み）</p>}
        {hasAny ? (
          <dl className="day-detail">
            {rec?.weight != null && <Row k="体重" v={`${rec.weight}kg`} />}
            {rec?.bodyFat != null && <Row k="体脂肪率" v={`${rec.bodyFat}%`} />}
            {rec?.sleepMinutes != null && <Row k="睡眠" v={`${Math.floor(rec.sleepMinutes / 60)}時間${rec.sleepMinutes % 60}分`} short={shortSleep} />}
            {rec?.energy && <Row k="元気度" v={ENERGY_LABEL[rec.energy]} />}
            {rec?.steps != null && <Row k="歩数" v={`${rec.steps.toLocaleString()}歩`} />}
            {rec?.neat && <Row k="NEAT" v={LEVEL_LABEL[rec.neat]} />}
            {rec?.strength && <Row k="筋トレ" v={LEVEL_LABEL[rec.strength]} />}
            {rec?.cardio && <Row k="有酸素" v={LEVEL_LABEL[rec.cardio]} />}
            {rec?.meal && <Row k="食事" v={MEAL_LABEL[rec.meal]} />}
            {rec?.period && <Row k="生理" v={PERIOD_LABEL[rec.period]} />}
            {rec?.snack && <Row k="間食" v={SNACK_LABEL[rec.snack]} />}
            {rec?.bowelCount != null && <Row k="お通じ" v={`${rec.bowelCount}回${rec.stool ? `・${STOOL_LABEL[rec.stool]}` : ''}`} />}
            {rec?.bowelCount == null && rec?.stool && <Row k="便の状態" v={STOOL_LABEL[rec.stool]} />}
            {rec?.condition && <Row k="体調の変化" v={rec.condition} />}
            {detail?.ex.length ? <Row k="運動の詳細" v={detail.ex.map((e) => e.name).join('、')} /> : null}
            {detail?.meas && <Row k="月次計測" v="あり" />}
            {rec?.memo && <Row k="メモ" v={rec.memo} />}
          </dl>
        ) : (
          <p className="muted small">この日の記録はありません</p>
        )}
        {selected <= t && (
          <>
            <div className="grid2">
              <button className="secondary" onClick={() => go('morning', selected)}>朝を記録・修正</button>
              <button className="secondary" onClick={() => go('evening', selected)}>夜を記録・修正</button>
              <button className="secondary" onClick={() => go('exercise', selected)}>運動の詳細</button>
              <button className="secondary" onClick={() => go('monthly', selected)}>月次計測</button>
            </div>
            <div className="period-actions">
              {rec?.period !== 'during' && <button className="chip-btn" onClick={markStart}>この日を生理開始日にする</button>}
              {openRun && selected >= openRun.start && <button className="chip-btn" onClick={markEnd}>この日を生理終了日にする</button>}
              {rec?.period === 'during' && <button className="chip-btn plain" onClick={unmark}>この日の生理記録を外す</button>}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function Row({ k, v, short }: { k: string; v: string; short?: boolean }) {
  return (
    <>
      <dt>{k}</dt>
      <dd className={short ? 'short' : ''}>{v}{short && '（短め）'}</dd>
    </>
  );
}
