import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import type { Go } from '../App';
import { dailyToCsv, download, exercisesToCsv, measurementsToCsv } from '../csv';
import { IMPORT_TAG } from '../importDiet';
import { today } from '../date';
import { db, getSettings, IS_DEMO, saveSettings } from '../db';
import type { DailyRecord, ExerciseEntry, Measurement, Settings } from '../types';

export default function SettingsScreen({ go, notify }: { go: Go; notify: (m: string) => void }) {
  const loaded = useLiveQuery(getSettings, []);
  const [s, setS] = useState<Settings | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const imported = useLiveQuery(async () => {
    const d = await db.daily.filter((r) => r.importedFrom === IMPORT_TAG).count();
    const m = await db.measurements.filter((r) => r.importedFrom === IMPORT_TAG).count();
    return d + m;
  }, []);

  useEffect(() => {
    if (loaded && !s) setS(loaded);
  }, [loaded, s]);
  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted);
  }, []);

  if (!s) return null;
  const set = (patch: Partial<Settings>) => setS({ ...s, ...patch });
  const numOr = (v: string) => (v.trim() === '' ? undefined : Number(v));

  const save = async () => {
    if (!(s.goalWeight > 25 && s.goalWeight < 200)) return notify('目標体重を確認してください');
    if (!(s.cardioLightMin > 0 && s.cardioGoodMin > s.cardioLightMin)) return notify('有酸素の分数を確認してください');
    await saveSettings(s);
    notify('設定を保存しました');
  };

  const exportCsv = async () => {
    const all = await db.daily.toArray();
    download(`からだログ_日次_${today()}.csv`, dailyToCsv(all), 'text/csv;charset=utf-8');
  };

  const exportExercises = async () => {
    download(`からだログ_運動_${today()}.csv`, exercisesToCsv(await db.exercises.toArray()), 'text/csv;charset=utf-8');
  };
  const exportMeasurements = async () => {
    download(`からだログ_月次計測_${today()}.csv`, measurementsToCsv(await db.measurements.toArray()), 'text/csv;charset=utf-8');
  };

  const undoImport = async () => {
    if (!confirm('Excelから取り込んだ記録を削除します（取り込み後にアプリで入れた記録はそのまま）。よろしいですか？')) return;
    await db.daily.filter((r) => r.importedFrom === IMPORT_TAG).delete();
    await db.measurements.filter((r) => r.importedFrom === IMPORT_TAG).delete();
    notify('取り込みを取り消しました');
  };

  const exportBackup = async () => {
    const data = {
      app: 'health-log', version: 2, exportedAt: new Date().toISOString(), settings: await getSettings(),
      daily: await db.daily.toArray(), exercises: await db.exercises.toArray(), measurements: await db.measurements.toArray(),
    };
    download(`からだログ_バックアップ_${today()}.json`, JSON.stringify(data, null, 2), 'application/json');
  };

  const restore = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      if (data.app !== 'health-log' || !Array.isArray(data.daily)) throw new Error();
      const incoming = data.daily as DailyRecord[];
      const existing = new Set(await db.daily.toCollection().primaryKeys());
      const fresh = incoming.filter((r) => typeof r.date === 'string' && !existing.has(r.date));
      const skipped = incoming.length - fresh.length;
      if (!confirm(`${fresh.length}日分を追加します。${skipped ? `すでに記録がある${skipped}日分は上書きせずスキップします。` : ''}よろしいですか？`)) return;
      await db.daily.bulkAdd(fresh);
      // 運動・計測（version 2 以降のバックアップ）も、記録のない日だけ追加
      const exIn = (Array.isArray(data.exercises) ? data.exercises : []) as ExerciseEntry[];
      const exDates = new Set((await db.exercises.toArray()).map((e) => e.date));
      await db.exercises.bulkAdd(exIn.filter((e) => !exDates.has(e.date)).map(({ id: _id, ...e }) => e));
      const mIn = (Array.isArray(data.measurements) ? data.measurements : []) as Measurement[];
      const mDates = new Set(await db.measurements.toCollection().primaryKeys());
      await db.measurements.bulkAdd(mIn.filter((m) => !mDates.has(m.date)));
      notify(`${fresh.length}日分を復元しました`);
    } catch {
      notify('バックアップファイルを読み込めませんでした');
    }
  };

  return (
    <div className="stack">
      <header className="page-head">
        <h1>設定・データ</h1>
      </header>

      <section className="card form">
        <h2>目標</h2>
        <div className="grid2">
          <label className="field">
            <span>最終目標体重</span>
            <div className="with-unit">
              <input inputMode="decimal" value={s.goalWeight} onChange={(e) => set({ goalWeight: Number(e.target.value) || 0 })} />
              <em>kg</em>
            </div>
          </label>
          <label className="field">
            <span>途中の目安</span>
            <input
              defaultValue={s.milestones.join(', ')}
              onBlur={(e) => set({ milestones: e.target.value.split(/[,、\s]+/).map(Number).filter((n) => n > 0) })}
            />
          </label>
          <label className="field">
            <span>開始日</span>
            <input type="date" value={s.startDate ?? ''} onChange={(e) => set({ startDate: e.target.value || undefined })} />
          </label>
          <label className="field">
            <span>開始時の体重</span>
            <div className="with-unit">
              <input inputMode="decimal" placeholder="空欄＝開始日以降の最初の記録" value={s.startWeight ?? ''} onChange={(e) => set({ startWeight: numOr(e.target.value) })} />
              <em>kg</em>
            </div>
          </label>
        </div>

        <h2>記録の基準</h2>
        <div className="grid2">
          <label className="field">
            <span>有酸素 ○ の下限</span>
            <div className="with-unit">
              <input inputMode="numeric" value={s.cardioLightMin} onChange={(e) => set({ cardioLightMin: Number(e.target.value) || 0 })} />
              <em>分</em>
            </div>
          </label>
          <label className="field">
            <span>有酸素 ◎ の下限</span>
            <div className="with-unit">
              <input inputMode="numeric" value={s.cardioGoodMin} onChange={(e) => set({ cardioGoodMin: Number(e.target.value) || 0 })} />
              <em>分</em>
            </div>
          </label>
          <label className="field">
            <span>睡眠のお知らせ表示</span>
            <select value={s.sleepHighlightMinutes} onChange={(e) => set({ sleepHighlightMinutes: Number(e.target.value) })}>
              <option value={0}>表示しない</option>
              <option value={300}>5時間未満</option>
              <option value={360}>6時間未満</option>
              <option value={420}>7時間未満</option>
            </select>
          </label>
        </div>
        <button className="primary" onClick={save}>設定を保存</button>
      </section>

      <section className="card form">
        <h2>データ</h2>
        <p className="muted small">
          記録はこの端末のブラウザ内だけに保存され、外部には送信されません。
          iPhoneとMacのデータは別々です（同期は後の段階で検討）。
          {persisted === false && ' ※ 長期保存の許可が得られていません。iPhoneでは「ホーム画面に追加」して使うと消えにくくなります。'}
        </p>
        <button className="secondary" onClick={() => go('import')}>過去データ（Excel）を取り込む</button>
        {imported ? (
          <button className="secondary" onClick={undoImport}>Excelの取り込みを取り消す（{imported}件）</button>
        ) : null}
        <button className="secondary" onClick={exportCsv}>日次データをCSVで書き出す</button>
        <button className="secondary" onClick={exportExercises}>運動データをCSVで書き出す</button>
        <button className="secondary" onClick={exportMeasurements}>月次計測をCSVで書き出す</button>
        <button className="secondary" onClick={exportBackup}>バックアップを保存（JSON）</button>
        <label className="secondary file-btn">
          バックアップから復元
          <input type="file" accept="application/json,.json" onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} hidden />
        </label>
        <p className="muted small">復元は既存の記録を上書きせず、記録のない日だけ追加します。</p>
        {IS_DEMO && <p className="muted small">いまはデモ用データを表示しています。</p>}
      </section>
    </div>
  );
}
