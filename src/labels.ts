import type { Energy, Level, Meal, Period } from './types';

export const LEVEL_LABEL: Record<Level, string> = { none: '×', light: '○', good: '◎' };
export const ENERGY_LABEL: Record<Energy, string> = { good: '元気', normal: '普通', tired: 'だるい' };
export const MEAL_LABEL: Record<Meal, string> = { healthy: 'ヘルシー', junk: 'ジャンク' };
export const PERIOD_LABEL: Record<Period, string> = { none: 'なし', pre: '生理前', during: '生理中' };

export const NEAT_HINT: Record<Level, string> = {
  none: 'ほぼ座りっぱなし',
  light: '家事や買い物で適度に',
  good: 'よく動いた',
};
export const STRENGTH_HINT: Record<Level, string> = {
  none: 'なし・休息日',
  light: '軽めに実施',
  good: 'しっかり取り組んだ',
};
export function cardioHint(lightMin: number, goodMin: number): Record<Level, string> {
  return { none: 'なし', light: `${lightMin}〜${goodMin - 1}分`, good: `${goodMin}分以上` };
}
