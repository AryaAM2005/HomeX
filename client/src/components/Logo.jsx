import { Link } from 'react-router';

export default function Logo({ tone = 'dark' }) {
  return (
    <Link
      to="/"
      aria-label="HOMEX home"
      className={`inline-flex items-center gap-2 font-display text-2xl font-semibold tracking-wide ${
        tone === 'light' ? 'text-cream' : 'text-ink'
      }`}
    >
      <img src="/favicon.svg" alt="" width="32" height="32" />
      <span>
        HOME<span className={tone === 'light' ? 'text-marigold' : 'text-clay'}>X</span>
      </span>
    </Link>
  );
}
