const pad = (n: number) => String(n).padStart(2, '0');

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function today(): string {
  return toISO(new Date());
}

export function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** 暦日で n 日ずらす（夏時間などの影響を受けないようにローカル日付で計算） */
export function addDays(s: string, n: number): string {
  const d = parseISO(s);
  return toISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}

/** その日を含む週の月曜日 */
export function weekStart(s: string): string {
  const dow = parseISO(s).getDay(); // 0=日
  return addDays(s, dow === 0 ? -6 : 1 - dow);
}

const WEEK = ['日', '月', '火', '水', '木', '金', '土'];

export function formatJa(s: string): string {
  const d = parseISO(s);
  return `${d.getMonth() + 1}/${d.getDate()}（${WEEK[d.getDay()]}）`;
}

export function formatShort(s: string): string {
  const d = parseISO(s);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
