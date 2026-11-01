export default function CheckboxGroup({ legend, name, options, values, onChange, error }) {
  const toggle = (value) =>
    onChange(
      values.includes(value) ? values.filter((current) => current !== value) : [...values, value],
    );

  return (
    <fieldset>
      <legend className="font-semibold">{legend}</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label key={option.value} className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              name={name}
              checked={values.includes(option.value)}
              onChange={() => toggle(option.value)}
              className="size-5 shrink-0 accent-clay"
            />
            {option.label}
          </label>
        ))}
      </div>
      {error && <p className="mt-1.5 text-base font-medium text-danger">{error}</p>}
    </fieldset>
  );
}
