import Dexie, { type Table } from 'dexie';
import type { DailyRecord, ExerciseEntry, Measurement, Settings } from './types';

/** ?demo=1 のときは別DBを使い、サンプル値が本番データに混ざらないようにする */
export const IS_DEMO =
  typeof location !== 'undefined' && new URLSearchParams(location.search).get('demo') === '1';

class HealthDB extends Dexie {
  daily!: Table<DailyRecord, string>;
  settings!: Table<Settings, string>;
  exercises!: Table<ExerciseEntry, number>;
  measurements!: Table<Measurement, string>;
  constructor(name: string) {
    super(name);
    this.version(1).stores({ daily: 'date', settings: 'id' });
    this.version(2).stores({ daily: 'date', settings: 'id', exercises: '++id, date', measurements: 'date' });
  }
}

export const db = new HealthDB(IS_DEMO ? 'health-log-demo' : 'health-log');

export const DEFAULT_SETTINGS: Settings = {
  id: 'main',
  goalWeight: 53,
  milestones: [60, 55, 53],
  sleepHighlightMinutes: 360,
  cardioLightMin: 10,
  cardioGoodMin: 30,
};

export async function getSettings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...(await db.settings.get('main')) };
}

export async function saveSettings(s: Settings) {
  await db.settings.put({ ...s, id: 'main' });
}

/** 既存の記録に部分更新をマージ。undefined の項目は「未入力に戻す」として削除する */
export async function saveDaily(date: string, patch: Partial<DailyRecord>) {
  await db.transaction('rw', db.daily, async () => {
    const cur = await db.daily.get(date);
    const next: Record<string, unknown> = { ...cur, ...patch, date, updatedAt: new Date().toISOString() };
    for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
    await db.daily.put(next as unknown as DailyRecord);
  });
}

export async function requestPersistence(): Promise<boolean | null> {
  if (!navigator.storage?.persist) return null;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}
