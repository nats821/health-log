/**
 * 比較写真の暗号化（端末内のみ）。
 * - 写真は AES-GCM 256bit の「写真用の鍵」で暗号化して IndexedDB に保存する
 * - 写真用の鍵そのものは保存せず、「合言葉」から作った鍵（PBKDF2）で包んで保存する
 * - Face ID（パスキーの PRF 拡張）に対応した端末では、パスキーからも同じ鍵を取り出せるようにする
 * - 解錠した鍵はメモリ上にだけ置き、取り出し不可（non-extractable）にする
 */

const subtle = () => globalThis.crypto.subtle;
const enc = new TextEncoder();
type Bytes = Uint8Array<ArrayBuffer>;
const rand = (n: number): Bytes => globalThis.crypto.getRandomValues(new Uint8Array(new ArrayBuffer(n)));

export const DEFAULT_ITERATIONS = 600_000;

export interface Wrapped {
  iv: string; // base64
  ct: string; // base64
}

export interface VaultMeta {
  id: 'main';
  version: 1;
  salt: string;
  iterations: number;
  pass: Wrapped; // 合言葉で包んだ写真用の鍵
  passkey?: { credentialId: string; prfSalt: string; wrapped: Wrapped }; // Face ID（パスキー）で包んだ写真用の鍵
  createdAt: string;
  verifiedAt?: string; // テスト写真でロック・バックアップ・削除を確認した日時
}

export class WrongSecretError extends Error {
  constructor() {
    super('合言葉が違います');
  }
}

export function toB64(bytes: ArrayBuffer | Uint8Array): string {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromB64(b64: string): Bytes {
  const s = atob(b64);
  const u = new Uint8Array(new ArrayBuffer(s.length));
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}

async function passKek(passphrase: string, salt: Bytes, iterations: number) {
  const base = await subtle().importKey('raw', enc.encode(passphrase.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

async function prfKek(prfOutput: ArrayBuffer) {
  const base = await subtle().importKey('raw', prfOutput, 'HKDF', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: enc.encode('karada-log/photo-vault/v1'), info: enc.encode('kek') },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function wrap(kek: CryptoKey, raw: Bytes): Promise<Wrapped> {
  const iv = rand(12);
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv }, kek, raw);
  return { iv: toB64(iv), ct: toB64(ct) };
}

async function unwrap(kek: CryptoKey, w: Wrapped): Promise<Bytes> {
  try {
    return new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv: fromB64(w.iv) }, kek, fromB64(w.ct)));
  } catch {
    throw new WrongSecretError();
  }
}

const importDek = (raw: Bytes) => subtle().importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);

export async function createVault(passphrase: string, iterations = DEFAULT_ITERATIONS): Promise<{ meta: VaultMeta; key: CryptoKey }> {
  const dek = rand(32);
  const salt = rand(16);
  const meta: VaultMeta = {
    id: 'main',
    version: 1,
    salt: toB64(salt),
    iterations,
    pass: await wrap(await passKek(passphrase, salt, iterations), dek),
    createdAt: new Date().toISOString(),
  };
  const key = await importDek(dek);
  dek.fill(0);
  return { meta, key };
}

async function dekFromPassphrase(meta: VaultMeta, passphrase: string) {
  return unwrap(await passKek(passphrase, fromB64(meta.salt), meta.iterations), meta.pass);
}

export async function unlockWithPassphrase(meta: VaultMeta, passphrase: string): Promise<CryptoKey> {
  const dek = await dekFromPassphrase(meta, passphrase);
  const key = await importDek(dek);
  dek.fill(0);
  return key;
}

export async function changePassphrase(meta: VaultMeta, oldPass: string, newPass: string): Promise<VaultMeta> {
  const dek = await dekFromPassphrase(meta, oldPass);
  const salt = rand(16);
  const next = { ...meta, salt: toB64(salt), pass: await wrap(await passKek(newPass, salt, meta.iterations), dek) };
  dek.fill(0);
  return next;
}

