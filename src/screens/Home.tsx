import { useLiveQuery } from 'dexie-react-hooks';
import type { Go } from '../App';
import { formatJa, today } from '../date';
import { db, getSettings } from '../db';
import { compareWindows, currentPeriod, firstGoal, goalProgress, judgeTrend, latest, MIN_DAYS_FOR_TREND, type NumKey, round1, startWeight, type Trend, TREND_FLAT, weeklyStrengthCount } from '../stats';
import type { DailyRecord } from '../types';

export default function Home({ go }: { go: Go }) {
  const allRecords = useLiveQuery(() => db.daily.toArray(), []);
  const lastMeasure = useLiveQuery(() => db.measurements.orderBy('date').last(), []);
  const settings = useLiveQuery(getSettings, []);
  if (!allRecords || !settings) return null;
  // 平均・達成率・増減は今回のダイエット期間（開始日以降）の記録だけで計算
  const records = currentPeriod(allRecords, settings);

  const t = today();
  const todayRec = records.find((r) => r.date === t);
  const morningDone = todayRec?.weight != null || todayRec?.morningAt != null;
  const eveningDone = todayRec?.eveningAt != null;

  const last = latest(records, 'weight');
  const cmp = compareWindows(records, 'weight', t);
  const start = startWeight(records, settings);
  // 判断は日々の値ではなく14日平均で（なければ最新値）
  const ref = cmp.current.avg ?? last?.value ?? null;
  const fromStart = ref != null && start != null ? ref - start : null;
  const goal1 = firstGoal(settings);
  const toGoal1 = ref != null && goal1 != null ? ref - goal1 : null;
  const toGoal = ref != null ? ref - settings.goalWeight : null;
  const progress = goalProgress(start, ref, settings.goalWeight);
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
          <Stat label="最新の体重" value={last ? last.value.toFixed(1) : '—'} unit="kg" note={last ? formatJa(last.date) : 'まだ記録がありません'} />
          <Stat
            label="直近14日間の平均"
            value={cmp.current.avg != null ? round1(cmp.current.avg).toFixed(1) : '—'}
            unit="kg"
            note={`${cmp.current.count}/14日分の記録`}
          />
        </div>
        <div className="summary-rows">
          <SummaryRow
            label="ダイエット開始時から"
            value={fromStart != null ? `${signed(fromStart)}kg` : '—'}
            note={start != null ? `開始 ${start.toFixed(1)}kg（${formatJa(settings.startDate!)}〜）` : '開始日以降の最初の体重が基準になります'}
          />
          {goal1 != null && (
            <SummaryRow label={`第1目標 ${goal1}kg まで`} value={remaining(toGoal1)} />
          )}
          <SummaryRow label={`最終目標 ${settings.goalWeight}kg まで`} value={remaining(toGoal)} />
        </div>
        {progress != null && start != null && (
          <div className="progress-wrap">
            <div className="progress" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
              <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
              {settings.milestones
                .filter((m) => m < start && m > settings.goalWeight)
                .map((m) => (
                  <span key={m} className="progress-mark" style={{ left: `${((start - m) / (start - settings.goalWeight)) * 100}%` }}>
                    <i />
                    <em>{m}</em>
                  </span>
                ))}
            </div>
            <div className="row-between small muted progress-ends">
              <span>開始 {start.toFixed(1)}</span>
              <span>{progress > 0 ? `${Math.round(progress * 100)}% 進みました` : 'ここから少しずつ'}</span>
              <span>{settings.goalWeight}</span>
            </div>
          </div>
        )}
        <p className="muted small">目標までの距離は、日々の上下に左右されにくい14日平均で計算しています。</p>
      </section>

      <section className="card">
        <h2>からだの変化</h2>
        <p className="muted small">直近14日間の平均を、その前の14日間と比べています（記録のない日は除く）</p>
        <div className="trend-cards">
          <TrendCard records={records} metric="weight" title="体重" unit="kg" today={t} />
          <TrendCard records={records} metric="bodyFat" title="体脂肪率" unit="pt" today={t} />
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

      <button className="card soon tappable" onClick={() => go('monthly')}>
        <p className="label">月次ボディチェック</p>
        <p className="small">
          {lastMeasure ? `前回の計測：${formatJa(lastMeasure.date)}` : 'まだ計測がありません。月に1回、サイズを測ってみましょう'}
        </p>
      </button>
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

const TREND_VIEW: Record<Trend, { arrow: string; word: string }> = {
  down: { arrow: '↘', word: '減少傾向' },
  up: { arrow: '↗', word: '増加傾向' },
  flat: { arrow: '→', word: '横ばい' },
  insufficient: { arrow: '…', word: '判定中' },
};

function TrendCard(props: { records: DailyRecord[]; metric: NumKey; title: string; unit: string; today: string }) {
  const { records, metric, title, unit, today: t } = props;
  const cmp = compareWindows(records, metric, t);
  const trend = judgeTrend(cmp, TREND_FLAT[metric]);
  const view = TREND_VIEW[trend];
  const avgUnit = metric === 'weight' ? 'kg' : '%';
  return (
    <div className={`trend-card ${trend}`}>
      <p className="label">{title}</p>
      <p className="trend-main">
        <span className="trend-arrow">{view.arrow}</span>
        {view.word}
      </p>
      {trend === 'insufficient' ? (
        <p className="muted small">
          記録 {cmp.current.count}日・前 {cmp.previous.count}日
          <br />
          各{MIN_DAYS_FOR_TREND}日以上で判定します
        </p>
      ) : (
        <>
          <p className="trend-diff">
            {signed(cmp.diff!)}
            <span className="unit">{unit}</span>
          </p>
          <p className="muted small">
            {round1(cmp.current.avg!).toFixed(1)}{avgUnit}（前 {round1(cmp.previous.avg!).toFixed(1)}{avgUnit}）
          </p>
        </>
      )}
    </div>
  );
}

function SummaryRow({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="summary-row">
      <div>
        <p className="small">{label}</p>
        {note && <p className="muted small">{note}</p>}
      </div>
      <p className="summary-value">{value}</p>
    </div>
  );
}

function remaining(d: number | null) {
  if (d == null) return '—';
  return d > 0 ? `あと ${round1(d).toFixed(1)}kg` : '達成 ✓';
}

function signed(n: number) {
  const r = round1(n);
  return (r > 0 ? '+' : r < 0 ? '−' : '±') + Math.abs(r).toFixed(1);
}
