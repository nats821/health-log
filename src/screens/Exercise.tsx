import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { DateField } from '../components/DateField';
import { Segmented } from '../components/Segmented';
import { formatJa, today } from '../date';
import { db } from '../db';
import { KIND_LABEL } from '../labels';
import type { ExerciseEntry, ExerciseKind } from '../types';

const num = (s: string) => (s.trim() === '' ? undefined : Number(s.replace(',', '.')));

export default function Exercise({ initialDate, notify }: { initialDate?: string; notify: (m: string) => void }) {
  const [date, setDate] = useState(initialDate ?? today());
  const [kind, setKind] = useState<ExerciseKind>('strength');
  const [name, setName] = useState('');
  const [minutes, setMinutes] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [reps, setReps] = useState('');
  const [sets, setSets] = useState('');

  const entries = useLiveQuery(() => db.exercises.where('date').equals(date).sortBy('id'), [date]) ?? [];
  const names = useLiveQuery(async () => [...new Set((await db.exercises.toArray()).map((e) => e.name))], []) ?? [];
  const previous = useLiveQuery(async () => {
    const before = await db.exercises.where('date').below(date).last();
    if (!before) return null;
    return { date: before.date, list: await db.exercises.where('date').equals(before.date).sortBy('id') };
  }, [date]);

  const add = async () => {
    if (!name.trim()) return notify('種目を入力してください');
    const vals = [num(minutes), num(weightKg), num(reps), num(sets)];
    if (vals.some((v) => v != null && !(v >= 0 && v < 1000))) return notify('数字を確認してください');
    const [m, w, r, s] = vals;
    await db.exercises.add(clean({ date, kind, name: name.trim(), minutes: m, weightKg: w, reps: r, sets: s, createdAt: new Date().toISOString() }));
    setName('');
    setMinutes('');
    setWeightKg('');
    setReps('');
    setSets('');
    notify('追加しました');
  };

  const copyPrevious = async () => {
    if (!previous) return;
    const now = new Date().toISOString();
    await db.exercises.bulkAdd(previous.list.map(({ id: _id, ...e }) => ({ ...e, date, createdAt: now })));
    notify(`${formatJa(previous.date)}の内容をコピーしました`);
  };

  const remove = async (e: ExerciseEntry) => {
    if (e.id != null && confirm(`「${e.name}」を削除しますか？`)) await db.exercises.delete(e.id);
  };

  return (
    <div className="stack">
      <header className="page-head">
        <h1>運動の詳細</h1>
        <p className="muted small">入力は任意です。分数や重さは分かる分だけで大丈夫。</p>
      </header>

      <section className="card form">
        <DateField value={date} onChange={setDate} />
        {entries.length > 0 ? (
          <ul className="ex-list">
            {entries.map((e) => (
              <li key={e.id}>
                <span className={`tag ${e.kind}`}>{KIND_LABEL[e.kind]}</span>
                <span className="ex-name">{e.name}</span>
                <span className="muted small">{describe(e)}</span>
                <button className="icon-btn" onClick={() => remove(e)} aria-label="削除">×</button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">この日の運動の詳細はまだありません</p>
        )}
        {previous && (
          <button className="secondary" onClick={copyPrevious}>
            前回（{formatJa(previous.date)}・{previous.list.length}件）をコピー
          </button>
        )}
      </section>

      <section className="card form">
        <h2>追加する</h2>
        <Segmented
          value={kind}
          onChange={(v) => v && setKind(v)}
          options={(['strength', 'cardio', 'other'] as ExerciseKind[]).map((v) => ({ value: v, label: KIND_LABEL[v] }))}
        />
        <label className="field">
          <span>種目</span>
          <input list="ex-names" placeholder={kind === 'cardio' ? '例 ウォーキング' : '例 スクワット'} value={name} onChange={(e) => setName(e.target.value)} />
          <datalist id="ex-names">{names.map((n) => <option key={n} value={n} />)}</datalist>
        </label>
        <div className="grid2">
          <Num label="時間" unit="分" value={minutes} set={setMinutes} />
          {kind === 'strength' && <Num label="重さ" unit="kg" value={weightKg} set={setWeightKg} decimal />}
          {kind === 'strength' && <Num label="回数" unit="回" value={reps} set={setReps} />}
          {kind === 'strength' && <Num label="セット" unit="セット" value={sets} set={setSets} />}
        </div>
        <button className="primary" onClick={add}>追加</button>
        {kind === 'cardio' && <p className="muted small">1〜9分の短い運動も、ここに記録しておけます。</p>}
      </section>
    </div>
  );
}

function Num(p: { label: string; unit: string; value: string; set: (v: string) => void; decimal?: boolean }) {
  return (
    <label className="field">
      <span>{p.label}</span>
      <div className="with-unit">
        <input inputMode={p.decimal ? 'decimal' : 'numeric'} value={p.value} onChange={(e) => p.set(e.target.value)} />
        <em>{p.unit}</em>
      </div>
    </label>
  );
}

function describe(e: ExerciseEntry) {
  const parts: string[] = [];
  if (e.minutes != null) parts.push(`${e.minutes}分`);
  if (e.weightKg != null) parts.push(`${e.weightKg}kg`);
  if (e.reps != null) parts.push(`${e.reps}回`);
  if (e.sets != null) parts.push(`${e.sets}セット`);
  return parts.join(' × ');
}

function clean<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}
