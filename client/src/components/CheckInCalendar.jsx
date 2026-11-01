import { Check } from 'lucide-react';

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const pad = (number) => String(number).padStart(2, '0');

function daysOf(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  const dayCount = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  // getUTCDay counts from Sunday, and this calendar starts on Monday.
  const leadingBlanks = (new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay() + 6) % 7;

  return {
    leadingBlanks,
    days: Array.from({ length: dayCount }, (_, index) => ({
      number: index + 1,
      date: `${month}-${pad(index + 1)}`,
    })),
  };
}

export default function CheckInCalendar({ month, today, checkIns, selected, onSelect }) {
  const counts = new Map();
  checkIns.forEach(({ date }) => counts.set(date, (counts.get(date) ?? 0) + 1));

  const { leadingBlanks, days } = daysOf(month);

  return (
    <div className="rounded-2xl border border-line bg-white p-3 sm:p-4">
      <div className="grid grid-cols-7 gap-1 text-center" aria-hidden="true">
        {WEEK.map((day) => (
          <span key={day} className="text-base text-ink-soft">
            {day}
          </span>
        ))}
      </div>
      <ul className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: leadingBlanks }, (_, index) => (
          <li key={`blank-${index}`} aria-hidden="true" />
        ))}
        {days.map(({ number, date }) => {
          const count = counts.get(date) ?? 0;
          const isToday = date === today;
          const isSelected = date === selected;
          const shared = `grid h-12 w-full place-items-center rounded-lg ${
            isToday ? 'ring-2 ring-ink' : ''
          }`;

          return (
            <li key={date}>
              {count > 0 ? (
                <button
                  type="button"
                  onClick={() => onSelect(isSelected ? null : date)}
                  aria-pressed={isSelected}
                  aria-label={`${date}: ${count} ${count === 1 ? 'check-in' : 'check-ins'}`}
                  className={`${shared} leading-none font-semibold ${
                    isSelected ? 'bg-leaf text-white' : 'bg-sand'
                  }`}
                >
                  <span>{number}</span>
                  <Check aria-hidden="true" size={16} strokeWidth={3} />
                </button>
              ) : (
                <span className={`${shared} text-ink-soft`}>
                  <span className="sr-only">{date}: no check-in</span>
                  <span aria-hidden="true">{number}</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
