import type { Energy, ExerciseKind, Level, Meal, MealChoice, MealSlot, MeasureKey, Period, Snack, Stool } from './types';

export const LEVEL_LABEL: Record<Level, string> = { none: '×', light: '○', good: '◎' };
export const ENERGY_LABEL: Record<Energy, string> = { good: '元気', normal: '普通', tired: 'だるい' };
export const MEAL_LABEL: Record<Meal, string> = { healthy: 'ヘルシー', junk: 'ジャンク' };
export const PERIOD_LABEL: Record<Period, string> = { none: 'なし', pre: '生理前', during: '生理中' };

export const MEAL_CHOICE_LABEL: Record<MealChoice, string> = { healthy: 'ヘルシー', junk: 'ジャンク', skipped: '食べていない' };
export const MEAL_SLOT_LABEL: Record<MealSlot, string> = { breakfast: '朝食', lunch: '昼食', dinner: '夕食', snackFood: '間食' };
export const SNACK_LABEL: Record<Snack, string> = { none: 'なし', some: 'あり' };
export const STOOL_LABEL: Record<Stool, string> = { hard: '硬め', normal: 'ふつう', soft: 'やわらかめ' };

/** ボタンに出す短い説明 */
export const NEAT_HINT: Record<Level, string> = { none: '座りがち', light: 'そこそこ', good: 'よく動いた' };
export const STRENGTH_HINT: Record<Level, string> = { none: '実施なし', light: '軽く実施', good: 'しっかり' };
export function cardioHint(lightMin: number, goodMin: number): Record<Level, string> {
  return { none: '実施なし', light: `${lightMin}〜${goodMin - 1}分`, good: `${goodMin}分以上` };
}

/** 選んだときに下に出す基準の説明 */
export const NEAT_DESC: Record<Level, string> = {
  none: '座っている・横になっている時間が長かった',
  light: '家事や移動などでそこそこ動いた',
  good: '一日を通してよく動いた',
};
export const STRENGTH_DESC: Record<Level, string> = {
  none: '実施なし（休息日も大切です）',
  light: '軽く実施',
  good: 'しっかり実施',
};
export function cardioDesc(lightMin: number, goodMin: number): Record<Level, string> {
  return { none: '実施なし', light: `${lightMin}分以上${goodMin}分未満`, good: `${goodMin}分以上` };
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
