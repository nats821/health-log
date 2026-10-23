/** ×=none ○=light ◎=good。未入力は undefined（×とは区別する） */
export type Level = 'none' | 'light' | 'good';
export type Energy = 'good' | 'normal' | 'tired';
export type Meal = 'healthy' | 'junk';
export type Period = 'none' | 'pre' | 'during';
export type Snack = 'none' | 'some';
export type Stool = 'hard' | 'normal' | 'soft';

export interface DailyRecord {
  date: string; // YYYY-MM-DD（端末のローカル日付）
  // 朝
  weight?: number;
  bodyFat?: number;
  sleepMinutes?: number;
  energy?: Energy;
  steps?: number; // 任意（過去データの取り込みなど）
  // 夜
  neat?: Level;
  strength?: Level;
  cardio?: Level;
  meal?: Meal; // 自己評価。医学的判定ではない
  period?: Period;
  // 任意の生活記録（毎日の必須入力ではない）
  snack?: Snack;
  bowelCount?: number; // 0回も「記録あり」。未入力は undefined
  stool?: Stool;
  condition?: string; // 体調の変化
  memo?: string;
  importedFrom?: string; // 過去データ取り込みで作った記録の印（取り消し用）
  morningAt?: string;
  eveningAt?: string;
  updatedAt: string;
}

export interface Settings {
  id: 'main';
  goalWeight: number;
  milestones: number[];
  startDate?: string;
  startWeight?: number;
  sleepHighlightMinutes: number; // 0で無効
  cardioLightMin: number; // ○の下限（分）
  cardioGoodMin: number; // ◎の下限（分）
}

export type ExerciseKind = 'strength' | 'cardio' | 'other';

/** 運動の詳細（任意）。重さ・回数・セットは入れなくてもよい */
export interface ExerciseEntry {
  id?: number;
  uid?: string; // 端末をまたいでも重ならないID（将来の同期用）
  date: string;
  kind: ExerciseKind;
  name: string;
  minutes?: number;
  weightKg?: number;
  reps?: number;
  sets?: number;
  createdAt: string;
}

export const MEASURE_KEYS = ['neck', 'waist', 'hip', 'thigh', 'calf', 'ankle', 'upperArm'] as const;
export type MeasureKey = (typeof MEASURE_KEYS)[number];

/** 月次ボディチェック（cm）。写真は Phase 3 で別管理 */
export type Measurement = Partial<Record<MeasureKey, number>> & {
  date: string;
  memo?: string;
  importedFrom?: string;
  updatedAt: string;
};

export type Angle = 'front' | 'side' | 'back';

/** 比較写真。画像は暗号化したまま保存し、加工はしない */
export interface PhotoRecord {
  uid: string;
  date: string;
  angle: Angle;
  mime: string;
  size: number;
  iv: Uint8Array<ArrayBuffer>;
  data: ArrayBuffer; // 暗号化済み
  createdAt: string;
}
