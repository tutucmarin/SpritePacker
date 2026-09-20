import { useEffect, useRef, useState } from "react";
import type { InputHTMLAttributes } from "react";

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange" | "onBlur" | "onKeyDown"
> & {
  value: number | null;
  onCommit: (value: number) => void | Promise<void>;
  integer?: boolean;
};

/**
 * Keeps an editable string while focused so intermediate values such as an
 * empty string or a lone minus sign do not leak into application state.
 */
export function CommittedNumberInput({
  value,
  onCommit,
  min,
  max,
  integer = true,
  ...inputProps
}: Props) {
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  const focused = useRef(false);
  const cancelBlurCommit = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(value == null ? "" : String(value));
  }, [value]);

  const restore = () => setDraft(value == null ? "" : String(value));

  const commit = () => {
    const parsed = Number(draft.trim());
    if (draft.trim() === "" || !Number.isFinite(parsed)) {
      restore();
      return;
    }

    const minimum = numericConstraint(min);
    const maximum = numericConstraint(max);
    let next = integer ? Math.round(parsed) : parsed;
    if (minimum != null) next = Math.max(minimum, next);
    if (maximum != null) next = Math.min(maximum, next);

    setDraft(String(next));
    if (next !== value) void onCommit(next);
  };

  return (
    <input
      {...inputProps}
      type="number"
      value={draft}
      min={min}
      max={max}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        focused.current = false;
        if (cancelBlurCommit.current) {
          cancelBlurCommit.current = false;
          return;
        }
        commit();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        } else if (event.key === "Escape") {
          event.preventDefault();
          cancelBlurCommit.current = true;
          restore();
          event.currentTarget.blur();
        }
      }}
    />
  );
}

function numericConstraint(value: string | number | undefined): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
