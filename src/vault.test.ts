import { describe, expect, it } from 'vitest';
import { attachPrf, changePassphrase, createVault, decryptBytes, encryptBytes, fromB64, toB64, unlockWithPassphrase, unlockWithPrf, WrongSecretError } from './vault';

const ITER = 1000; // テストは速さのため回数を減らす（本番は60万回）
const bytes = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer;
const text = (b: ArrayBuffer) => new TextDecoder().decode(b);

describe('写真の暗号化', () => {
  it('暗号化したデータは元と違い、正しい鍵でだけ戻せる', async () => {
    const { meta, key } = await createVault('はるのそら 2026', ITER);
    const { iv, data } = await encryptBytes(key, bytes('photo-bytes'));
    expect(text(data)).not.toContain('photo-bytes');
    const again = await unlockWithPassphrase(meta, 'はるのそら 2026');
    expect(text(await decryptBytes(again, iv, data))).toBe('photo-bytes');
  });

  it('合言葉が違えば開けない', async () => {
    const { meta } = await createVault('correct horse', ITER);
    await expect(unlockWithPassphrase(meta, 'wrong horse')).rejects.toBeInstanceOf(WrongSecretError);
  });

  it('保存する情報に写真用の鍵や合言葉がそのまま入っていない', async () => {
    const { meta } = await createVault('my-secret-pass', ITER);
    const json = JSON.stringify(meta);
    expect(json).not.toContain('my-secret-pass');
    expect(Object.keys(meta).sort()).toEqual(['createdAt', 'id', 'iterations', 'pass', 'salt', 'version']);
  });

  it('解錠した鍵は取り出せない（non-extractable）', async () => {
    const { key } = await createVault('abcdefgh', ITER);
    expect(key.extractable).toBe(false);
  });

  it('合言葉を変えても、同じ写真をそのまま開ける', async () => {
    const { meta, key } = await createVault('old-passphrase', ITER);
    const { iv, data } = await encryptBytes(key, bytes('x'));
    const next = await changePassphrase(meta, 'old-passphrase', 'new-passphrase');
    await expect(unlockWithPassphrase(next, 'old-passphrase')).rejects.toBeInstanceOf(WrongSecretError);
    expect(text(await decryptBytes(await unlockWithPassphrase(next, 'new-passphrase'), iv, data))).toBe('x');
  });

  it('Face ID（PRF）の出力でも同じ写真を開け、違う出力では開けない', async () => {
    const { meta, key } = await createVault('passphrase!', ITER);
    const { iv, data } = await encryptBytes(key, bytes('face'));
    const prf = crypto.getRandomValues(new Uint8Array(32)).buffer as ArrayBuffer;
    const withPk = await attachPrf(meta, 'passphrase!', new Uint8Array([1, 2]) as Uint8Array<ArrayBuffer>, new Uint8Array(32) as Uint8Array<ArrayBuffer>, prf);
    expect(text(await decryptBytes(await unlockWithPrf(withPk, prf), iv, data))).toBe('face');
    const other = crypto.getRandomValues(new Uint8Array(32)).buffer as ArrayBuffer;
    await expect(unlockWithPrf(withPk, other)).rejects.toBeInstanceOf(WrongSecretError);
  });

  it('base64 の変換', () => {
    const u = new Uint8Array(100000).map((_, i) => (i * 7919) % 256);
    expect(fromB64(toB64(u))).toEqual(u);
  });
});
