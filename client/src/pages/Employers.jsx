import { Link } from 'react-router';
import PageHeader from '../components/PageHeader';

const TIERS = [
  { discount: '10% off', size: 'For companies with 10+ employees' },
  { discount: '20% off', size: 'For companies with 50+ employees' },
];

export default function Employers() {
  return (
    <>
      <PageHeader
        eyebrow="For Employers"
        title="Support the people who are caring for their parents"
        intro="Worry about an ageing parent follows people to work. A HOMEX employer code makes reliable care more affordable for your team."
      />
      <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <ul className="grid gap-6 sm:grid-cols-2">
          {TIERS.map((tier) => (
            <li key={tier.discount} className="rounded-2xl border border-line bg-white p-6">
              <p className="font-display text-4xl font-semibold text-clay">{tier.discount}</p>
              <p className="mt-2">{tier.size}</p>
            </li>
          ))}
        </ul>

        <h2 className="mt-14 text-3xl">How it works</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-6 text-ink-soft">
          <li>Contact us and we create an employer code for your company.</li>
          <li>Share the code with your employees.</li>
          <li>They enter it when they subscribe, and the discount is applied.</li>
        </ol>

        <Link to="/contact" className="btn btn-primary mt-10">
          Talk to us
        </Link>
      </div>
    </>
  );
}
