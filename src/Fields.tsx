import { useEffect, useState } from "react";
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
  onChange: (v: number | null) => void;
  unit: string;
  min?: number;
  max?: number;
  nullable?: boolean;
  step?: number | "any";
  disabled?: boolean;
}) {
  const [raw, setRaw] = useState(value === null ? "" : format(value));
  const [error, setError] = useState("");
  useEffect(() => {
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
          onChange={(e) => {
            const raw = e.target.value;
            setRaw(raw);
            if (raw === "") {
              if (nullable) {
                setError("");
                onChange(null);
              } else setError("값을 입력하세요.");
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
            onChange(v);
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
