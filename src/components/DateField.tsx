import { today } from '../date';

export function DateField({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  return (
    <label className="field">
      <span>日付</span>
      <input type="date" value={value} max={today()} onChange={(e) => e.target.value && onChange(e.target.value)} />
    </label>
  );
}
