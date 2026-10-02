import { forwardRef, useId, type InputHTMLAttributes } from 'react';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label: string;
  /** [REKOMENDASI] State error tidak ada di Figma; mengikuti SDD 7.7.1 (pesan di bawah kolom). */
  error?: string;
  className?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, id, className = '', ...inputProps },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const labelId = `${inputId}-label`;
  const errorId = `${inputId}-error`;
  const borderClass = error ? 'border-feedback-salah' : 'border-neutral-border-strong focus-within:border-brand-primary';

  return (
    <div className={className}>
      {/* Seluruh kotak adalah <label>, jadi klik di mana pun di dalamnya memfokuskan input. */}
      <label
        htmlFor={inputId}
        className={`flex cursor-text flex-col gap-1 rounded-card border-2 bg-neutral-surface px-5 py-[14px] transition-colors ${borderClass}`}
      >
        <span id={labelId} className="text-body-s text-text-muted">
          {label}
        </span>
        <input
          ref={ref}
          id={inputId}
          aria-labelledby={labelId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="w-full bg-transparent p-0 text-body-l text-text-primary outline-none"
          {...inputProps}
        />
      </label>
      {error && (
        <p id={errorId} className="mt-2 text-body-s text-feedback-salah">
          {error}
        </p>
      )}
    </div>
  );
});
