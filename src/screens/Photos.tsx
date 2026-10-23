import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DateField } from '../components/DateField';
import { Segmented } from '../components/Segmented';
import { download } from '../csv';
import { formatJa, today } from '../date';
import { db, newId } from '../db';
import { buildArchive, needsArchivePassphrase, parseArchive, restoreArchive, type PhotoArchive } from '../photoArchive';
import { lockPhotos, setPhotoKey, usePhotoKey } from '../photoSession';
import type { Angle, PhotoRecord } from '../types';
import {
  createVault, decryptBytes, encryptBytes, passkeyMaybeAvailable, registerPasskey, unlockWithPasskey,
  unlockWithPassphrase, WrongSecretError, type VaultMeta,
} from '../vault';

const ANGLES: Angle[] = ['front', 'side', 'back'];
const ANGLE_LABEL: Record<Angle, string> = { front: '正面', side: '横', back: '後ろ' };
const MIN_PASS = 8;

export default function Photos({ initialDate, notify }: { initialDate?: string; notify: (m: string) => void }) {
  const vault = useLiveQuery(async () => ({ meta: (await db.vault.get('main')) ?? null }), []);
  const key = usePhotoKey();
  if (!vault) return null;

  return (
    <div className="stack">
      <header className="page-head">
        <h1>比較写真</h1>
        <p className="muted small">写真はこの端末の中に暗号化して保存し、外部には送信しません。画像は加工せず、そのまま比べます。</p>
      </header>
      {!vault.meta ? (
        <Setup notify={notify} />
      ) : !key ? (
        <Unlock meta={vault.meta} notify={notify} />
      ) : (
        <Unlocked meta={vault.meta} cryptoKey={key} initialDate={initialDate} notify={notify} />
      )}
    </div>
  );
}

function Setup({ notify }: { notify: (m: string) => void }) {
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const valid = pass.length >= MIN_PASS && pass === pass2 && ok;

  const create = async () => {
    setBusy(true);
    try {
      const { meta, key } = await createVault(pass);
      await db.vault.put(meta);
      setPhotoKey(key);
      notify('写真の鍵を作成しました');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card form">
      <h2>はじめに：写真の合言葉を決める</h2>
      <p className="small">
        写真を開くための合言葉です。この合言葉から作った鍵で写真を暗号化します。
        Face ID に対応した端末では、このあと Face ID でも開けるようにできます。
      </p>
      <label className="field">
        <span>合言葉（{MIN_PASS}文字以上）</span>
        <input type="password" autoComplete="new-password" value={pass} onChange={(e) => setPass(e.target.value)} />
      </label>
      <label className="field">
        <span>もう一度</span>
        <input type="password" autoComplete="new-password" value={pass2} onChange={(e) => setPass2(e.target.value)} />
      </label>
      {pass2 && pass !== pass2 && <p className="error">合言葉が一致しません</p>}
      <label className="check">
        <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />
        <span className="small">合言葉を忘れて Face ID も使えなくなると、写真は誰にも（開発者にも）戻せないことを理解しました</span>
      </label>
      <button className="primary" disabled={!valid || busy} onClick={create}>{busy ? '作成中…' : '合言葉を設定する'}</button>
    </section>
  );
}

function Unlock({ meta, notify }: { meta: VaultMeta; notify: (m: string) => void }) {
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const withPass = async () => {
    setBusy(true);
    setError(null);
    try {
      setPhotoKey(await unlockWithPassphrase(meta, pass));
      setPass('');
    } catch (e) {
      setError(e instanceof WrongSecretError ? '合言葉が違います' : '開けませんでした');
    } finally {
      setBusy(false);
    }
  };
  const withFace = async () => {
    setError(null);
    try {
      setPhotoKey(await unlockWithPasskey(meta));
    } catch {
      setError('Face IDで開けませんでした。合言葉で開いてください');
    }
  };

  return (
    <>
      <section className="card form">
        <h2>🔒 ロック中</h2>
        {meta.passkey && <button className="primary" onClick={withFace}>Face ID で開く</button>}
        <label className="field">
          <span>合言葉で開く</span>
          <input type="password" autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && withPass()} />
        </label>
        {error && <p className="error">{error}</p>}
        <button className={meta.passkey ? 'secondary' : 'primary'} disabled={!pass || busy} onClick={withPass}>{busy ? '確認中…' : '開く'}</button>
        <p className="muted small">5分操作がないときや、アプリを1分以上離れたときは自動でロックされます。</p>
      </section>
      <ForgotReset notify={notify} />
    </>
  );
}

