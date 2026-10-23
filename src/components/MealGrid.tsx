import { MEAL_CHOICE_LABEL, MEAL_SLOT_LABEL } from '../labels';
import type { MealChoice, MealSlot } from '../types';
import { MEAL_SLOTS } from '../types';

const CHOICES: MealChoice[] = ['healthy', 'junk', 'skipped'];

/** 朝食・昼食・夕食・間食を1行ずつワンタップで。もう一度押すと未入力に戻る */
export function MealGrid({ value, onChange }: { value: Partial<Record<MealSlot, MealChoice>>; onChange: (slot: MealSlot, v: MealChoice | undefined) => void }) {
  return (
    <div className="meal-grid" role="group" aria-label="食事">
      {MEAL_SLOTS.map((slot) => (
        <div key={slot} className="meal-row">
          <span className="meal-name">
            {MEAL_SLOT_LABEL[slot]}
            {!value[slot] && <em className="state unset">未入力</em>}
          </span>
          <div className="meal-choices" role="radiogroup" aria-label={MEAL_SLOT_LABEL[slot]}>
            {CHOICES.map((c) => {
              const on = value[slot] === c;
              return (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className={`${on ? 'on' : ''} ${c}`}
                  onClick={() => onChange(slot, on ? undefined : c)}
                >
                  {MEAL_CHOICE_LABEL[c]}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
