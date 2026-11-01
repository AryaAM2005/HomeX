// Builds a complete demo: 2 care managers, 4 families (1 NRI), 6 parents, 10 verified
// caregivers around Bhubaneswar, 2 weeks of check-ins, medicines and one open alert.
// Safe to run again: anything already there is left alone.
import bcrypt from 'bcrypt';
import { Assignment } from '../models/Assignment.js';
import { Booking } from '../models/Booking.js';
import { CaregiverProfile } from '../models/CaregiverProfile.js';
import { CareReport } from '../models/CareReport.js';
import { CheckIn } from '../models/CheckIn.js';
import { Complaint } from '../models/Complaint.js';
import { ConsentLog } from '../models/ConsentLog.js';
import { EmployerCode } from '../models/EmployerCode.js';
import { Medicine } from '../models/Medicine.js';
import { Parent } from '../models/Parent.js';
import { Payment } from '../models/Payment.js';
import { Plan } from '../models/Plan.js';
import { toPoint } from '../models/point.js';
import { Referral } from '../models/Referral.js';
import { Review } from '../models/Review.js';
import { Subscription } from '../models/Subscription.js';
import { User } from '../models/User.js';
import { raiseAlert } from './alerts.js';
import { env } from './env.js';
import { ensurePlans } from './ensurePlans.js';
import { ensureStaff } from './ensureStaff.js';
import { caregiverEarning } from './services.js';
import { addDays, addIstMinutes, istDate, istMonth, mondayOf } from './time.js';
import { createWellnessReport } from './wellness.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const CHECK_IN_DAYS = 14;

const WEEKDAY_HOURS = ['mon', 'tue', 'wed', 'thu', 'fri'].map((day) => ({
  day,
  start: '09:00',
  end: '18:00',
}));
const SIX_DAY_HOURS = [...WEEKDAY_HOURS, { day: 'sat', start: '09:00', end: '14:00' }];
const ALL_WEEK_HOURS = [...SIX_DAY_HOURS, { day: 'sun', start: '10:00', end: '14:00' }];

const CAREGIVERS = [
  ['Sunita Behera', 'Saheed Nagar', 20.288, 85.844, 12, 4.9, 38, ['daily_checkin', 'doctor_visit', 'meals_medicines'], ['Odia', 'Hindi', 'English'], ALL_WEEK_HOURS],
  ['Pranati Sahoo', 'Patia', 20.3545, 85.818, 7, 4.7, 21, ['daily_checkin', 'companionship', 'post_hospital'], ['Odia', 'Hindi'], SIX_DAY_HOURS],
  ['Manoj Mohanty', 'Nayapalli', 20.296, 85.817, 9, 4.6, 27, ['doctor_visit', 'lab_test', 'post_hospital'], ['Odia', 'English'], WEEKDAY_HOURS],
  ['Rashmita Nayak', 'Khandagiri', 20.258, 85.78, 5, 4.4, 14, ['daily_checkin', 'meals_medicines', 'companionship'], ['Odia', 'Hindi'], SIX_DAY_HOURS],
  ['Bijay Swain', 'Jaydev Vihar', 20.298, 85.826, 11, 4.8, 33, ['doctor_visit', 'lab_test', 'daily_checkin'], ['Odia', 'Hindi', 'English'], ALL_WEEK_HOURS],
  ['Sasmita Das', 'Old Town', 20.238, 85.835, 6, 4.5, 18, ['meals_medicines', 'companionship', 'daily_checkin'], ['Odia', 'Bengali'], WEEKDAY_HOURS],
  ['Lipsa Pradhan', 'Chandrasekharpur', 20.326, 85.818, 4, 4.3, 9, ['daily_checkin', 'lab_test'], ['Odia', 'English', 'Hindi'], SIX_DAY_HOURS],
  ['Ramesh Rout', 'Unit 4', 20.273, 85.838, 15, 4.9, 41, ['post_hospital', 'doctor_visit', 'meals_medicines'], ['Odia', 'Hindi'], ALL_WEEK_HOURS],
  ['Madhusmita Jena', 'Rasulgarh', 20.29, 85.865, 8, 4.6, 24, ['daily_checkin', 'companionship', 'meals_medicines'], ['Odia', 'Telugu'], SIX_DAY_HOURS],
  ['Ajit Panda', 'Baramunda', 20.281, 85.798, 3, 4.2, 7, ['lab_test', 'daily_checkin', 'doctor_visit'], ['Odia', 'Hindi'], WEEKDAY_HOURS],
];

