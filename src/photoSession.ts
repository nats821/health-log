import { useSyncExternalStore } from 'react';

/**
 * 解錠した写真用の鍵は、このメモリ上にだけ置く（保存しない）。
 * 5分操作がない、またはアプリを1分以上離れたら自動でロックする。
 */
const IDLE_MS = 5 * 60 * 1000;
const AWAY_MS = 60 * 1000;

let key: CryptoKey | null = null;
let lastActive = Date.now();
let hiddenAt: number | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const getPhotoKey = () => key;

export function setPhotoKey(k: CryptoKey) {
  key = k;
  lastActive = Date.now();
  emit();
}

export function lockPhotos() {
  if (!key) return;
  key = null;
  emit();
}

export function usePhotoKey() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getPhotoKey,
  );
}

if (typeof window !== 'undefined') {
  const touch = () => (lastActive = Date.now());
  window.addEventListener('pointerdown', touch, { passive: true });
  window.addEventListener('keydown', touch);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') hiddenAt = Date.now();
    else {
      if (hiddenAt && Date.now() - hiddenAt > AWAY_MS) lockPhotos();
      hiddenAt = null;
      touch();
    }
  });
  setInterval(() => {
    if (key && Date.now() - lastActive > IDLE_MS) lockPhotos();
  }, 15000);
}
