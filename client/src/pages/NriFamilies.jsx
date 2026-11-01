import { Clock, DollarSign, Share2, UserRoundCheck } from 'lucide-react';
import { Link } from 'react-router';
import PageHeader from '../components/PageHeader';

const BENEFITS = [
  {
    title: 'Prices in US dollars',
    text: 'See every plan in USD or INR, whichever you prefer.',
    Icon: DollarSign,
  },
  {
    title: 'Your time zone, not ours',
    text: 'Notifications and check-in times are shown in your local time.',
    Icon: Clock,
  },
  {
    title: 'One person who knows your family',
    text: 'Your care manager is your single point of contact in India.',
    Icon: UserRoundCheck,
  },
  {
    title: 'Reports you can share',
    text: 'Send a wellness report to your siblings with a WhatsApp link.',
    Icon: Share2,
  },
];

export default function NriFamilies() {
  return (
    <>
      <PageHeader
        eyebrow="For NRI Families"
        title="An ocean away, and still there every day"
        intro="When your parents are alone in India and you can't just drop by, HOMEX gives you someone trusted at their door."
      />
      <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <ul className="grid gap-8 sm:grid-cols-2">
          {BENEFITS.map(({ title, text, Icon }) => (
            <li key={title} className="flex gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-sand text-clay">
                <Icon aria-hidden="true" size={26} />
              </span>
              <div>
                <h2 className="font-sans text-xl font-semibold">{title}</h2>
                <p className="text-ink-soft">{text}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-12 flex flex-wrap gap-3">
          <Link to="/signup" className="btn btn-primary">
            Start 7-day free trial
          </Link>
          <Link to="/plans" className="btn btn-secondary">
            See USD prices
          </Link>
        </div>
      </div>
    </>
  );
}