function Unlocked({ meta, cryptoKey, initialDate, notify }: { meta: VaultMeta; cryptoKey: CryptoKey; initialDate?: string; notify: (m: string) => void }) {
  const [date, setDate] = useState(initialDate ?? today());
  const all = useLiveQuery(() => db.photos.toArray(), []) ?? [];
  const forDate = all.filter((p) => p.date === date);

  return (
    <>
      {!meta.verifiedAt && <VerifyBanner meta={meta} />}
      <section className="card form">
        <div className="row-between">
          <h2>写真を登録</h2>
          <button className="chip-btn plain" onClick={lockPhotos}>🔒 ロックする</button>
        </div>
        <DateField value={date} onChange={setDate} />
        <div className="photo-slots">
          {ANGLES.map((a) => (
            <Slot key={a} angle={a} date={date} photo={forDate.find((p) => p.angle === a)} cryptoKey={cryptoKey} notify={notify} />
          ))}
        </div>
      </section>
      <Compare photos={all} cryptoKey={cryptoKey} />
      <Manage meta={meta} cryptoKey={cryptoKey} notify={notify} />
    </>
  );
}

function VerifyBanner({ meta }: { meta: VaultMeta }) {
  return (
    <section className="card notice">
      <p className="notice-title">確認前（テスト中）</p>
      <p className="small">体の写真を入れる前に、体の写っていないテスト用の写真（コップなど）で次を確認してください。</p>
      <ol className="small">
        <li>写真を登録し、「ロックする」を押すと写真が見えなくなる</li>
        <li>合言葉{meta.passkey ? '・Face ID' : ''}で開くと、また見える</li>
        <li>下の「写真のバックアップを保存」でファイルを保存できる</li>
        <li>テスト写真を削除できる</li>
      </ol>
      <button
        className="secondary"
        onClick={async () => {
          if (confirm('上の4つを確認できましたか？')) await db.vault.update('main', { verifiedAt: new Date().toISOString() });
        }}
      >
        確認できました
      </button>
    </section>
  );
}

function useDecrypted(photo: PhotoRecord | undefined, cryptoKey: CryptoKey) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!photo) return setUrl(null);
    let u: string | null = null;
    let alive = true;
    decryptBytes(cryptoKey, photo.iv, photo.data)
      .then((plain) => {
        if (!alive) return;
        u = URL.createObjectURL(new Blob([plain], { type: photo.mime }));
        setUrl(u);
      })
      .catch(() => alive && setUrl(null));
    return () => {
      alive = false;
      if (u) URL.revokeObjectURL(u);
    };
  }, [photo?.uid, cryptoKey]);
  return url;
}

function Slot({ angle, date, photo, cryptoKey, notify }: { angle: Angle; date: string; photo?: PhotoRecord; cryptoKey: CryptoKey; notify: (m: string) => void }) {
  const url = useDecrypted(photo, cryptoKey);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const save = async (file: File) => {
    if (!file.type.startsWith('image/')) return notify('画像ファイルを選んでください');
    setBusy(true);
    try {
      const { iv, data } = await encryptBytes(cryptoKey, await file.arrayBuffer());
      await db.transaction('rw', db.photos, async () => {
        await db.photos.where('[date+angle]').equals([date, angle]).delete();
        await db.photos.add({ uid: newId(), date, angle, mime: file.type, size: file.size, iv, data, createdAt: new Date().toISOString() });
      });
      notify(`${ANGLE_LABEL[angle]}の写真を保存しました`);
    } catch {
      notify('保存できませんでした。ロックされた場合は開き直してください');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };
  const remove = async () => {
    if (photo && confirm(`${formatJa(date)}の${ANGLE_LABEL[angle]}の写真を削除しますか？（元に戻せません）`)) {
      await db.photos.delete(photo.uid);
      notify('削除しました');
    }
  };

  return (
    <div className="slot">
      <p className="label">{ANGLE_LABEL[angle]}</p>
      {photo ? (
        <div className="slot-img">{url ? <img src={url} alt={`${ANGLE_LABEL[angle]}の写真`} /> : <span className="muted small">表示中…</span>}</div>
      ) : (
        <button className="slot-img empty" onClick={() => input.current?.click()} disabled={busy}>{busy ? '保存中…' : '＋ 追加'}</button>
      )}
      {photo && (
        <div className="slot-actions">
          <button className="link small" onClick={() => input.current?.click()}>差し替え</button>
          <button className="link small" onClick={remove}>削除</button>
        </div>
      )}
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && save(e.target.files[0])} />
    </div>
  );
}