/** パスキーの PRF 出力で写真用の鍵を包む（登録時） */
export async function attachPrf(meta: VaultMeta, passphrase: string, credentialId: Bytes, prfSalt: Bytes, prfOutput: ArrayBuffer): Promise<VaultMeta> {
  const dek = await dekFromPassphrase(meta, passphrase);
  const wrapped = await wrap(await prfKek(prfOutput), dek);
  dek.fill(0);
  return { ...meta, passkey: { credentialId: toB64(credentialId), prfSalt: toB64(prfSalt), wrapped } };
}

export async function unlockWithPrf(meta: VaultMeta, prfOutput: ArrayBuffer): Promise<CryptoKey> {
  if (!meta.passkey) throw new Error('Face IDは未設定です');
  const dek = await unwrap(await prfKek(prfOutput), meta.passkey.wrapped);
  const key = await importDek(dek);
  dek.fill(0);
  return key;
}

export async function encryptBytes(key: CryptoKey, data: ArrayBuffer): Promise<{ iv: Bytes; data: ArrayBuffer }> {
  const iv = rand(12);
  return { iv, data: await subtle().encrypt({ name: 'AES-GCM', iv }, key, data) };
}

export async function decryptBytes(key: CryptoKey, iv: Bytes, data: ArrayBuffer): Promise<ArrayBuffer> {
  return subtle().decrypt({ name: 'AES-GCM', iv }, key, data);
}

// ---- Face ID（WebAuthn パスキー + PRF 拡張）----

const rpId = () => location.hostname;

/** この端末でパスキー（Face ID 等）が使えそうか。PRF 対応は登録してみるまで確定しない */
export async function passkeyMaybeAvailable(): Promise<boolean> {
  const PKC = (globalThis as { PublicKeyCredential?: typeof PublicKeyCredential }).PublicKeyCredential;
  if (!PKC || !window.isSecureContext) return false;
  try {
    const caps = await (PKC as unknown as { getClientCapabilities?: () => Promise<Record<string, boolean>> }).getClientCapabilities?.();
    if (caps && caps['extension:prf'] === false) return false;
    return await PKC.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

type PrfResults = { prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } } };

async function prfGet(credentialId: Bytes, prfSalt: Bytes): Promise<ArrayBuffer> {
  const cred = (await navigator.credentials.get({
    publicKey: {
      challenge: rand(32),
      rpId: rpId(),
      allowCredentials: [{ type: 'public-key', id: credentialId }],
      userVerification: 'required',
      timeout: 60000,
      extensions: { prf: { eval: { first: prfSalt } } } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;
  const out = (cred?.getClientExtensionResults() as PrfResults | undefined)?.prf?.results?.first;
  if (!out) throw new Error('この端末ではFace IDで鍵を取り出せませんでした');
  return out;
}

/** パスキーを作成し、PRF に対応していれば Face ID での解錠を有効にする */
export async function registerPasskey(meta: VaultMeta, passphrase: string): Promise<VaultMeta> {
  await dekFromPassphrase(meta, passphrase); // 先に合言葉を確認
  const prfSalt = rand(32);
  const cred = (await navigator.credentials.create({
    publicKey: {
      rp: { name: 'からだログ', id: rpId() },
      user: { id: rand(16), name: 'からだログ（写真の鍵）', displayName: 'からだログ（写真の鍵）' },
      challenge: rand(32),
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'required', userVerification: 'required' },
      timeout: 60000,
      extensions: { prf: { eval: { first: prfSalt } } } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error('パスキーを作成できませんでした');
  const ext = cred.getClientExtensionResults() as PrfResults;
  if (!ext.prf?.enabled && !ext.prf?.results?.first) throw new Error('この端末・ブラウザはFace IDでの写真の解錠に対応していません');
  const credentialId = new Uint8Array(cred.rawId) as Bytes;
  const out = ext.prf.results?.first ?? (await prfGet(credentialId, prfSalt));
  return attachPrf(meta, passphrase, credentialId, prfSalt, out);
}

export async function unlockWithPasskey(meta: VaultMeta): Promise<CryptoKey> {
  if (!meta.passkey) throw new Error('Face IDは未設定です');
  const out = await prfGet(fromB64(meta.passkey.credentialId), fromB64(meta.passkey.prfSalt));
  return unlockWithPrf(meta, out);
}