const FAMILIES = [
  {
    name: 'Ravi Das',
    number: 1,
    phone: '9000002001',
    parents: [
      {
        name: 'Lakshmi Das',
        age: 74,
        address: '12 Saheed Nagar, Bhubaneswar',
        lat: 20.2875,
        lng: 85.8452,
        conditions: ['Diabetes', 'High blood pressure'],
        allergies: ['Penicillin'],
        plan: 'Premium',
        primary: 1,
        backup: 8,
        medicines: [
          { name: 'Metformin', dose: '500 mg after food', times: ['08:00', '20:00'] },
          { name: 'Amlodipine', dose: '5 mg', times: ['09:00'] },
        ],
      },
      {
        name: 'Gopal Das',
        age: 78,
        address: '12 Saheed Nagar, Bhubaneswar',
        lat: 20.2875,
        lng: 85.8452,
        conditions: ['Arthritis'],
        allergies: [],
        plan: 'Standard',
        primary: 1,
        medicines: [{ name: 'Calcium', dose: '1 tablet', times: ['13:00'] }],
      },
    ],
  },
  {
    name: 'Priya Nair',
    number: 2,
    phone: '+14155550142',
    country: 'US',
    timezone: 'America/New_York',
    currency: 'USD',
    parents: [
      {
        name: 'Meena Iyer',
        age: 71,
        address: '7 Jaydev Vihar, Bhubaneswar',
        lat: 20.2995,
        lng: 85.8251,
        conditions: ['Thyroid'],
        allergies: [],
        plan: 'Standard',
        primary: 5,
        medicines: [{ name: 'Levothyroxine', dose: '50 mcg before food', times: ['07:30'] }],
      },
    ],
  },
  {
    name: 'Anil Sahu',
    number: 3,
    phone: '9000002003',
    parents: [
      {
        name: 'Sarojini Sahu',
        age: 69,
        address: '21 Nayapalli, Bhubaneswar',
        lat: 20.2965,
        lng: 85.8162,
        conditions: [],
        allergies: [],
        plan: 'Basic',
        primary: 3,
        medicines: [],
      },
    ],
  },
  {
    name: 'Neha Patnaik',
    number: 4,
    phone: '9000002004',
    parents: [
      {
        name: 'Bimala Patnaik',
        age: 76,
        address: '3 Rasulgarh, Bhubaneswar',
        lat: 20.2905,
        lng: 85.8642,
        conditions: ['Heart condition'],
        allergies: ['Sulfa drugs'],
        plan: 'Standard',
        trial: true,
        primary: 9,
        medicines: [{ name: 'Aspirin', dose: '75 mg', times: ['10:00'] }],
      },
      {
        name: 'Harihar Patnaik',
        age: 80,
        address: '3 Rasulgarh, Bhubaneswar',
        lat: 20.2905,
        lng: 85.8642,
        conditions: [],
        allergies: [],
        medicines: [],
      },
    ],
  },
];

const FIRST_REVIEWS = [
  [1, 5, 'Always on time, and my mother trusts her completely.'],
  [1, 5, 'Calls me straight after every doctor visit.'],
  [8, 5, 'Helped my father recover after his surgery.'],
  [5, 4, 'Reliable and very organised with appointments.'],
];

async function seedCaregivers(passwordHash) {
  const caregivers = new Map();

  for (const [index, caregiver] of CAREGIVERS.entries()) {
    const [name, area, lat, lng, experienceYears, ratingAvg, ratingCount, services, languages, availability] =
      caregiver;
    const number = index + 1;
    const email = `caregiver${number}@homex.test`;

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        name,
        email,
        phone: `90000010${String(number).padStart(2, '0')}`,
        passwordHash,
        role: 'caregiver',
        isVerified: true,
      });

      await CaregiverProfile.create({
        userId: user.id,
        bio: `${name.split(' ')[0]} has cared for elders in and around ${area} for ${experienceYears} years.`,
        services,
        experienceYears,
        languages,
        certificates: ['Basic elder care', 'First aid'],
        area,
        location: toPoint({ lat, lng }),
        serviceRadiusKm: 12,
        availability,
        policeVerified: true,
        verificationStatus: 'approved',
        submittedAt: new Date(),
        ratingAvg,
        ratingCount,
      });
    }
    caregivers.set(number, user);
  }
  return caregivers;
}

