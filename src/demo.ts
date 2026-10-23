import { addDays, today } from './date';
import { db } from './db';
import type { DailyRecord, Level } from './types';

/** デモ専用DBにだけ入れるサンプル値（本番DBには絶対に書かない） */
export async function seedDemoIfEmpty() {
  if ((await db.daily.count()) > 0) return;
  const t = today();
  const days = 200;
  const recs: DailyRecord[] = [];
  let w = 65.4;
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const lv = (): Level => (['none', 'light', 'good'] as Level[])[Math.floor(rnd() * 3)];
  for (let i = days; i >= 0; i--) {
    const date = addDays(t, -i);
    w += -0.012 + (rnd() - 0.5) * 0.35;
    const skip = rnd() < 0.15;
    recs.push({
      date,
      ...(skip ? {} : { weight: Math.round(w * 10) / 10, bodyFat: Math.round((33 - (65.4 - w) * 0.6 + (rnd() - 0.5)) * 10) / 10 }),
      sleepMinutes: 300 + Math.floor(rnd() * 150),
      energy: (['good', 'normal', 'tired'] as const)[Math.floor(rnd() * 3)],
      neat: lv(), strength: lv(), cardio: lv(),
      meal: rnd() < 0.2 ? 'junk' : 'healthy',
      period: i % 28 < 5 ? 'during' : i % 28 > 24 ? 'pre' : 'none',
      updatedAt: new Date().toISOString(),
    });
  }
  await db.daily.bulkPut(recs);
  await db.settings.put({ id: 'main', goalWeight: 53, milestones: [60, 55, 53], startDate: addDays(t, -days), sleepHighlightMinutes: 360, cardioLightMin: 10, cardioGoodMin: 30 });
}
