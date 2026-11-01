import {
  BadgeCheck,
  BellRing,
  ClipboardCheck,
  FileBadge,
  FlaskConical,
  HeartPulse,
  Home as HomeIcon,
  LayoutDashboard,
  Phone,
  ShieldCheck,
  Stethoscope,
  Sun,
  UserRoundCheck,
  UserRoundSearch,
  UsersRound,
  UtensilsCrossed,
} from 'lucide-react';
import { Link } from 'react-router';
import CheckInPreview from '../components/CheckInPreview';
import PlanCards from '../components/PlanCards';
import { HELPLINE } from '../data/site';
import { usePageTitle } from '../hooks/usePageTitle';

const STEPS = [
  {
    title: 'Choose a plan',
    text: "Add your parent's details and start with a 7-day free trial.",
    Icon: ClipboardCheck,
  },
  {
    title: 'Pick one caregiver nearby',
    text: 'See verified caregivers on a map. You also get a dedicated care manager.',
    Icon: UserRoundSearch,
  },
  {
    title: 'See every day from anywhere',
    text: 'Check-ins, medicines and reports reach your dashboard. So do alerts, the moment they happen.',
    Icon: LayoutDashboard,
  },
];

const SERVICES = [
  {
    title: 'Daily check-ins',
    text: 'A visit or call, logged with GPS, a photo, mood and vitals.',
    Icon: Sun,
  },
  {
    title: 'Doctor visits',
    text: 'Appointments booked, your parent escorted, and a care report afterwards.',
    Icon: Stethoscope,
  },
  {
    title: 'Lab tests',
    text: 'Tests booked, with an escort or home sample collection.',
    Icon: FlaskConical,
  },
  {
    title: 'Meals and medicines',
    text: 'Help with food, plus a given or missed record for every dose.',
    Icon: UtensilsCrossed,
  },
  {
    title: 'Companionship',
    text: 'Unhurried visits, so your parent has someone to talk to.',
    Icon: UsersRound,
  },
  {
    title: 'Post-hospital recovery',
    text: 'Extra support at home after a hospital stay.',
    Icon: HeartPulse,
  },
];

const VERIFICATION = [
  { title: 'Identity check', text: 'Government ID documents are reviewed.', Icon: BadgeCheck },
  { title: 'Police verification', text: 'A police check is required.', Icon: ShieldCheck },
  { title: 'Training certificates', text: 'Care training is confirmed.', Icon: FileBadge },
  {
    title: 'HOMEX approval',
    text: 'Only approved caregivers appear to families.',
    Icon: UserRoundCheck,
  },
];

const REVIEWS = [
  {
    quote: 'I used to call home three times a day to check on Baba. Now I just open the dashboard.',
    name: 'Ritika, Bengaluru',
  },
  {
    quote: 'The time difference was the hard part. The alerts reach me wherever I am.',
    name: 'Sourav, New Jersey',
  },
  {
    quote: 'My mother has the same caregiver every day. They have become friends.',
    name: 'Meera, Pune',
  },
];

const FAQS = [
  {
    question: 'What happens in an emergency?',
    answer:
      'An SOS alerts your family and care manager within seconds. The care manager takes charge, and if an SOS is not acknowledged within 5 minutes it goes to HOMEX admin.',
  },
  {
    question: 'How are caregivers verified?',
    answer:
      'Every caregiver submits ID, police verification and training certificates. They appear to families only after HOMEX has approved them.',
  },
  {
    question: 'What if our caregiver is away?',
    answer:
      'Your care manager assigns a backup caregiver, so your parent is not left without care.',
  },
  {
    question: 'Does my parent need a smartphone?',
    answer:
      'No. Your parent never has to log in. You and the caregiver handle everything, and there is a simple page with one large SOS button if they want it.',
  },
  {
    question: 'Can I pay in US dollars?',
    answer: 'Yes. Prices are shown in INR or USD, and alerts follow your own time zone.',
  },
  {
    question: 'Can I cancel?',
    answer:
      'Yes, you can upgrade, downgrade or cancel your plan. The first plan starts with a 7-day free trial.',
  },
];

