/** ×=none ○=light ◎=good。未入力は undefined（×とは区別する） */
export type Level = 'none' | 'light' | 'good';
export type Energy = 'good' | 'normal' | 'tired';
export type Meal = 'healthy' | 'junk';
export type Period = 'none' | 'pre' | 'during';

export interface DailyRecord {
  date: string; // YYYY-MM-DD（端末のローカル日付）
  // 朝
  weight?: number;
  bodyFat?: number;
  sleepMinutes?: number;
  energy?: Energy;
  // 夜
  neat?: Level;
  strength?: Level;
  cardio?: Level;
  meal?: Meal; // 自己評価。医学的判定ではない
  period?: Period;
  memo?: string;
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
