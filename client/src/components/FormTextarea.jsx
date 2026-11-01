import { useId } from 'react';

export default function FormTextarea({ label, name, error, hint, rows = 4, ...textareaProps }) {
  const id = useId();
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
      <textarea
        id={id}
        name={name}
        rows={rows}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy || undefined}
        className={`mt-1.5 w-full rounded-xl border-2 bg-white px-4 py-2 ${
          error ? 'border-danger' : 'border-line hover:border-ink-soft'
        }`}
        {...textareaProps}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-base font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
