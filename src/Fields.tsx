import { createContext, useContext, useEffect, useRef, useState } from "react";
export const FieldValidity = createContext<(label: string, invalid: boolean) => void>(() => {});
export function NumberField({
  label,
  value,
  onChange,
  unit,
  min,
  max,
  nullable = false,
  step = "any",
  disabled = false,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void | boolean;
  unit: string;
  min?: number;
  max?: number;
  nullable?: boolean;
  step?: number | "any";
  disabled?: boolean;
}) {
  const [raw, setRaw] = useState(value === null ? "" : format(value));
  const [error, setError] = useState("");
  const validity = useContext(FieldValidity);
  const ownValue = useRef<number | null | undefined>(undefined);
  useEffect(() => { validity(label, !!error); return () => validity(label, false); }, [error, label, validity]);
  useEffect(() => {
    if (ownValue.current === value) { ownValue.current = undefined; return; }
    setRaw(value === null ? "" : format(value));
    setError("");
  }, [value]);
  return (
    <label className="field">
      <span>{label}</span>
      <div className={`unit-input ${error ? "invalid" : ""}`}>
        <input
          aria-label={label}
          aria-invalid={!!error}
          type="number"
          step={step}
          min={min}
          max={max}
          placeholder={nullable ? "TBD" : undefined}
          value={raw}
          disabled={disabled}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
          onBlur={() => {
            setRaw(value === null ? "" : format(value));
            if (error) setError("");
            // A rejected draft never becomes a committed number.
            validity(label, false);
          }}
          onChange={(e) => {
            const raw = e.target.value;
            setRaw(raw);
            if (raw === "") {
              if (nullable) {
                setError("");
                ownValue.current = null;
                onChange(null);
              } else setError("값을 입력하세요. Blur/Enter로 마지막 유효 값을 복구합니다.");
              return;
            }
            const v = Number(raw);
            if (
              !Number.isFinite(v) ||
              (min !== undefined && v < min) ||
              (max !== undefined && v > max)
            ) {
              setError(`${min ?? "−∞"} ~ ${max ?? "∞"} 범위를 입력하세요.`);
              return;
            }
            setError("");
            ownValue.current = v;
            if (onChange(v) === false) setError("반영할 수 없습니다. Geometry/범위를 확인하세요. Blur/Enter로 마지막 유효 값을 복구합니다.");
          }}
        />
        <span>{unit}</span>
      </div>
      {error && <small role="alert">{error}</small>}
    </label>
  );
}
export function format(v: number) {
  return Number(v.toPrecision(10)).toString();
}
