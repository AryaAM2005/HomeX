import { Mail, Phone } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { HELPLINE, SUPPORT_EMAIL } from '../data/site';

export default function Contact() {
  return (
    <>
      <PageHeader eyebrow="Contact" title="We are here, day and night" />
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-12 sm:grid-cols-2 sm:py-16">
        <a href={HELPLINE.href} className="rounded-2xl border border-line bg-white p-6 hover:border-clay">
          <Phone aria-hidden="true" size={28} className="text-clay" />
          <h2 className="mt-3 text-2xl">24/7 helpline</h2>
          <p className="mt-1 text-xl font-semibold">{HELPLINE.display}</p>
          <p className="mt-1 text-ink-soft">Call us any time, especially in an emergency.</p>
        </a>
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="rounded-2xl border border-line bg-white p-6 hover:border-clay"
        >
          <Mail aria-hidden="true" size={28} className="text-clay" />
          <h2 className="mt-3 text-2xl">Email</h2>
          <p className="mt-1 text-xl font-semibold break-words">{SUPPORT_EMAIL}</p>
          <p className="mt-1 text-ink-soft">For questions, employer codes and feedback.</p>
        </a>
      </div>
    </>
  );
}