async function seedSecondManager(passwordHash) {
  const email = 'manager2@homex.test';
  const existing = await User.findOne({ email });
  if (existing) return existing;

  return User.create({
    name: 'Anjali Mishra',
    email,
    phone: '9000000002',
    passwordHash,
    role: 'careManager',
    isVerified: true,
  });
}

// Readings drift gently, with some randomness, so the charts look like a real fortnight.
function buildVitals(day, seed) {
  const wave = Math.sin(day / 2 + seed);
  const jitter = () => Math.round((Math.random() - 0.5) * 4);

  return {
    bpSystolic: 128 + Math.round(wave * 8) + jitter(),
    bpDiastolic: 80 + Math.round(wave * 5) + jitter(),
    sugar: 122 + Math.round(wave * 16) + jitter(),
    pulse: 76 + Math.round(wave * 4) + jitter(),
    temperature: Math.round((98.3 + wave * 0.3) * 10) / 10,
  };
}

function checkInTime(daysAgo, now) {
  const date = istDate(new Date(now.getTime() - daysAgo * DAY_MS));
  const usual = addIstMinutes(date, '10:30', 0);
  // Today's visit cannot be in the future if the seed runs early in the day.
  return { date, time: usual > now ? new Date(now.getTime() - 60 * 60 * 1000) : usual };
}

async function seedCheckIns(parent, medicines, caregiverId, plan, seed) {
  const now = new Date();
  const everyDay = plan.checkinsPerWeek >= 7;
  const rows = [];

  for (let daysAgo = CHECK_IN_DAYS; daysAgo >= 0; daysAgo -= 1) {
    // A gap in the calendar makes a missed day visible in the demo.
    if (everyDay ? daysAgo === 5 : daysAgo % 7 !== 0) continue;

    const { date, time } = checkInTime(daysAgo, now);
    const isVisit = plan.visitsPerWeek >= 7 || (plan.visitsPerWeek > 0 && daysAgo % 3 === 0);

    rows.push({
      parentId: parent.id,
      caregiverId,
      type: isVisit ? 'visit' : 'call',
      time,
      date,
      location: isVisit ? parent.location : undefined,
      distanceFromHomeM: isVisit ? 40 : undefined,
      mood: daysAgo % 6 === 0 ? 'okay' : daysAgo % 4 === 0 ? 'great' : 'good',
      vitals: buildVitals(daysAgo, seed),
      medicinesGiven: medicines.flatMap(({ id, name, times }) =>
        times.map((doseTime) => ({
          medicineId: id,
          name,
          time: doseTime,
          status: daysAgo === 3 ? 'missed' : 'given',
        })),
      ),
      notes: daysAgo === 0 ? 'Ate well and went for a short walk.' : '',
    });
  }
  await CheckIn.insertMany(rows);
}