function Compare({ photos, cryptoKey }: { photos: PhotoRecord[]; cryptoKey: CryptoKey }) {
  const dates = useMemo(() => [...new Set(photos.map((p) => p.date))].sort().reverse(), [photos]);
  const [angle, setAngle] = useState<Angle>('front');
  const [picked, setPicked] = useState<string[] | null>(null);
  const chosen = (picked ?? dates.slice(0, 2)).filter((d) => dates.includes(d)).sort();
  if (dates.length < 2) {
    return (
      <section className="card">
        <h2>並べて比べる</h2>
        <p className="muted small">2日分以上の写真がそろうと、並べて比べられます。</p>
      </section>
    );
  }
  const toggle = (d: string) => {
    const cur = picked ?? dates.slice(0, 2);
    setPicked(cur.includes(d) ? cur.filter((x) => x !== d) : cur.length >= 3 ? cur : [...cur, d]);
  };

  return (
    <section className="card form">
      <h2>並べて比べる（2〜3日）</h2>
      <div className="date-chips">
        {dates.map((d) => (
          <button key={d} className={chosen.includes(d) ? 'on' : ''} onClick={() => toggle(d)}>
            {d.slice(2).replace(/-/g, '/')}
          </button>
        ))}
      </div>
      <Segmented value={angle} onChange={(v) => v && setAngle(v)} options={ANGLES.map((a) => ({ value: a, label: ANGLE_LABEL[a] }))} />
      <div className="compare" style={{ gridTemplateColumns: `repeat(${Math.max(chosen.length, 1)}, 1fr)` }}>
        {chosen.map((d) => (
          <CompareCell key={d} date={d} photo={photos.find((p) => p.date === d && p.angle === angle)} cryptoKey={cryptoKey} />
        ))}
      </div>
    </section>
  );
}

function CompareCell({ date, photo, cryptoKey }: { date: string; photo?: PhotoRecord; cryptoKey: CryptoKey }) {
  const url = useDecrypted(photo, cryptoKey);
  return (
    <figure className="compare-cell">
      <div className="slot-img">{photo ? url && <img src={url} alt={`${date}の写真`} /> : <span className="muted small">写真なし</span>}</div>
      <figcaption className="small">{formatJa(date)}</figcaption>
    </figure>
  );
}

