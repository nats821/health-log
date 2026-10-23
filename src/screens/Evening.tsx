import { useLiveQuery } from 'dexie-react-hooks';
import type { Go } from '../App';
import { useEffect, useState } from 'react';
import { DateField } from '../components/DateField';
import { Segmented } from '../components/Segmented';
import { addDays, today } from '../date';
import { cardioMinutes, suggestCardioLevel } from '../stats';
import { db, getSettings, saveDaily } from '../db';
import { cardioDesc, cardioHint, LEVEL_LABEL, MEAL_LABEL, NEAT_DESC, NEAT_HINT, PERIOD_LABEL, SNACK_LABEL, STOOL_LABEL, STRENGTH_DESC, STRENGTH_HINT } from '../labels';
import type { Level, Meal, Period, Snack, Stool } from '../types';

const LEVELS: Level[] = ['none', 'light', 'good'];
const levelOptions = (hints: Record<Level, string>) =>
  LEVELS.map((v) => ({ value: v, label: LEVEL_LABEL[v], hint: hints[v] }));

export default function Evening({ initialDate, go, onSaved }: { initialDate?: string; go: Go; onSaved: () => void }) {
  const settings = useLiveQuery(getSettings, []);
  const [date, setDate] = useState(initialDate ?? today());
  const [neat, setNeat] = useState<Level | undefined>();
  const [strength, setStrength] = useState<Level | undefined>();
  const [cardio, setCardio] = useState<Level | undefined>();
  const [meal, setMeal] = useState<Meal>('healthy');
  const [period, setPeriod] = useState<Period | undefined>();
  const [yesterdayPeriod, setYesterdayPeriod] = useState<Period | undefined>();
  const [snack, setSnack] = useState<Snack | undefined>();
  const [bowel, setBowel] = useState('');
  const [stool, setStool] = useState<Stool | undefined>();
  const [condition, setCondition] = useState('');
  const [memo, setMemo] = useState('');
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await db.daily.get(date);
      setNeat(r?.neat);
      setStrength(r?.strength);
      setCardio(r?.cardio);
      setMeal(r?.meal ?? 'healthy');
      setMemo(r?.memo ?? '');
      setSnack(r?.snack);
      setBowel(r?.bowelCount?.toString() ?? '');
      setStool(r?.stool);
      setCondition(r?.condition ?? '');
      setShowMore(r?.snack != null || r?.bowelCount != null || r?.stool != null || !!r?.condition);
      // 生理は未入力のまま。前日の状態はワンタップで引き継げるように表示だけする
      setPeriod(r?.period);
      setYesterdayPeriod((await db.daily.get(addDays(date, -1)))?.period);
    })();
  }, [date]);

  const save = async (leave = true) => {
    await saveDaily(date, {
      neat,
      strength,
      cardio,
      meal,
      period,
      snack,
      bowelCount: bowel.trim() === '' || isNaN(Number(bowel)) ? undefined : Math.max(0, Math.round(Number(bowel))),
      stool,
      condition: condition.trim() || undefined,
      memo: memo.trim() || undefined,
      eveningAt: new Date().toISOString(),
    });
    if (leave) onSaved();
  };

  const entries = useLiveQuery(() => db.exercises.where('date').equals(date).toArray(), [date]) ?? [];
  const cMin = cardioMinutes(entries);
  const suggested = settings ? suggestCardioLevel(cMin, settings) : undefined;

  const cHint = settings ? cardioHint(settings.cardioLightMin, settings.cardioGoodMin) : cardioHint(10, 30);

  return (
    <div className="stack">
      <header className="page-head">
        <h1>夜の記録</h1>
      </header>
      <section className="card form">
        <DateField value={date} onChange={setDate} />
        <LevelField title="NEAT（日常活動量）" value={neat} onChange={setNeat} options={levelOptions(NEAT_HINT)} desc={NEAT_DESC} />
        <LevelField title="筋トレ" value={strength} onChange={setStrength} options={levelOptions(STRENGTH_HINT)} desc={STRENGTH_DESC} />
        <LevelField title="有酸素運動" value={cardio} onChange={setCardio} options={levelOptions(cHint)} desc={settings ? cardioDesc(settings.cardioLightMin, settings.cardioGoodMin) : cardioDesc(10, 30)} />
        {cMin > 0 && (
          <p className="muted small hint-row">
            運動の詳細では有酸素 合計{cMin}分
            {suggested && suggested !== cardio && (
              <button className="link" onClick={() => setCardio(suggested)}>→ {LEVEL_LABEL[suggested]}にする</button>
            )}
          </p>
        )}
        <button className="link left" onClick={async () => { await save(false); go('exercise', date); }}>
          ＋ 運動の詳細を記録する（任意）
        </button>
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
          <span>
            生理
            <em className={period ? 'state' : 'state unset'}>{period ? '' : '未入力'}</em>
          </span>
          <Segmented
            clearable
            value={period}
            onChange={setPeriod}
            options={(['none', 'pre', 'during'] as Period[]).map((v) => ({ value: v, label: PERIOD_LABEL[v] }))}
          />
          {!period && yesterdayPeriod && yesterdayPeriod !== 'none' && (
            <button className="link left small" onClick={() => setPeriod(yesterdayPeriod)}>
              昨日と同じ（{PERIOD_LABEL[yesterdayPeriod]}）にする
            </button>
          )}
        </div>

        <button className="link left" onClick={() => setShowMore(!showMore)}>
          {showMore ? '− ' : '＋ '}間食・お通じ・体調（任意）
        </button>
        {showMore && (
          <div className="more">
            <div className="field">
              <span>間食<em className={snack ? 'state' : 'state unset'}>{snack ? '' : '未入力'}</em></span>
              <Segmented clearable value={snack} onChange={setSnack} options={(['none', 'some'] as Snack[]).map((v) => ({ value: v, label: SNACK_LABEL[v] }))} />
            </div>
            <div className="grid2">
              <label className="field">
                <span>お通じ</span>
                <div className="with-unit">
                  <input inputMode="numeric" placeholder="未入力" value={bowel} onChange={(e) => setBowel(e.target.value)} />
                  <em>回</em>
                </div>
              </label>
            </div>
            <div className="field">
              <span>便の状態<em className={stool ? 'state' : 'state unset'}>{stool ? '' : '未入力'}</em></span>
              <Segmented clearable value={stool} onChange={setStool} options={(['hard', 'normal', 'soft'] as Stool[]).map((v) => ({ value: v, label: STOOL_LABEL[v] }))} />
            </div>
            <label className="field">
              <span>体調の変化</span>
              <input placeholder="むくみ、肌の調子、だるさなど" value={condition} onChange={(e) => setCondition(e.target.value)} />
            </label>
          </div>
        )}
        <label className="field">
          <span>メモ</span>
          <textarea rows={3} placeholder="気づいたことなど（任意）" value={memo} onChange={(e) => setMemo(e.target.value)} />
        </label>
        <p className="muted small">選んだボタンをもう一度押すと「未入力」に戻ります。「×」「なし」とは別に保存されます。</p>
        <button className="primary" onClick={() => save()}>保存する</button>
      </section>
    </div>
  );
}

function LevelField(props: {
  title: string;
  value: Level | undefined;
  onChange: (v: Level | undefined) => void;
  options: { value: Level; label: string; hint: string }[];
  desc: Record<Level, string>;
}) {
  return (
    <div className="field">
      <span>
        {props.title}
        <em className={props.value ? 'state' : 'state unset'}>{props.value ? '' : '未入力'}</em>
      </span>
      <Segmented clearable value={props.value} onChange={props.onChange} options={props.options} />
      {props.value && <p className="muted small">{LEVEL_LABEL[props.value]}：{props.desc[props.value]}</p>}
    </div>
  );
}