async function seedParent(family, customer, details, { caregivers, manager, plans, pastDate }) {
  const plan = plans.get(details.plan);
  const { lat, lng, plan: planName, primary, backup, medicines, trial, ...profile } = details;

  const parent = await Parent.create({
    ...profile,
    customerId: customer.id,
    careManagerId: manager.id,
    location: toPoint({ lat, lng }),
    emergencyContact: { name: family.name, phone: family.phone, relation: 'Child' },
    primaryCaregiverId: primary && caregivers.get(primary).id,
    backupCaregiverId: backup && caregivers.get(backup).id,
  });

  const savedMedicines = await Medicine.insertMany(
    medicines.map((medicine) => ({
      ...medicine,
      parentId: parent.id,
      startDate: istDate(new Date(Date.now() - 30 * DAY_MS)),
      addedBy: customer.id,
    })),
  );

  if (!planName) return { parent };

  const currency = family.currency ?? 'INR';
  const subscription = await Subscription.create({
    customerId: customer.id,
    parentId: parent.id,
    planId: plan.id,
    billingCycle: 'monthly',
    currency,
    status: trial ? 'trial' : 'active',
    trialEndsAt: trial ? new Date(Date.now() + 3 * DAY_MS) : undefined,
    renewsAt: new Date(Date.now() + (trial ? 3 : 12) * DAY_MS),
    createdAt: trial ? new Date(Date.now() - 4 * DAY_MS) : pastDate,
  });

  if (!trial) {
    await Payment.create({
      customerId: customer.id,
      subscriptionId: subscription.id,
      description: `${plan.name} plan, monthly`,
      amount: currency === 'USD' ? plan.usdPrice : plan.priceInr,
      currency,
      provider: 'mock',
      reference: `mock_seed_${subscription.id}`,
      createdAt: new Date(Date.now() - 18 * DAY_MS),
    });
  }

  await Assignment.create({
    parentId: parent.id,
    customerId: customer.id,
    caregiverId: caregivers.get(primary).id,
    requestedBy: customer.id,
    type: 'primary',
    status: 'accepted',
    respondedAt: pastDate,
  });

  await seedCheckIns(
    parent,
    savedMedicines,
    caregivers.get(primary).id,
    plan,
    parent.name.length,
  );

  return { parent, plan };
}

async function seedFinishedVisit(customer, parent, caregiver) {
  const when = new Date(Date.now() - 6 * DAY_MS);
  const entry = (status, by, note) => ({ status, by, note, at: when });

  const booking = await Booking.create({
    customerId: customer.id,
    parentId: parent.id,
    caregiverId: caregiver.id,
    serviceType: 'doctor_escort',
    scheduledAt: when,
    appointmentDetails: 'Dr A Mohanty, City Clinic, 11:30 am',
    status: 'REPORT_SUBMITTED',
    statusHistory: [
      entry('REQUESTED', customer.name),
      entry('ACCEPTED', caregiver.name),
      entry('APPOINTMENT_FIXED', caregiver.name, 'Dr A Mohanty, City Clinic, 11:30 am'),
      entry('IN_PROGRESS', caregiver.name),
      entry('COMPLETED', caregiver.name),
      entry('REPORT_SUBMITTED', caregiver.name),
    ],
    currency: 'INR',
    price: 699,
    paymentStatus: 'included',
    caregiverEarningInr: caregiverEarning('doctor_escort'),
  });

  await CareReport.create({
    bookingId: booking.id,
    parentId: parent.id,
    caregiverId: caregiver.id,
    doctorName: 'Dr A Mohanty',
    hospital: 'City Clinic',
    diagnosisSummary: 'Blood pressure is steady. Continue the current medicines and walk daily.',
    vitals: { bpSystolic: 132, bpDiastolic: 84, pulse: 76 },
    prescriptions: 'Amlodipine 5 mg daily, Metformin 500 mg twice a day',
    nextFollowUp: addDays(istDate(), 24),
  });
  return booking;
}

async function seedUpcomingBookings(customer, parent, caregiver) {
  const when = addIstMinutes(addDays(mondayOf(istDate()), 7), '11:00', 0);

  await Booking.create({
    customerId: customer.id,
    parentId: parent.id,
    caregiverId: caregiver.id,
    serviceType: 'lab_test',
    scheduledAt: when,
    notes: 'Fasting blood test, please go early.',
    status: 'REQUESTED',
    statusHistory: [{ status: 'REQUESTED', by: customer.name, at: new Date() }],
    currency: 'USD',
    price: 6,
    paymentStatus: 'included',
    caregiverEarningInr: caregiverEarning('lab_test'),
  });
}

