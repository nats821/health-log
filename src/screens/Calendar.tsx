import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import type { Go } from '../App';
import { formatJa, parseISO, toISO, today } from '../date';
import { db } from '../db';
import { ENERGY_LABEL, LEVEL_LABEL, MEAL_LABEL, PERIOD_LABEL } from '../labels';
import { didExercise } from '../stats';

const WEEK = ['月', '火', '水', '木', '金', '土', '日'];

export default function CalendarScreen({ go, initialDate }: { go: Go; initialDate?: string }) {
  const t = today();
  const [selected, setSelected] = useState(initialDate ?? t);
  const sel = parseISO(selected);
  const [month, setMonth] = useState({ y: sel.getFullYear(), m: sel.getMonth() });

  const first = toISO(new Date(month.y, month.m, 1));
  const last = toISO(new Date(month.y, month.m + 1, 0));
  const data = useLiveQuery(async () => {
    const [daily, ex, meas] = await Promise.all([
      db.daily.where('date').between(first, last, true, true).toArray(),
      db.exercises.where('date').between(first, last, true, true).toArray(),
      db.measurements.where('date').between(first, last, true, true).toArray(),
    ]);
    return { daily: new Map(daily.map((r) => [r.date, r])), ex, meas: new Set(meas.map((m) => m.date)) };
  }, [first, last]);
  const detail = useLiveQuery(
    async () => ({
      rec: await db.daily.get(selected),
      ex: await db.exercises.where('date').equals(selected).toArray(),
      meas: await db.measurements.get(selected),
    }),
    [selected],
  );

  const lead = (new Date(month.y, month.m, 1).getDay() + 6) % 7; // 月曜はじまり
  const days = new Date(month.y, month.m + 1, 0).getDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => toISO(new Date(month.y, month.m, i + 1)))];
  const shift = (n: number) => setMonth(({ y, m }) => ({ y: m + n < 0 ? y - 1 : m + n > 11 ? y + 1 : y, m: (m + n + 12) % 12 }));

  const rec = detail?.rec;
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
            const r = data?.daily.get(d);
            const exCount = data?.ex.filter((e) => e.date === d).length ?? 0;
            const morning = r?.weight != null || r?.morningAt != null;
            const evening = r?.eveningAt != null || r?.neat != null || r?.strength != null;
            return (
              <button
                key={d}
                className={`cal-day ${d === selected ? 'sel' : ''} ${d === t ? 'today' : ''} ${d > t ? 'future' : ''}`}
                onClick={() => setSelected(d)}
              >
                <span className="cal-num">{parseISO(d).getDate()}</span>
                <span className="dots">
                  {morning && <i className="dot morning" />}
                  {evening && <i className="dot evening" />}
                  {didExercise(r, exCount) && <i className="dot exercise" />}
                  {r?.period === 'during' && <i className="dot period" />}
                  {r?.period === 'pre' && <i className="dot period-pre" />}
                  {data?.meas.has(d) && <i className="dot measure" />}
                </span>
              </button>
            );
          })}
        </div>
        <div className="legend small muted">
          <span><i className="dot morning" />朝</span>
          <span><i className="dot evening" />夜</span>
          <span><i className="dot exercise" />運動</span>
          <span><i className="dot period" />生理</span>
          <span><i className="dot period-pre" />生理前</span>
          <span><i className="dot measure" />計測</span>
        </div>
      </section>

      <section className="card form">
        <h2>{formatJa(selected)}</h2>
        {rec || detail?.ex.length || detail?.meas ? (
          <dl className="day-detail">
            {rec?.weight != null && <Row k="体重" v={`${rec.weight}kg`} />}
            {rec?.bodyFat != null && <Row k="体脂肪率" v={`${rec.bodyFat}%`} />}
            {rec?.sleepMinutes != null && <Row k="睡眠" v={`${Math.floor(rec.sleepMinutes / 60)}時間${rec.sleepMinutes % 60}分`} />}
            {rec?.energy && <Row k="元気度" v={ENERGY_LABEL[rec.energy]} />}
            {rec?.steps != null && <Row k="歩数" v={`${rec.steps.toLocaleString()}歩`} />}
            {rec?.neat && <Row k="NEAT" v={LEVEL_LABEL[rec.neat]} />}
            {rec?.strength && <Row k="筋トレ" v={LEVEL_LABEL[rec.strength]} />}
            {rec?.cardio && <Row k="有酸素" v={LEVEL_LABEL[rec.cardio]} />}
            {rec?.meal && <Row k="食事" v={MEAL_LABEL[rec.meal]} />}
            {rec?.period && rec.period !== 'none' && <Row k="生理" v={PERIOD_LABEL[rec.period]} />}
            {detail?.ex.length ? <Row k="運動の詳細" v={detail.ex.map((e) => e.name).join('、')} /> : null}
            {detail?.meas && <Row k="月次計測" v="あり" />}
            {rec?.memo && <Row k="メモ" v={rec.memo} />}
          </dl>
        ) : (
          <p className="muted small">この日の記録はありません</p>
        )}
        {selected <= t && (
          <div className="grid2">
            <button className="secondary" onClick={() => go('morning', selected)}>朝を記録・修正</button>
            <button className="secondary" onClick={() => go('evening', selected)}>夜を記録・修正</button>
            <button className="secondary" onClick={() => go('exercise', selected)}>運動の詳細</button>
            <button className="secondary" onClick={() => go('monthly', selected)}>月次計測</button>
          </div>
        )}
      </section>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt>{k}</dt>
      <dd>{v}</dd>
    </>
  );
}
