export default function Toggle({ legend, options, value, onChange }) {
  return (
    <fieldset>
      <legend className="sr-only">{legend}</legend>
      <div className="inline-flex rounded-xl border-2 border-ink bg-white p-1">
        {options.map((option) => (
          <label
            key={option.value}
            className={`cursor-pointer rounded-lg px-4 py-1.5 font-semibold has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-clay ${
              value === option.value ? 'bg-ink text-cream' : ''
            }`}
          >
            <input
              type="radio"
              name={legend}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export const CYCLE_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'annual', label: 'Annual' },
];

export const CURRENCY_OPTIONS = [
  { value: 'INR', label: '₹ INR' },
  { value: 'USD', label: '$ USD' },
];