function Manage({ meta, cryptoKey, notify }: { meta: VaultMeta; cryptoKey: CryptoKey; notify: (m: string) => void }) {
  const [canPasskey, setCanPasskey] = useState(false);
  const [pass, setPass] = useState('');
  const [archive, setArchive] = useState<PhotoArchive | null>(null);
  const [archivePass, setArchivePass] = useState('');
  const [needPass, setNeedPass] = useState(false);
  const count = useLiveQuery(() => db.photos.count(), []) ?? 0;

  useEffect(() => {
    passkeyMaybeAvailable().then(setCanPasskey);
  }, []);

  const enableFace = async () => {
    try {
      await db.vault.put(await registerPasskey(meta, pass));
      setPass('');
      notify('Face ID で開けるようにしました');
    } catch (e) {
      notify(e instanceof WrongSecretError ? '合言葉が違います' : e instanceof Error ? e.message : 'Face IDを設定できませんでした');
    }
  };
  const disableFace = async () => {
    if (!confirm('Face ID での解錠をやめますか？（合言葉では引き続き開けます）')) return;
    const { passkey: _p, ...rest } = meta;
    await db.vault.put(rest);
  };

  const exportArchive = async () => {
    const a = await buildArchive();
    if (!a) return;
    download(`からだログ_写真_暗号化_${today()}.json`, JSON.stringify(a), 'application/json');
  };
  const pickArchive = async (file: File) => {
    try {
      const a = parseArchive(await file.text());
      setArchive(a);
      setNeedPass(await needsArchivePassphrase(a));
    } catch (e) {
      notify(e instanceof Error ? e.message : '読み込めませんでした');
    }
  };
  const doRestore = async () => {
    if (!archive) return;
    try {
      const r = await restoreArchive(archive, { archivePassphrase: archivePass, currentKey: cryptoKey });
      notify(`${r.added}枚を戻しました${r.skipped ? `（${r.skipped}枚は同じ日・向きがあるためスキップ）` : ''}`);
      setArchive(null);
      setArchivePass('');
    } catch (e) {
      notify(e instanceof WrongSecretError ? 'バックアップの合言葉が違います' : '戻せませんでした');
    }
  };

  return (
    <section className="card form">
      <h2>写真の保護と管理</h2>
      <dl className="day-detail">
        <dt>保存場所</dt><dd>この端末の中だけ（暗号化済み）</dd>
        <dt>開き方</dt><dd>合言葉{meta.passkey ? '・Face ID' : ''}</dd>
        <dt>写真の数</dt><dd>{count}枚</dd>
        <dt>確認</dt><dd>{meta.verifiedAt ? `テスト済み（${formatJa(meta.verifiedAt.slice(0, 10))}）` : 'まだ（テスト中）'}</dd>
      </dl>

      {meta.passkey ? (
        <button className="chip-btn plain" onClick={disableFace}>Face ID での解錠をやめる</button>
      ) : canPasskey ? (
        <div className="more">
          <p className="small">Face ID でも開けるようにする（端末が対応している場合）</p>
          <input type="password" placeholder="確認のため合言葉" value={pass} onChange={(e) => setPass(e.target.value)} className="plain-input" />
          <button className="secondary" disabled={!pass} onClick={enableFace}>Face ID を設定</button>
        </div>
      ) : (
        <p className="muted small">この端末・ブラウザでは Face ID での解錠を使えないため、合言葉で開きます。</p>
      )}

      <button className="secondary" onClick={exportArchive} disabled={!count}>写真のバックアップを保存（暗号化のまま）</button>
      <label className="secondary file-btn">
        写真のバックアップから戻す
        <input type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && pickArchive(e.target.files[0])} />
      </label>
      {archive && (
        <div className="more">
          <p className="small">{archive.photos.length}枚の写真が入っています。同じ日付・向きの写真がある場合は上書きしません。</p>
          {needPass && (
            <input type="password" placeholder="バックアップを作ったときの合言葉" value={archivePass} onChange={(e) => setArchivePass(e.target.value)} className="plain-input" />
          )}
          <button className="secondary" disabled={needPass && !archivePass} onClick={doRestore}>戻す</button>
        </div>
      )}
      <p className="muted small">
        バックアップは暗号化されたままのファイルです。開くには合言葉が必要です。
        写真はCSVや通常のバックアップには含まれません。
      </p>
      <ForgotReset notify={notify} label="写真をすべて削除する" />
    </section>
  );
}

function ForgotReset({ notify, label = '合言葉を忘れた（写真をすべて削除してやり直す）' }: { notify: (m: string) => void; label?: string }) {
  const reset = async () => {
    if (!confirm('この端末の比較写真と合言葉をすべて削除します。元に戻せません。よろしいですか？')) return;
    if (!confirm('本当に削除しますか？')) return;
    await db.transaction('rw', db.photos, db.vault, async () => {
      await db.photos.clear();
      await db.vault.clear();
    });
    lockPhotos();
    notify('比較写真を削除しました');
  };
  return <button className="chip-btn plain" onClick={reset}>{label}</button>;
}
