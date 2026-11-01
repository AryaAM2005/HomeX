import { Link } from 'react-router';
import { HELPLINE } from '../data/site';
import Logo from './Logo';

const columns = [
  {
    heading: 'HOMEX',
    links: [
      { to: '/about', label: 'About' },
      { to: '/plans', label: 'Plans & Pricing' },
      { to: '/contact', label: 'Contact' },
      { to: '/privacy', label: 'Privacy notice' },
    ],
  },
  {
    heading: 'Who we help',
    links: [
      { to: '/signup', label: 'Book care for a parent' },
      { to: '/nri-families', label: 'NRI families' },
      { to: '/employers', label: 'Employers' },
      { to: '/signup?role=caregiver', label: 'Become a caregiver' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="bg-ink text-cream">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-[2fr_1fr_1fr]">
        <div>
          <Logo tone="light" />
          <p className="mt-3 font-display text-xl">Care That Comes Home.</p>
          <p className="mt-3 text-sand">
            24/7 helpline:{' '}
            <a href={HELPLINE.href} className="font-semibold underline underline-offset-4">
              {HELPLINE.display}
            </a>
          </p>
        </div>
        {columns.map((column) => (
          <div key={column.heading}>
            <h2 className="font-sans text-lg font-semibold">{column.heading}</h2>
            <ul className="mt-3 space-y-2">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link to={link.to} className="text-sand underline-offset-4 hover:underline">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="border-t border-white/15 px-4 pb-24 pt-5 text-center text-base text-sand md:pb-5">
        © {new Date().getFullYear()} HOMEX. Engineering Design lab project.
      </p>
    </footer>
  );
}
