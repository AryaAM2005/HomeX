import { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function FormField({ label, name, error, hint, type = 'text', ...inputProps }) {
  const id = useId();
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === 'password';
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ');

  return (
    <div>
      <label htmlFor={id} className="block font-semibold">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-base text-ink-soft">
          {hint}
        </p>
      )}
      <div className="relative mt-1.5">
        <input
          id={id}
          name={name}
          type={isPassword && revealed ? 'text' : type}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy || undefined}
          className={`min-h-12 w-full rounded-xl border-2 bg-white px-4 py-2 ${isPassword ? 'pr-14' : ''} ${
            error ? 'border-danger' : 'border-line hover:border-ink-soft'
          }`}
          {...inputProps}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((current) => !current)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            aria-pressed={revealed}
            className="absolute inset-y-1 right-1 grid w-11 place-items-center rounded-lg text-ink-soft hover:text-ink"
          >
            {revealed ? <EyeOff aria-hidden="true" size={22} /> : <Eye aria-hidden="true" size={22} />}
          </button>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-base font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
