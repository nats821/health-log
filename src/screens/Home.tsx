import { useLiveQuery } from 'dexie-react-hooks';
import type { Screen } from '../App';
import { formatJa, today } from '../date';
import { db, getSettings } from '../db';
import { compareWindows, latest, nextMilestone, round1, startWeight, weeklyStrengthCount } from '../stats';

export default function Home({ go }: { go: (s: Screen) => void }) {
  const records = useLiveQuery(() => db.daily.toArray(), []);
  const settings = useLiveQuery(getSettings, []);
  if (!records || !settings) return null;

  const t = today();
  const todayRec = records.find((r) => r.date === t);
  const morningDone = todayRec?.weight != null || todayRec?.morningAt != null;
  const eveningDone = todayRec?.eveningAt != null;

  const last = latest(records, 'weight');
  const cmp = compareWindows(records, 'weight', t);
  const start = startWeight(records, settings);
  const ref = cmp.current.avg ?? last?.value ?? null;
  const fromStart = ref != null && start != null ? ref - start : null;
  const toGoal = ref != null ? ref - settings.goalWeight : null;
  const milestone = ref != null ? nextMilestone(ref, settings) : null;
  const strength = weeklyStrengthCount(records, t);
  const lowSleep =
    settings.sleepHighlightMinutes > 0 &&
    todayRec?.sleepMinutes != null &&
    todayRec.sleepMinutes < settings.sleepHighlightMinutes;

  return (
    <div className="stack">
      <header className="page-head">
        <p className="muted">{formatJa(t)}</p>
        <h1>今日も、自分のペースで</h1>
      </header>

      <div className="big-buttons">
        <button className="big morning" onClick={() => go('morning')}>
          <span className="big-title">朝の記録</span>
          <span className="big-sub">{morningDone ? '記録済み ✓ 修正する' : '体重・体脂肪・睡眠・元気度'}</span>
        </button>
        <button className="big evening" onClick={() => go('evening')}>
          <span className="big-title">夜の記録</span>
          <span className="big-sub">{eveningDone ? '記録済み ✓ 修正する' : '運動・食事・生理・メモ'}</span>
        </button>
      </div>

      <section className="card">
        <div className="grid2">
          <Stat label="最新の体重" value={last ? `${last.value.toFixed(1)}` : '—'} unit="kg" note={last ? formatJa(last.date) : 'まだ記録がありません'} />
          <Stat
            label="14日間の平均"
            value={cmp.current.avg != null ? round1(cmp.current.avg).toFixed(1) : '—'}
            unit="kg"
            note={`${cmp.current.count}/14日分の記録`}
          />
          <Stat
            label="開始時から"
            value={fromStart != null ? signed(fromStart) : '—'}
            unit="kg"
            note={start != null ? `開始 ${start.toFixed(1)}kg` : '設定で開始日を決められます'}
          />
          <Stat
            label={`${settings.goalWeight}kgまで`}
            value={toGoal != null ? (toGoal > 0 ? round1(toGoal).toFixed(1) : '到達') : '—'}
            unit={toGoal != null && toGoal > 0 ? 'kg' : ''}
            note={milestone != null && milestone !== settings.goalWeight ? `次の目安 ${milestone}kg` : '14日平均で計算'}
          />
        </div>
      </section>

      {todayRec?.sleepMinutes != null && (
        <section className={`card row-between ${lowSleep ? 'sleep-note' : ''}`}>
          <div>
            <p className="label">昨夜の睡眠</p>
            <p className="value">
              {Math.floor(todayRec.sleepMinutes / 60)}<span className="unit">時間</span>
              {todayRec.sleepMinutes % 60}<span className="unit">分</span>
            </p>
          </div>
          {lowSleep && <p className="muted small">短めの日。無理せずいきましょう</p>}
        </section>
      )}

      <section className="card row-between">
        <div>
          <p className="label">今週の筋トレ</p>
          <p className="value">{strength}<span className="unit">回</span></p>
        </div>
        <p className="muted small">休息日も大切な日です</p>
      </section>

      <section className="card soon">
        <p className="label">月次ボディチェック</p>
        <p className="muted small">サイズ計測と比較写真は次の段階（Phase 2・3）で追加予定です。</p>
      </section>
    </div>
  );
}

function Stat({ label, value, unit, note }: { label: string; value: string; unit: string; note?: string }) {
  return (
    <div className="stat">
      <p className="label">{label}</p>
      <p className="value">
        {value}
        {value !== '—' && <span className="unit">{unit}</span>}
      </p>
      {note && <p className="muted small">{note}</p>}
    </div>
  );
}

function signed(n: number) {
  const r = round1(n);
  return (r > 0 ? '+' : r < 0 ? '−' : '±') + Math.abs(r).toFixed(1);
}
