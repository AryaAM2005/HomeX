import { BellRing, Camera, MapPin, Pill, ShieldCheck, Smile } from 'lucide-react';

const VITALS = [
  { label: 'BP', value: '128/82' },
  { label: 'Sugar', value: '112' },
  { label: 'Pulse', value: '76' },
];

// An illustration of the family dashboard. Everything here is sample data.
export default function CheckInPreview() {
  return (
    <figure className="relative mx-auto w-full max-w-md">
      <div className="rounded-3xl border border-line bg-white p-5 shadow-[0_18px_40px_-20px_rgba(43,36,32,0.35)] sm:p-6">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-display text-xl font-semibold">Today's check-in</p>
          <p className="text-base whitespace-nowrap text-ink-soft">9:42 AM</p>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-sand p-3">
          <span
            aria-hidden="true"
            className="grid size-12 shrink-0 place-items-center rounded-full bg-clay font-display text-xl font-semibold text-white"
          >
            S
          </span>
          <div>
            <p className="font-semibold">Sunita, primary caregiver</p>
            <p className="flex items-center gap-1 text-base font-medium text-leaf">
              <ShieldCheck aria-hidden="true" size={18} />
              Police verified
            </p>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          {VITALS.map((vital) => (
            <div key={vital.label} className="rounded-xl border border-line py-2">
              <dt className="text-base text-ink-soft">{vital.label}</dt>
              <dd className="font-semibold">{vital.value}</dd>
            </div>
          ))}
        </dl>

        <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-base">
          <li className="flex items-center gap-2">
            <MapPin aria-hidden="true" size={18} className="text-clay" /> GPS confirmed
          </li>
          <li className="flex items-center gap-2">
            <Camera aria-hidden="true" size={18} className="text-clay" /> Photo added
          </li>
          <li className="flex items-center gap-2">
            <Pill aria-hidden="true" size={18} className="text-clay" /> 3 of 3 medicines
          </li>
          <li className="flex items-center gap-2">
            <Smile aria-hidden="true" size={18} className="text-clay" /> Cheerful today
          </li>
        </ul>
      </div>

      <div className="relative mt-3 flex gap-3 rounded-2xl border-2 border-sos bg-white p-4 shadow-lg sm:-mt-3 sm:-ml-6 sm:max-w-80">
        <BellRing aria-hidden="true" size={24} className="mt-0.5 shrink-0 text-sos" />
        <p className="text-base leading-snug">
          <strong className="block">Evening medicine missed</strong>
          Alert sent to you and your care manager.
        </p>
      </div>

      <figcaption className="sr-only">
        Example of a daily check-in and an alert as a family would see them.
      </figcaption>
    </figure>
  );
}
