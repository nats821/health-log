import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { DateField } from '../components/DateField';
import { formatJa, today } from '../date';
import { db, getSettings } from '../db';
import { MEASURE_LABEL } from '../labels';
import { measureDiff, measurementContext } from '../stats';
import { MEASURE_KEYS, type MeasureKey, type Measurement } from '../types';

type Form = Record<MeasureKey, string>;
const empty = (): Form => Object.fromEntries(MEASURE_KEYS.map((k) => [k, ''])) as Form;

export default function Monthly({ initialDate, notify }: { initialDate?: string; notify: (m: string) => void }) {
  const [date, setDate] = useState(initialDate ?? today());
  const [form, setForm] = useState<Form>(empty());
  const [memo, setMemo] = useState('');
  const all = useLiveQuery(() => db.measurements.toArray(), []);
  const settings = useLiveQuery(getSettings, []);

  useEffect(() => {
    db.measurements.get(date).then((m) => {
      setForm(Object.fromEntries(MEASURE_KEYS.map((k) => [k, m?.[k]?.toString() ?? ''])) as Form);
      setMemo(m?.memo ?? '');
    });
  }, [date]);

  if (!all || !settings) return null;
  const start = settings.startDate ?? '';
  const { previous, first } = measurementContext(all, date, start);

  const save = async () => {
    const m: Measurement = { date, updatedAt: new Date().toISOString() };
    for (const k of MEASURE_KEYS) {
      const s = form[k].trim().replace(',', '.');
      if (s === '') continue;
      const v = Number(s);
      if (!(v > 5 && v < 200)) return notify(`${MEASURE_LABEL[k]}の数字を確認してください`);
      m[k] = Math.round(v * 10) / 10;
    }
    if (memo.trim()) m.memo = memo.trim();
    await db.measurements.put(m);
    notify('計測を保存しました');
  };

  const current: Measurement = { date, updatedAt: '' };
  for (const k of MEASURE_KEYS) if (form[k].trim() !== '' && !isNaN(Number(form[k]))) current[k] = Number(form[k]);
  const history = [...all].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="stack">
      <header className="page-head">
        <h1>月次ボディチェック</h1>
        <p className="muted small">月に1回、同じ時間帯・同じ位置で測ると比べやすくなります。</p>
      </header>
      <section className="card form">
        <DateField value={date} onChange={setDate} />
        <table className="measure">
          <thead>
            <tr>
              <th />
              <th>今回(cm)</th>
              <th>前回比</th>
              <th>開始時比</th>
            </tr>
          </thead>
          <tbody>
            {MEASURE_KEYS.map((k) => (
              <tr key={k}>
                <th>{MEASURE_LABEL[k]}</th>
                <td>
                  <input inputMode="decimal" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                </td>
                <td className="diff">{fmt(measureDiff(current, previous, k))}</td>
                <td className="diff">{fmt(measureDiff(current, first, k))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small">
          前回：{previous ? formatJa(previous.date) : 'なし'}　開始時：{first ? formatJa(first.date) : 'なし'}
          （今回のダイエットの計測どうしで比べます）
        </p>
        <label className="field">
          <span>メモ</span>
          <textarea rows={2} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="測った時間帯など（任意）" />
        </label>
        <button className="primary" onClick={save}>保存する</button>
      </section>

      <section className="card soon">
        <p className="label">比較写真</p>
        <p className="muted small">
          正面・横・後ろの写真は、まだ保存できません。本人認証と暗号化などの保護の仕組みを用意してから追加します。
        </p>
      </section>

      {history.length > 0 && (
        <section className="card">
          <h2>これまでの計測</h2>
          <ul className="history">
            {history.map((m) => (
              <li key={m.date}>
                <button className="link left" onClick={() => setDate(m.date)}>
                  {formatJa(m.date)}・{m.date.slice(0, 4)}
                  {m.date < start && <span className="tag past">過去の記録</span>}
                </button>
                <span className="muted small">{MEASURE_KEYS.filter((k) => m[k] != null).map((k) => `${MEASURE_LABEL[k]} ${m[k]}`).join(' / ')}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function fmt(d: number | null) {
  if (d == null) return '—';
  const r = Math.round(d * 10) / 10;
  return (r > 0 ? '+' : r < 0 ? '−' : '±') + Math.abs(r).toFixed(1);
}
