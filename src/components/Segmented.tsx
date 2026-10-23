interface Option<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

interface Props<T extends string> {
  options: Option<T>[];
  value: T | undefined;
  onChange: (v: T | undefined) => void;
  /** 選択中をもう一度タップで「未入力」に戻せる */
  clearable?: boolean;
}

export function Segmented<T extends string>({ options, value, onChange, clearable }: Props<T>) {
  return (
    <div className="seg" role="radiogroup">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            className={on ? 'on' : ''}
            onClick={() => onChange(on && clearable ? undefined : o.value)}
          >
            <span className="seg-label">{o.label}</span>
            {o.hint && <span className="seg-hint">{o.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}