export default function Home() {
  usePageTitle();

  return (
    <>
      <section className="overflow-hidden bg-sand">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-10 sm:pb-24 sm:pt-16 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <p className="font-display text-xl text-clay">Care That Comes Home.</p>
            <h1 className="mt-3 text-[2rem] sm:text-5xl lg:text-[3.25rem]">
              Background &amp; police-verified caregivers.
              <span className="mt-2 block text-clay">Get alerted the moment something happens.</span>
            </h1>
            <p className="mt-4 max-w-xl text-ink-soft sm:mt-6 sm:text-xl">
              For working children and NRI families whose parents live alone. One dedicated
              caregiver, one care manager, and a daily check-in you can see from anywhere.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 sm:mt-8">
              <Link to="/signup" className="btn btn-primary">
                Start 7-day free trial
              </Link>
              <Link to="/plans" className="btn btn-secondary">
                See plans
              </Link>
            </div>
          </div>
          <CheckInPreview />
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <h2 className="text-4xl">How it works</h2>
        <ol className="mt-10 grid gap-10 md:grid-cols-3">
          {STEPS.map(({ title, text, Icon }, index) => (
            <li key={title}>
              <div className="flex items-center gap-3">
                <span className="font-display text-5xl font-semibold text-marigold" aria-hidden="true">
                  {index + 1}
                </span>
                <Icon aria-hidden="true" size={30} className="text-clay" />
              </div>
              <h3 className="mt-3 text-2xl">{title}</h3>
              <p className="mt-2 text-ink-soft">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <h2 className="text-4xl">Everything your parent needs at home</h2>
          <ul className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map(({ title, text, Icon }) => (
              <li key={title} className="flex gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-sand text-clay">
                  <Icon aria-hidden="true" size={26} />
                </span>
                <div>
                  <h3 className="font-sans text-xl font-semibold">{title}</h3>
                  <p className="text-ink-soft">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <h2 className="text-4xl">Plans for every family</h2>
        <p className="mt-3 mb-8 text-ink-soft">
          Every plan is per parent and includes the 24/7 helpline.
        </p>
        <PlanCards />
      </section>

      <section className="bg-leaf text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
          <h2 className="text-4xl">Nobody enters your parent's home unchecked</h2>
          <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {VERIFICATION.map(({ title, text, Icon }) => (
              <li key={title}>
                <Icon aria-hidden="true" size={32} />
                <h3 className="mt-3 font-sans text-xl font-semibold">{title}</h3>
                <p className="mt-1 text-white/90">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <h2 className="text-4xl">What families say</h2>
        <p className="mt-2 text-ink-soft">Sample reviews for this prototype.</p>
        <ul className="mt-8 grid gap-6 md:grid-cols-3">
          {REVIEWS.map((review) => (
            <li key={review.name} className="border-l-4 border-marigold pl-5">
              <blockquote className="font-display text-xl">{review.quote}</blockquote>
              <p className="mt-3 font-semibold">{review.name}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-ink text-cream">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-4 py-12">
          <div className="flex gap-4">
            <BellRing aria-hidden="true" size={36} className="mt-1 shrink-0 text-marigold" />
            <div>
              <h2 className="text-3xl">Help is one call away, day or night</h2>
              <p className="mt-1 text-sand">Our 24/7 helpline is open to every HOMEX family.</p>
            </div>
          </div>
          <a href={HELPLINE.href} className="btn bg-cream text-ink hover:bg-sand">
            <Phone aria-hidden="true" size={20} />
            {HELPLINE.display}
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 sm:py-20">
        <h2 className="text-4xl">Common questions</h2>
        <div className="mt-8 divide-y divide-line border-y border-line">
          {FAQS.map((faq) => (
            <details key={faq.question} className="py-4">
              <summary className="cursor-pointer text-xl font-semibold">{faq.question}</summary>
              <p className="mt-2 text-ink-soft">{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="bg-sand">
        <div className="mx-auto max-w-6xl px-4 py-14 text-center">
          <HomeIcon aria-hidden="true" size={36} className="mx-auto text-clay" />
          <h2 className="mt-3 text-4xl">Start with 7 days free</h2>
          <Link to="/signup" className="btn btn-primary mt-6">
            Create your account
          </Link>
        </div>
      </section>
    </>
  );
}
