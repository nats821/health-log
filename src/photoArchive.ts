import { db } from './db';
import type { PhotoRecord } from './types';
import { decryptBytes, encryptBytes, fromB64, toB64, unlockWithPassphrase, type VaultMeta } from './vault';

/** 写真の暗号化バックアップ。写真は暗号化されたまま書き出す（CSVには入れない） */
export interface PhotoArchive {
  app: 'health-log-photos';
  version: 1;
  exportedAt: string;
  vault: VaultMeta;
  photos: (Omit<PhotoRecord, 'iv' | 'data'> & { iv: string; data: string })[];
}

export async function buildArchive(): Promise<PhotoArchive | null> {
  const vault = await db.vault.get('main');
  if (!vault) return null;
  const photos = await db.photos.toArray();
  const { passkey: _pk, ...meta } = vault; // パスキーは端末ごとのものなので含めない
  return {
    app: 'health-log-photos',
    version: 1,
    exportedAt: new Date().toISOString(),
    vault: meta,
    photos: photos.map((p) => ({ ...p, iv: toB64(p.iv), data: toB64(p.data) })),
  };
}

export function parseArchive(text: string): PhotoArchive {
  const a = JSON.parse(text);
  if (a?.app !== 'health-log-photos' || !a.vault || !Array.isArray(a.photos)) throw new Error('写真のバックアップファイルではありません');
  return a as PhotoArchive;
}

const sameVault = (a: VaultMeta, b: VaultMeta) => a.salt === b.salt && a.pass.ct === b.pass.ct;

/** 端末に写真の鍵がない、または同じ鍵なら合言葉なしで戻せる */
export async function needsArchivePassphrase(a: PhotoArchive) {
  const current = await db.vault.get('main');
  return !!current && !sameVault(current, a.vault);
}

/**
 * 写真を戻す。同じ日付・向きの写真がすでにある場合はスキップ（上書きしない）。
 * 別の鍵で作られたバックアップは、その合言葉で開いて今の鍵で暗号化し直す。
 */
export async function restoreArchive(a: PhotoArchive, opts: { archivePassphrase?: string; currentKey?: CryptoKey | null }) {
  const current = await db.vault.get('main');
  let reencrypt: { from: CryptoKey; to: CryptoKey } | null = null;
  if (!current) await db.vault.put(a.vault);
  else if (!sameVault(current, a.vault)) {
    if (!opts.archivePassphrase || !opts.currentKey) throw new Error('バックアップの合言葉と、写真の解錠が必要です');
    reencrypt = { from: await unlockWithPassphrase(a.vault, opts.archivePassphrase), to: opts.currentKey };
  }
  let added = 0;
  let skipped = 0;
  for (const p of a.photos) {
    if (await db.photos.where('[date+angle]').equals([p.date, p.angle]).first()) {
      skipped++;
      continue;
    }
    let iv = fromB64(p.iv);
    let data = fromB64(p.data).buffer;
    if (reencrypt) {
      const plain = await decryptBytes(reencrypt.from, iv, data);
      ({ iv, data } = await encryptBytes(reencrypt.to, plain));
    }
    await db.photos.put({ ...p, iv, data });
    added++;
  }
  return { added, skipped };
}
