import PageHeader from '../components/PageHeader';

export default function About() {
  return (
    <>
      <PageHeader
        eyebrow="About"
        title="Growing old at home should not mean growing old alone"
      />
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-12 text-xl sm:py-16">
        <p>
          Across Indian cities, parents in their sixties and seventies live alone while their
          children work in other cities or other countries. The children worry. The parents do not
          want to be a burden. Small problems, like a missed medicine, can go unnoticed for days.
        </p>
        <p>
          HOMEX pairs each parent with one verified caregiver nearby, so care comes from a familiar
          face rather than a stranger every time. A dedicated care manager looks after the family,
          and daily check-ins mean nobody has to wonder how the day went.
        </p>
        <p>
          HOMEX began as an Engineering Design lab project, built around what families told us they
          needed most: caregivers they can trust, and word the moment something goes wrong.
        </p>
      </div>
    </>
  );
}