async function seedFamilies(caregivers, managers, passwordHash) {
  const plans = new Map((await Plan.find()).map((plan) => [plan.name, plan]));
  const pastDate = new Date(Date.now() - 45 * DAY_MS);
  const covered = [];
  const customers = new Map();

  for (const family of FAMILIES) {
    const email = `family${family.number}@homex.test`;
    if (await User.exists({ email })) continue;

    const customer = await User.create({
      name: family.name,
      email,
      phone: family.phone,
      passwordHash,
      role: 'customer',
      country: family.country ?? 'IN',
      timezone: family.timezone ?? 'Asia/Kolkata',
      referralCode: `HXDEMO00${family.number}`,
    });
    customers.set(family.number, customer);

    await ConsentLog.create({
      userId: customer.id,
      purpose: 'account_and_care_data',
      policyVersion: '2026-11',
    });

    // Ravi's family goes to the first manager, so the open alert is there to demo.
    const manager = managers[(family.number - 1) % managers.length];
    for (const details of family.parents) {
      const seeded = await seedParent(family, customer, details, {
        caregivers,
        manager,
        plans,
        pastDate,
      });
      if (seeded.plan) covered.push(seeded);
    }
  }

  return { customers, covered };
}

async function seedStories({ customers, covered }, caregivers) {
  const ravi = customers.get(1);
  if (!ravi) return;

  const lakshmi = covered.find(({ parent }) => parent.name === 'Lakshmi Das').parent;
  const meena = covered.find(({ parent }) => parent.name === 'Meena Iyer').parent;
  const visit = await seedFinishedVisit(ravi, lakshmi, caregivers.get(1));

  await seedUpcomingBookings(customers.get(2), meena, caregivers.get(5));

  await Complaint.create({
    customerId: ravi.id,
    bookingId: visit.id,
    message: 'The caregiver arrived 30 minutes late for the appointment.',
  });

  await Promise.all(
    FIRST_REVIEWS.map(([caregiver, rating, comment], index) =>
      Review.create({
        customerId: customers.get(index + 1)?.id ?? ravi.id,
        caregiverId: caregivers.get(caregiver).id,
        bookingId: index === 0 ? visit.id : undefined,
        month: index === 0 ? undefined : istMonth(new Date(Date.now() - index * 31 * DAY_MS)),
        rating,
        comment,
      }),
    ),
  );

  await Referral.create({
    referrerId: ravi.id,
    refereeId: customers.get(4).id,
    code: ravi.referralCode,
    status: 'credited',
    creditedAt: new Date(Date.now() - 20 * DAY_MS),
  });
  await User.updateMany(
    { _id: { $in: [ravi.id, customers.get(4).id] } },
    { $inc: { credit: 500 } },
  );

  const lastMonday = addDays(mondayOf(istDate()), -7);
  for (const { parent, plan } of covered) {
    for (const weekStart of [addDays(lastMonday, -7), lastMonday]) {
      await createWellnessReport({ parent, plan, weekStart, replace: true });
    }
  }

  // The one open alert, raised last so it does not count towards earlier weeks.
  await raiseAlert({
    parent: lakshmi,
    type: 'abnormal_vitals',
    message: 'Systolic BP 168 mmHg',
    raisedBy: caregivers.get(1).id,
    raisedVia: 'caregiver',
    dedupeKey: 'seed:abnormal_vitals',
  });
}

export async function seedDemoData() {
  if (!env.SEED_PASSWORD) throw new Error('Set SEED_PASSWORD to load the demo data');

  await Promise.all([Parent.init(), Subscription.init(), User.init()]);
  await ensureStaff();
  await ensurePlans();

  const passwordHash = await bcrypt.hash(env.SEED_PASSWORD, 12);
  const caregivers = await seedCaregivers(passwordHash);
  const firstManager = await User.findOne({
    role: 'careManager',
    email: { $ne: 'manager2@homex.test' },
  });
  const secondManager = await seedSecondManager(passwordHash);
  const managers = [firstManager, secondManager].filter(Boolean);

  const seeded = await seedFamilies(caregivers, managers, passwordHash);
  await seedStories(seeded, caregivers);

  if (!(await EmployerCode.exists({ code: 'DEMOCORP' }))) {
    await EmployerCode.create({
      code: 'DEMOCORP',
      company: 'Demo Corp',
      employeeCount: 60,
      discountPct: 20,
    });
  }

  return (
    `Demo data ready: ${await User.countDocuments({ role: 'customer' })} families, ` +
    `${await Parent.countDocuments()} parents, ` +
    `${await CaregiverProfile.countDocuments({ verificationStatus: 'approved' })} verified caregivers, ` +
    `${await CheckIn.countDocuments()} check-ins, ` +
    `${await Medicine.countDocuments()} medicines.`
  );
}
