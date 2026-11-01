import PageHeader from '../components/PageHeader';
import PlanCards from '../components/PlanCards';

const EXTRAS = [
  {
    title: '7-day free trial',
    text: 'Your first subscription starts free.',
  },
  {
    title: 'Pay per visit',
    text: 'Not subscribed? Book an emergency visit or a single doctor escort when you need one.',
  },
  {
    title: 'Refer a family',
    text: 'When a family you refer makes their first payment, you each get Rs. 500 credit.',
  },
  {
    title: 'Employer discount',
    text: 'An employer code takes 10% off for 10+ employees, or 20% off for 50+.',
  },
];

export default function Plans() {
  return (
    <>
      <PageHeader
        eyebrow="Plans & Pricing"
        title="One plan per parent. Change it any time."
        intro="Pay monthly, or pay annually and get two months free."
      />
      <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <PlanCards />

        <h2 className="mt-16 text-3xl">Also available</h2>
        <dl className="mt-6 grid gap-6 sm:grid-cols-2">
          {EXTRAS.map((extra) => (
            <div key={extra.title} className="rounded-2xl bg-sand p-5">
              <dt className="font-semibold">{extra.title}</dt>
              <dd className="mt-1 text-ink-soft">{extra.text}</dd>
            </div>
          ))}
        </dl>
      </div>
    </>
  );
}
