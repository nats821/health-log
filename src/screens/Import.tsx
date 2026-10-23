import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import type { Go } from '../App';
import { formatJa } from '../date';
import { db, getSettings } from '../db';
import { fillEmpty, IMPORT_TAG, parseDietRows } from '../importDiet';
import { LEVEL_LABEL, MEAL_LABEL, PERIOD_LABEL } from '../labels';

type Choice = 'keep' | 'fill';

export default function Import({ go, notify }: { go: Go; notify: (m: string) => void }) {
  const [rows, setRows] = useState<unknown[][] | null>(null);
  const [fileName, setFileName] = useState('');
  const [sheets, setSheets] = useState<{ names: string[]; current: string; wb: unknown } | null>(null);
  const [junkWhenCross, setJunk] = useState(true);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const result = useMemo(() => (rows ? parseDietRows(rows, { junkWhenCross }) : null), [rows, junkWhenCross]);
  const existing = useLiveQuery(async () => {
    if (!result) return null;
    const d = await db.daily.bulkGet(result.daily.map((r) => r.date));
    const m = await db.measurements.bulkGet(result.measurements.map((r) => r.date));
    return { daily: new Set(d.filter(Boolean).map((r) => r!.date)), meas: new Set(m.filter(Boolean).map((r) => r!.date)) };
  }, [result]);
  const settings = useLiveQuery(getSettings, []);

  const loadSheet = async (wb: unknown, name: string) => {
    const XLSX = await import('xlsx');
    const ws = (wb as { Sheets: Record<string, import('xlsx').WorkSheet> }).Sheets[name];
    setRows(XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null }) as unknown[][]);
  };

  const onFile = async (file: File) => {
    setBusy(true);
    setDone(null);
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await file.arrayBuffer());
      const name = wb.SheetNames.includes('diet') ? 'diet' : wb.SheetNames[0];
      setFileName(file.name);
      setSheets({ names: wb.SheetNames, current: name, wb });
      setChoices({});
      await loadSheet(wb, name);
    } catch {
      notify('Excelファイルを読み込めませんでした');
    } finally {
      setBusy(false);
    }
  };

  const conflicts = existing ? [...existing.daily] : [];

  const run = async () => {
    if (!result || !existing) return;
    setBusy(true);
    let added = 0, filled = 0, kept = 0, mAdded = 0;
    await db.transaction('rw', db.daily, db.measurements, async () => {
      for (const r of result.daily) {
        if (!existing.daily.has(r.date)) {
          await db.daily.add(r);
          added++;
        } else if ((choices[r.date] ?? 'keep') === 'fill') {
          const cur = await db.daily.get(r.date);
          await db.daily.put(fillEmpty(cur!, r));
          filled++;
        } else kept++;
      }
      for (const m of result.measurements) {
        if (!existing.meas.has(m.date)) {
          await db.measurements.add(m);
          mAdded++;
        }
      }
    });
    setBusy(false);
    setDone(`${added}日分を追加${filled ? `・${filled}日分の空欄を補完` : ''}${kept ? `・${kept}日分は既存のまま` : ''}・計測${mAdded}件`);
    setRows(null);
  };

  return (
    <div className="stack">
      <header className="page-head">
        <h1>過去データの取り込み</h1>
        <p className="muted small">Excel（.xlsx）を読み込み、内容を確認してから取り込みます。ファイルは端末の中だけで処理され、外部には送信しません。</p>
      </header>

      {done && (
        <section className="card form">
          <h2>取り込みました</h2>
          <p className="small">{done}</p>
          <div className="grid2">
            <button className="secondary" onClick={() => go('graph')}>グラフを見る</button>
            <button className="secondary" onClick={() => go('calendar')}>カレンダーを見る</button>
          </div>
        </section>
      )}

      <section className="card form">
        <label className="secondary file-btn">
          {busy ? '読み込み中…' : fileName ? '別のファイルを選ぶ' : 'Excelファイルを選ぶ'}
          <input type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </label>
        {sheets && sheets.names.length > 1 && (
          <label className="field">
            <span>シート</span>
            <select value={sheets.current} onChange={(e) => { setSheets({ ...sheets, current: e.target.value }); loadSheet(sheets.wb, e.target.value); }}>
              {sheets.names.map((n) => <option key={n}>{n}</option>)}
            </select>
          </label>
        )}
      </section>

      {result && (
        <>
          <section className="card form">
            <h2>読み取り結果</h2>
            <p className="small">
              {fileName}：{result.firstDate ? `${result.firstDate} 〜 ${result.lastDate}` : '記録なし'}
            </p>
            <dl className="day-detail">
              <dt>記録のある日</dt><dd>{result.daily.length}日</dd>
              <dt>体重</dt><dd>{count(result.daily, 'weight')}日</dd>
              <dt>体脂肪率</dt><dd>{count(result.daily, 'bodyFat')}日</dd>
              <dt>睡眠</dt><dd>{count(result.daily, 'sleepMinutes')}日</dd>
              <dt>歩数</dt><dd>{count(result.daily, 'steps')}日</dd>
              <dt>筋トレ</dt><dd>{count(result.daily, 'strength')}日</dd>
              <dt>食事</dt><dd>{count(result.daily, 'meal')}日（うちジャンク {result.daily.filter((d) => d.meal === 'junk').length}日）</dd>
              <dt>生理</dt><dd>{count(result.daily, 'period')}日</dd>
              <dt>月次計測</dt><dd>{result.measurements.length}件</dd>
            </dl>
            <label className="check">
              <input type="checkbox" checked={junkWhenCross} onChange={(e) => setJunk(e.target.checked)} />
              <span className="small">ヘルシープレート（朝・昼・夜）に✕がある日を「ジャンク」にする</span>
            </label>
            <p className="muted small">
              元の表の◯△✕、筋トレの内容、「キラキラ」などの周期メモ、コメントは、各日のメモにそのまま残します。
              数式で計算された列（どれだけ痩せた？・2週間平均）は取り込まず、アプリで計算し直します。
            </p>
          </section>

          {result.notes.length > 0 && (
            <section className="card">
              <h2>表の上のメモ・目標</h2>
              <ul className="notes small">{result.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
              <p className="muted small">これらは参考表示のみで、取り込みはしません。</p>
            </section>
          )}

          <section className="card">
            <h2>プレビュー（最初の8日）</h2>
            <div className="table-scroll">
              <table className="preview">
                <thead>
                  <tr><th>日付</th><th>体重</th><th>体脂肪</th><th>睡眠</th><th>筋トレ</th><th>食事</th><th>生理</th><th>メモ</th></tr>
                </thead>
                <tbody>
                  {result.daily.slice(0, 8).map((d) => (
                    <tr key={d.date}>
                      <td>{d.date.slice(2).replace(/-/g, '/')}</td>
                      <td>{d.weight ?? ''}</td>
                      <td>{d.bodyFat ?? ''}</td>
                      <td>{d.sleepMinutes != null ? `${Math.floor(d.sleepMinutes / 60)}:${String(d.sleepMinutes % 60).padStart(2, '0')}` : ''}</td>
                      <td>{d.strength ? LEVEL_LABEL[d.strength] : ''}</td>
                      <td>{d.meal ? MEAL_LABEL[d.meal] : ''}</td>
                      <td>{d.period ? PERIOD_LABEL[d.period] : ''}</td>
                      <td className="memo-cell">{d.memo ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {(result.skipped.length > 0 || result.warnings.length > 0) && (
            <section className="card">
              <h2>確認が必要な行</h2>
              <ul className="notes small">
                {result.skipped.map((s) => <li key={`s${s.row}`}>{s.row}行目：{s.reason}</li>)}
                {result.warnings.map((w, i) => <li key={`w${i}`}>{w}</li>)}
              </ul>
            </section>
          )}

          {conflicts.length > 0 && (
            <section className="card form">
              <h2>すでに記録がある日（{conflicts.length}日）</h2>
              <p className="muted small">既存の記録は上書きしません。空欄だけ補うか、そのままにするかを選べます。</p>
              <ul className="notes">
                {conflicts.sort().map((d) => (
                  <li key={d} className="row-between">
                    <span className="small">{formatJa(d)}・{d.slice(0, 4)}</span>
                    <select value={choices[d] ?? 'keep'} onChange={(e) => setChoices({ ...choices, [d]: e.target.value as Choice })}>
                      <option value="keep">既存のまま</option>
                      <option value="fill">空欄だけ補う</option>
                    </select>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="card form">
            {settings?.startDate && (
              <p className="muted small">
                取り込んだデータは「過去のダイエット記録」として保存されます。今回のダイエット（{settings.startDate.replace(/-/g, '/')}〜）の
                14日平均・達成率・開始時からの増減には使いません。グラフの「全期間」とカレンダーで見返せます。
              </p>
            )}
            <button className="primary" disabled={busy || !existing || result.daily.length === 0} onClick={run}>
              {result.daily.length - conflicts.length}日分を取り込む
            </button>
            <p className="muted small center">あとから設定画面で「取り込みを取り消す」こともできます</p>
          </section>
        </>
      )}
    </div>
  );
}

function count(list: object[], key: string) {
  return list.filter((d) => (d as Record<string, unknown>)[key] != null).length;
}

export { IMPORT_TAG };
