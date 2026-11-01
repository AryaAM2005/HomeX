import PageHeader from '../components/PageHeader';
import { SUPPORT_EMAIL } from '../data/site';

const SECTIONS = [
  {
    heading: 'What we collect',
    text: "Your name, email, mobile number, country and time zone, and the details you add about your parent, including address, health conditions, allergies and emergency contact. Caregivers add check-in records such as vitals, medicines, photos and location.",
  },
  {
    heading: 'Why we use it',
    text: 'Only to provide care: to match your parent with a caregiver, record visits and medicines, send alerts and prepare reports.',
  },
  {
    heading: 'Who can see it',
    text: "A parent's health details are visible only to that family, their assigned caregivers, their care manager and HOMEX admin. A caregiver sees them only after accepting a family's request. A caregiver's phone number is shared only after assignment or booking acceptance. Caregivers' ID, police and training documents can be opened only by the caregiver and HOMEX admin.",
  },
  {
    heading: 'Your rights',
    text: `Under India's Digital Personal Data Protection Act, 2023, you can withdraw consent, get a copy of your data or delete your account. You can do this yourself at any time from Settings, or write to ${SUPPORT_EMAIL} and we will act within 30 days. We keep payment records for accounting, and a record that you gave consent.`,
  },
  {
    heading: "Your parent's consent",
    text: "Please make sure your parent knows you are adding their details to HOMEX and agrees to it.",
  },
];

export default function Privacy() {
  return (
    <>
      <PageHeader eyebrow="Privacy notice" title="How HOMEX handles your family's data" />
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-12 sm:py-16">
        {SECTIONS.map((section) => (
          <section key={section.heading}>
            <h2 className="text-2xl">{section.heading}</h2>
            <p className="mt-2 text-ink-soft">{section.text}</p>
          </section>
        ))}
      </div>
    </>
  );
}
