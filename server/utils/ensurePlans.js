import { Plan } from '../models/Plan.js';

const DEFAULT_PLANS = [
  {
    name: 'Basic',
    summary: 'A regular check on how your parent is doing.',
    features: ['Weekly check-in call', 'Monthly report', '24/7 helpline'],
    priceInr: 499,
    usdPrice: 6,
    checkinsPerWeek: 1,
    visitsPerWeek: 0,
  },
  {
    name: 'Standard',
    summary: 'Daily eyes on your parent, with a care manager.',
    features: [
      'Daily check-in call',
      '2 home visits a week',
      'Doctor and lab coordination',
      'Dedicated care manager',
      'Weekly wellness report',
    ],
    priceInr: 2499,
    usdPrice: 29,
    checkinsPerWeek: 7,
    visitsPerWeek: 2,
    recommended: true,
  },
  {
    name: 'Premium',
    summary: 'Hands-on help at home, every day.',
    features: [
      'Daily home visits',
      'Meal and medicine help',
      'Companionship',
      'Post-hospital support',
    ],
    priceInr: 9999,
    usdPrice: 119,
    checkinsPerWeek: 7,
    visitsPerWeek: 7,
  },
];

// Only fills an empty collection, so prices an admin has changed are never overwritten.
export async function ensurePlans() {
  if (await Plan.exists({})) return;
  await Plan.insertMany(DEFAULT_PLANS);
  console.log('Created the default plans');
}
