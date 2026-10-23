import type { Energy, ExerciseKind, Level, Meal, MeasureKey, Period } from './types';

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

export const KIND_LABEL: Record<ExerciseKind, string> = { strength: '筋トレ', cardio: '有酸素', other: 'その他' };

export const MEASURE_LABEL: Record<MeasureKey, string> = {
  neck: '首周り',
  waist: 'おへそ周り',
  hip: 'ヒップ',
  thigh: '右太もも',
  calf: '右ふくらはぎ',
  ankle: '足首',
  upperArm: '二の腕',
};
