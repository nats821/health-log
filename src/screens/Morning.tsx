import { useEffect, useState } from 'react';
import { DateField } from '../components/DateField';
import { Segmented } from '../components/Segmented';
import { today } from '../date';
import { db, saveDaily } from '../db';
import { ENERGY_LABEL } from '../labels';
import type { Energy } from '../types';

const num = (s: string) => (s.trim() === '' ? undefined : Number(s.replace(',', '.')));

export default function Morning({ initialDate, onSaved }: { initialDate?: string; onSaved: () => void }) {
  const [date, setDate] = useState(initialDate ?? today());
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [sleepH, setSleepH] = useState('');
  const [sleepM, setSleepM] = useState('');
  const [energy, setEnergy] = useState<Energy | undefined>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    db.daily.get(date).then((r) => {
      setWeight(r?.weight?.toString() ?? '');
      setBodyFat(r?.bodyFat?.toString() ?? '');
      setSleepH(r?.sleepMinutes != null ? String(Math.floor(r.sleepMinutes / 60)) : '');
      setSleepM(r?.sleepMinutes != null ? String(r.sleepMinutes % 60) : '');
      setEnergy(r?.energy);
    });
  }, [date]);

  const save = async () => {
    const w = num(weight);
    const f = num(bodyFat);
    const h = num(sleepH);
    const m = num(sleepM);
    if (w != null && !(w >= 25 && w <= 200)) return setError('体重は25〜200kgの範囲で入力してください');
    if (f != null && !(f >= 1 && f <= 70)) return setError('体脂肪率は1〜70%の範囲で入力してください');
    if (h != null && !(h >= 0 && h <= 24)) return setError('睡眠時間（時間）を確認してください');
    if (m != null && !(m >= 0 && m <= 59)) return setError('睡眠時間（分）は0〜59で入力してください');
    const sleep = h == null && m == null ? undefined : Math.round((h ?? 0) * 60 + (m ?? 0));
    await saveDaily(date, {
      weight: w != null ? Math.round(w * 10) / 10 : undefined,
      bodyFat: f != null ? Math.round(f * 10) / 10 : undefined,
      sleepMinutes: sleep,
      energy,
      morningAt: new Date().toISOString(),
    });
    onSaved();
  };

  return (
    <div className="stack">
      <header className="page-head">
        <h1>朝の記録</h1>
      </header>
      <section className="card form">
        <DateField value={date} onChange={setDate} />
        <div className="grid2">
          <label className="field">
            <span>体重</span>
            <div className="with-unit">
              <input inputMode="decimal" placeholder="例 64.8" value={weight} onChange={(e) => setWeight(e.target.value)} />
              <em>kg</em>
            </div>
          </label>
          <label className="field">
            <span>体脂肪率</span>
            <div className="with-unit">
              <input inputMode="decimal" placeholder="例 32.5" value={bodyFat} onChange={(e) => setBodyFat(e.target.value)} />
              <em>%</em>
            </div>
          </label>
        </div>
        <div className="field">
          <span>睡眠時間</span>
          <div className="grid2">
            <div className="with-unit">
              <input inputMode="numeric" placeholder="7" value={sleepH} onChange={(e) => setSleepH(e.target.value)} />
              <em>時間</em>
            </div>
            <div className="with-unit">
              <input inputMode="numeric" placeholder="0" value={sleepM} onChange={(e) => setSleepM(e.target.value)} />
              <em>分</em>
            </div>
          </div>
        </div>
        <div className="field">
          <span>元気度</span>
          <Segmented
            clearable
            value={energy}
            onChange={setEnergy}
            options={(['good', 'normal', 'tired'] as Energy[]).map((v) => ({ value: v, label: ENERGY_LABEL[v] }))}
          />
        </div>
        {error && <p className="error">{error}</p>}
        <button className="primary" onClick={save}>保存する</button>
        <p className="muted small center">空欄の項目は「未入力」として保存されます</p>
      </section>
    </div>
  );
}
