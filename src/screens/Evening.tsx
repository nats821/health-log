import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Segmented } from '../components/Segmented';
import { addDays, today } from '../date';
import { db, getSettings, saveDaily } from '../db';
import { cardioHint, LEVEL_LABEL, MEAL_LABEL, NEAT_HINT, PERIOD_LABEL, STRENGTH_HINT } from '../labels';
import type { Level, Meal, Period } from '../types';

const LEVELS: Level[] = ['none', 'light', 'good'];
const levelOptions = (hints: Record<Level, string>) =>
  LEVELS.map((v) => ({ value: v, label: LEVEL_LABEL[v], hint: hints[v] }));

export default function Evening({ onSaved }: { onSaved: () => void }) {
  const settings = useLiveQuery(getSettings, []);
  const [date, setDate] = useState(today());
  const [neat, setNeat] = useState<Level | undefined>();
  const [strength, setStrength] = useState<Level | undefined>();
  const [cardio, setCardio] = useState<Level | undefined>();
  const [meal, setMeal] = useState<Meal>('healthy');
  const [period, setPeriod] = useState<Period>('none');
  const [memo, setMemo] = useState('');

  useEffect(() => {
    (async () => {
      const r = await db.daily.get(date);
      setNeat(r?.neat);
      setStrength(r?.strength);
      setCardio(r?.cardio);
      setMeal(r?.meal ?? 'healthy');
      setMemo(r?.memo ?? '');
      // 生理の状態は前日から引き継ぐと入力が楽
      setPeriod(r?.period ?? (await db.daily.get(addDays(date, -1)))?.period ?? 'none');
    })();
  }, [date]);

  const save = async () => {
    await saveDaily(date, {
      neat,
      strength,
      cardio,
      meal,
      period,
      memo: memo.trim() || undefined,
      eveningAt: new Date().toISOString(),
    });
    onSaved();
  };

  const cHint = settings ? cardioHint(settings.cardioLightMin, settings.cardioGoodMin) : cardioHint(10, 30);

  return (
    <div className="stack">
      <header className="page-head">
        <h1>夜の記録</h1>
      </header>
      <section className="card form">
        <label className="field">
          <span>日付</span>
          <input type="date" value={date} max={today()} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
        <LevelField title="NEAT（日常の動き）" value={neat} onChange={setNeat} options={levelOptions(NEAT_HINT)} />
        <LevelField title="筋トレ" value={strength} onChange={setStrength} options={levelOptions(STRENGTH_HINT)} />
        <LevelField title="有酸素" value={cardio} onChange={setCardio} options={levelOptions(cHint)} />
        <div className="field">
          <span>食事</span>
          <Segmented
            value={meal}
            onChange={(v) => v && setMeal(v)}
            options={(['healthy', 'junk'] as Meal[]).map((v) => ({ value: v, label: MEAL_LABEL[v] }))}
          />
          <p className="muted small">ジャンクを食べた日だけ切り替えればOK（自分の感覚での記録です）</p>
        </div>
        <div className="field">
          <span>生理</span>
          <Segmented
            value={period}
            onChange={(v) => v && setPeriod(v)}
            options={(['none', 'pre', 'during'] as Period[]).map((v) => ({ value: v, label: PERIOD_LABEL[v] }))}
          />
        </div>
        <label className="field">
          <span>メモ</span>
          <textarea rows={3} placeholder="気づいたこと、体調など（任意）" value={memo} onChange={(e) => setMemo(e.target.value)} />
        </label>
        <button className="primary" onClick={save}>保存する</button>
      </section>
    </div>
  );
}

function LevelField(props: {
  title: string;
  value: Level | undefined;
  onChange: (v: Level | undefined) => void;
  options: { value: Level; label: string; hint: string }[];
}) {
  return (
    <div className="field">
      <span>
        {props.title}
        <em className={props.value ? 'state' : 'state unset'}>{props.value ? '' : '未入力'}</em>
      </span>
      <Segmented clearable value={props.value} onChange={props.onChange} options={props.options} />
    </div>
  );
}
