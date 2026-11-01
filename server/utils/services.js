// What a family can book. `offeredAs` is the caregiver profile service that covers it,
// and null means any verified caregiver can do it.
export const SERVICE_CATALOG = {
  doctor_escort: {
    label: 'Doctor visit escort',
    priceInr: 699,
    usdPrice: 9,
    offeredAs: 'doctor_visit',
    medical: true,
  },
  lab_test: {
    label: 'Lab test escort',
    priceInr: 499,
    usdPrice: 6,
    offeredAs: 'lab_test',
    medical: true,
  },
  home_sample: {
    label: 'Home sample collection',
    priceInr: 399,
    usdPrice: 5,
    offeredAs: 'lab_test',
    medical: true,
  },
  companionship: {
    label: 'Companionship visit',
    priceInr: 399,
    usdPrice: 5,
    offeredAs: 'companionship',
    medical: false,
  },
  post_hospital: {
    label: 'Post-hospital support',
    priceInr: 899,
    usdPrice: 11,
    offeredAs: 'post_hospital',
    medical: false,
  },
  emergency_visit: {
    label: 'Emergency visit',
    priceInr: 999,
    usdPrice: 12,
    offeredAs: null,
    medical: false,
  },
};

export const SERVICE_TYPES = Object.keys(SERVICE_CATALOG);

const MEDICAL_COORDINATION = ['doctor_escort', 'lab_test', 'home_sample'];

// Taken from what each plan promises. Anything else is paid per visit.
const INCLUDED_BY_PLAN = {
  Basic: [],
  Standard: MEDICAL_COORDINATION,
  Premium: [...MEDICAL_COORDINATION, 'companionship', 'post_hospital'],
};

export const isIncludedInPlan = (planName, serviceType) =>
  (INCLUDED_BY_PLAN[planName] ?? []).includes(serviceType);

const CAREGIVER_SHARE = 0.8;

export const caregiverEarning = (serviceType) =>
  Math.round(SERVICE_CATALOG[serviceType].priceInr * CAREGIVER_SHARE);
