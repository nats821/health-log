import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, newId } from './db';
import { buildArchive, needsArchivePassphrase, parseArchive, restoreArchive } from './photoArchive';
import { createVault, decryptBytes, encryptBytes, unlockWithPassphrase } from './vault';

const ITER = 1000;
const bytes = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer;

async function addPhoto(key: CryptoKey, date: string, content: string) {
  const { iv, data } = await encryptBytes(key, bytes(content));
  await db.photos.add({ uid: newId(), date, angle: 'front', mime: 'image/jpeg', size: content.length, iv, data, createdAt: '' });
}

describe('写真の暗号化バックアップ', () => {
  beforeEach(async () => {
    await db.photos.clear();
    await db.vault.clear();
  });

  it('書き出したファイルに元の画像や合言葉は入らない', async () => {
    const { meta, key } = await createVault('test-passphrase', ITER);
    await db.vault.put(meta);
    await addPhoto(key, '2026-11-01', 'BODY-PHOTO-PIXELS');
    const json = JSON.stringify(await buildArchive());
    expect(json).not.toContain('BODY-PHOTO-PIXELS');
    expect(json).not.toContain(btoa('BODY-PHOTO-PIXELS'));
    expect(json).not.toContain('test-passphrase');
  });

  it('新しい端末に戻すと、同じ合言葉で開ける', async () => {
    const { meta, key } = await createVault('test-passphrase', ITER);
    await db.vault.put(meta);
    await addPhoto(key, '2026-11-01', 'A');
    const archive = parseArchive(JSON.stringify(await buildArchive()));
    await db.photos.clear();
    await db.vault.clear(); // 新しい端末のつもり
    expect(await needsArchivePassphrase(archive)).toBe(false);
    expect(await restoreArchive(archive, {})).toEqual({ added: 1, skipped: 0 });
    const k = await unlockWithPassphrase((await db.vault.get('main'))!, 'test-passphrase');
    const p = (await db.photos.toArray())[0];
    expect(new TextDecoder().decode(await decryptBytes(k, p.iv, p.data))).toBe('A');
  });

  it('別の合言葉の端末に戻すときは、今の鍵で暗号化し直し、同じ日・向きは上書きしない', async () => {
    const old = await createVault('old-device-pass', ITER);
    await db.vault.put(old.meta);
    await addPhoto(old.key, '2026-11-01', 'OLD-1');
    await addPhoto(old.key, '2026-12-01', 'OLD-2');
    const archive = parseArchive(JSON.stringify(await buildArchive()));

    await db.photos.clear();
    await db.vault.clear();
    const cur = await createVault('new-device-pass', ITER);
    await db.vault.put(cur.meta);
    await addPhoto(cur.key, '2026-11-01', 'NEW-1');

    expect(await needsArchivePassphrase(archive)).toBe(true);
    await expect(restoreArchive(archive, { archivePassphrase: 'wrong', currentKey: cur.key })).rejects.toThrow();
    expect(await restoreArchive(archive, { archivePassphrase: 'old-device-pass', currentKey: cur.key })).toEqual({ added: 1, skipped: 1 });
    const texts = await Promise.all((await db.photos.orderBy('date').toArray()).map(async (p) => new TextDecoder().decode(await decryptBytes(cur.key, p.iv, p.data))));
    expect(texts.sort()).toEqual(['NEW-1', 'OLD-2']);
  });
});
