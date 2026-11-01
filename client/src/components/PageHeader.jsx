import { usePageTitle } from '../hooks/usePageTitle';

export default function PageHeader({ eyebrow, title, intro }) {
  usePageTitle(eyebrow ?? title);

  return (
    <div className="bg-sand">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        {eyebrow && <p className="font-semibold text-clay">{eyebrow}</p>}
        <h1 className="mt-1 max-w-3xl text-4xl sm:text-5xl">{title}</h1>
        {intro && <p className="mt-4 max-w-2xl text-xl text-ink-soft">{intro}</p>}
      </div>
    </div>
  );
}
