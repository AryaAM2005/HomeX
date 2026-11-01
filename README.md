# HOMEX

**Care That Comes Home.** A subscription eldercare platform for working children and NRI families whose parents live alone. Built with React, Node.js, Express and MongoDB for an Engineering Design lab project.

All six build phases are done. See [Requirements](#requirements) for how each one is covered, and what is left.

## Run it

You need [Node.js](https://nodejs.org) (LTS).

1. Install everything. This also downloads a local MongoDB, about 780 MB, the first time.

   ```bash
   npm install
   ```

2. Create the server settings file.

   ```bash
   cp server/.env.example server/.env
   ```

3. Open `server/.env` and fill in `JWT_SECRET`, `ADMIN_PASSWORD`, `CARE_MANAGER_PASSWORD` and `SEED_PASSWORD`. To generate a value for `JWT_SECRET`:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

4. Start the database, API and website together.

   ```bash
   npm run dev
   ```

Then open http://localhost:5173. The API runs on http://localhost:5000.

The first page load can show a proxy error in the terminal while the API starts. It clears within a few seconds.

5. In a second terminal, while `npm run dev` is running, add the demo data. This is safe to run more than once.

   ```bash
   npm run seed
   ```

Check-ins are dated from the day you seed, so seed close to a demo. To start again, stop `npm run dev`, delete `server/.mongo-data`, then repeat steps 4 and 5.

### Using MongoDB Atlas

Put your `mongodb+srv://` connection string in `MONGODB_URI` in `server/.env`. `npm run dev` then skips the local database.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs the database, API and website together |
| `npm run seed` | Adds the full demo data. The database must be running |
| `npm run seed:deploy` | Adds the demo data to the deployed database, using `deploy.env` |
| `npm run wellness` | Builds this week's wellness reports now, for demos. The database must be running |
| `npm test` | Runs the API tests |
| `npm run lint` | Runs ESLint |
| `npm run build` | Builds the website for production |
| `npm start` | Runs the API in production |

## Accounts

| Role | How to get one | Lands on |
| --- | --- | --- |
| Customer | Sign up on the website | `/dashboard` |
| Caregiver | Sign up on the website | `/caregiver` |
| Care Manager | Created from `CARE_MANAGER_EMAIL` and `CARE_MANAGER_PASSWORD` in `server/.env` | `/care-manager` |
| Admin | Created from `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `server/.env` | `/admin` |

Staff accounts are created the first time the server starts. Changing the password in `.env` later does not change an existing account. Admins can add more care managers at `/admin/care-managers`.

### Demo logins

`npm run seed` adds these. Everyone below uses `SEED_PASSWORD` from `server/.env`, except the first care manager and the admin, who use their own passwords from that file.

| Who | Email | Good for showing |
| --- | --- | --- |
| Ravi Das, family | `family1@homex.test` | Two parents, Premium and Standard. Check-in charts, reports, a booking and credit |
| Priya Nair, NRI family | `family2@homex.test` | USD prices and a US time zone |
| Anil Sahu, family | `family3@homex.test` | The Basic plan, with weekly check-ins |
| Neha Patnaik, family | `family4@homex.test` | A free trial, and a parent with no plan |
| Sunita Behera, caregiver | `caregiver1@homex.test` | Today's visits, for Ravi's parents |
| Bijay Swain, caregiver | `caregiver5@homex.test` | A new booking request waiting |
| Other caregivers | `caregiver2@homex.test` to `caregiver10@homex.test` | Map search around Bhubaneswar |
| Manager, care manager | `manager@homex.test` | An open alert, on Ravi's family |
| Anjali Mishra, care manager | `manager2@homex.test` | The other two families |
| Admin | `admin@homex.test` | Totals, an open complaint, and an employer code, `DEMOCORP` |

## Plans and billing

Plans live in MongoDB. The three default plans are added the first time the server starts, and after that admins edit them at `/admin/plans`. Admins create employer codes at `/admin/employer-codes`.

- **Free trial:** a customer's first plan starts with 7 free days. Later plans are charged straight away.
- **Billing job:** every hour, `server/jobs/subscriptionJob.js` ends finished trials and renews plans that are due. To test without waiting 7 days, use **End trial and pay now** on the Billing page.
- **Plan changes:** a new plan starts immediately, and its price applies from the next billing date. There is no proration.
- **Cancelling:** no further charges are made. The plan's last date stays on the Billing page.
- **Referrals:** both families get Rs. 500 credit when the referred family makes its first payment, not when its trial starts. Credit is used automatically on the next payment.
- **Employer codes:** 10% off for 10+ employees, or 20% off for 50+. The discount applies to every charge on that plan.
- **Payments:** these are mocked. `server/utils/payments.js` is the one place to connect Razorpay.

## Choosing a caregiver

1. A family adds a parent with an address and map pin, and starts a plan.
2. They search near the parent's home, by map or list, and send a request to one caregiver.
3. The caregiver accepts or declines at `/caregiver/requests`. Health details and the exact address stay hidden until they accept, and the family sees the caregiver's phone number only after that.
4. Each family gets one care manager, chosen automatically as the one with the fewest families. Through the API, the care manager can assign a backup or change the primary caregiver straight away. The screens for this arrive in Phase 6.

A new caregiver appears in search only after they complete their profile, upload ID, police and training documents, and an admin approves them at `/admin/caregivers`. Changing a document afterwards sends them back for review.

## Daily care and alerts

- **Check-ins:** caregivers log these from `/caregiver`. A home visit needs GPS and a photo, and a phone call does not. Families see the latest check-in, a calendar and 30 days of vitals charts.
- **Medicines:** families and caregivers manage the schedule. Dose times and care days are always India time, wherever the viewer is.
- **Live updates:** open pages ask `GET /api/live` for anything new every 4 seconds, and pause while the tab is hidden. The server saves `alert:new`, `alert:updated`, `checkin:new` and notifications as `LiveEvent` rows for an hour, addressed to one user each, so nobody can read another person's events.
- **SOS:** the red button is on every logged-in page. Each parent also has a private page with one big button and no login. Set it up from My Parents. Repeated presses during one emergency stay as one alert.
- **Handling an alert:** the care manager acknowledges it, then resolves it with a note, at `/care-manager/alerts`. An SOS nobody acknowledges within 5 minutes goes to `/admin/alerts`. If a family has no care manager, it goes there straight away.

Alerts are also raised automatically:

| Alert | When |
| --- | --- |
| Abnormal vitals | A check-in has a reading outside the limits in `server/utils/vitals.js` |
| Missed medicine | A dose is marked missed, or stays unlogged 4 hours after it was due, on plans with daily check-ins |
| Missed check-in | Nothing is logged by 8 PM India time on daily plans, or within 7 days on the weekly plan |

`server/utils/scheduler.js` runs escalation checks every 30 seconds, and missed care and reminders every 15 minutes. Locally these run on a timer. On Vercel nothing runs between requests, so the checks happen when a page polls, when a parent is on their SOS page after pressing it, and once a day from Vercel's cron. See [Limits](#limits-of-the-free-plans).

The vitals limits are placeholders for the demo. Have a clinician review them before real use.

## Bookings and reports

A family books a service from My Parents, choosing any verified caregiver nearby who offers it. Their own caregiver is picked first.

| Service | Price | Included in |
| --- | --- | --- |
| Doctor visit escort | Rs. 699 / $9 | Standard, Premium |
| Lab test escort | Rs. 499 / $6 | Standard, Premium |
| Home sample collection | Rs. 399 / $5 | Standard, Premium |
| Companionship visit | Rs. 399 / $5 | Premium |
| Post-hospital support | Rs. 899 / $11 | Premium |
| Emergency visit | Rs. 999 / $12 | None |

Prices and the plan rules are in `server/utils/services.js`.

- **Payment:** a visit the plan doesn't cover is paid at the mock checkout when booking, and credit is used automatically. It is refunded in full, credit included, if the booking is declined, cancelled, or not answered before its time.
- **Status flow:** Requested, Accepted, Appointment fixed, In progress, Completed, Report submitted. Visits without a doctor or lab skip the appointment and report steps. A family can cancel before the visit starts.
- **Timing:** bookings need 1 hour of notice and must fall within the caregiver's working hours. Emergency visits are exempt from both.
- **Privacy:** the caregiver sees the address, health details and family contacts only after accepting, and the family sees the caregiver's phone only then too.
- **Care reports:** required after doctor and lab visits, with up to 5 attachments. Files are private to the family, the care team and the caregiver who filed them.
- **Weekly wellness reports:** `server/jobs/wellnessJob.js` checks hourly and builds one report per parent for the last full Monday to Sunday. To see one without waiting, run `npm run wellness` to build the current week so far.
- **WhatsApp sharing:** this sends the report's summary text through a `wa.me` link. There is no public report page.
- **Reviews:** a family can rate each finished booking once, and their primary caregiver once a month.
- **Earnings:** caregivers earn 80% of the list price of each finished booking, including visits covered by a plan. Pay for daily check-ins is not modelled.

## Care manager and admin

- **Care managers** see their families at `/care-manager`, and each parent's full history. They can change a primary or backup caregiver straight away, and handle alerts at `/care-manager/alerts`.
- **Admins** have totals at `/admin`, plus verification, users, care managers, plans, employer codes, bookings, complaints and escalated alerts.
- **Deactivating a user** ends their session at once and keeps their records. A care manager's families move to the others. If a caregiver is deactivated, their care managers are told to reassign.
- **Complaints** are raised by families on a booking, and resolved by an admin, whose answer the family sees.

## Privacy and your data

From Settings, anyone can download their data as a JSON file. Families and caregivers can also delete their account, which needs their password.

| When a family deletes their account | What happens |
| --- | --- |
| Account, parents, check-ins and photos, medicines, alerts, reports, plans, complaints, notifications | Deleted |
| Open bookings | Cancelled and refunded |
| Finished bookings | Kept for caregiver earnings, with notes and names removed |
| Reviews | Kept as anonymous ratings, with the comment removed |
| Payments | Kept for accounting |
| Consent record | Kept as evidence, marked as withdrawn |

A caregiver cannot delete their account while they have families or open bookings. Staff accounts are closed by an admin.

Have someone qualified check this against the DPDP Act before real use. The retention choices above are reasonable defaults, not legal advice.

## Uploaded files

Files are stored in MongoDB, because Vercel's disk does not last. ID, police and training documents can only be opened through a logged-in route, by that caregiver or an admin. Check-in photos follow the same rule as the parent's health records. Uploads must be a real PDF, JPG or PNG of 4 MB or less, and all the files in one report must fit in 4 MB together. The browser shrinks photos before sending them. `server/utils/storage.js` is the one place to connect Cloudinary.

## Password reset emails

If `SMTP_HOST` is empty, reset emails are printed in the `npm run dev` terminal instead of being sent. Copy the link from there. On Vercel they appear in the project's Logs tab.

## Placeholders to replace

- **Helpline number and support email:** `client/src/data/site.js`
- **USD plan prices:** the defaults are in `server/utils/ensurePlans.js`, and admins can change them at `/admin/plans`
- **Reviews on the home page:** sample text in `client/src/pages/Home.jsx`

## Project layout

```
api/                    Vercel entry point
client/                 React + Vite + Tailwind
  src/api/              Axios instance and live updates
  src/components/       Shared UI
  src/context/          Current user, login and logout
  src/data/             Site details
  src/hooks/            Data loading, form and page title helpers
  src/pages/            One folder per role, plus the public pages
  src/utils/            Formatting and validation
server/                 Node + Express
  controllers/          Request handlers
  jobs/                 Scheduled tasks
  middleware/           Auth, roles, validation, rate limits, errors
  models/               Mongoose schemas
  routes/               API routes
  scripts/              Local development database
  tests/                API and live event tests
  utils/                Env config, sessions, mail, pricing, billing, storage, scheduler, validation schemas
  seed.js               Demo caregivers
```

## How sessions work

Login sets a 7-day JWT in an httpOnly cookie. Each token carries the user's `tokenVersion`, which goes up on logout and password reset. This means logging out cancels the token on the server, and it also signs that user out on their other devices.

## Requirements

`npm test` runs 219 API and live event tests. Test names carry their requirement ID, like `FR-22 SOS`, so you can map them to test cases in a lab report.

| Requirements | Module | How it is checked |
| --- | --- | --- |
| FR-1 to FR-5 | Accounts and login | API tests, browser |
| FR-6 | Home page | Browser and accessibility scan |
| FR-7 to FR-11 | Plans, subscriptions, referral and employer codes | API tests, browser |
| FR-12 to FR-18 | Parents, caregivers, verification, map, assignment | API tests, browser |
| FR-19 to FR-24 | Check-ins, medicines, SOS and alerts | API and live event tests, browser |
| FR-25 to FR-28 | Bookings, care reports, wellness reports | API tests, browser |
| FR-29 to FR-33 | Reviews, payments, panels, privacy | API tests, browser |

Measured on a development laptop:

- **NFR-5:** an SOS reached a care manager's open page in about 1.3 seconds, raised on one server and read on another. A page polls every 4 seconds, so that is the usual worst case.
- **NFR-6:** the nearby search took about 25 ms with 10,000 caregivers.
- **NFR-8:** an axe WCAG 2.1 AA scan found no violations across 13 main pages. Automated scans only catch part of WCAG, so this does not replace testing with real assistive technology.

Not done:

- **NFR-9, Hindi and Odia:** the interface is English only, and its text is not yet set up for translation.
- **Real services:** payments are mocked, and the helpline number and support email are placeholders.
- **Outside the lab build, by design:** IVR calls, the WhatsApp Business API, IoT sensors, AI alerts, insurance and native apps.

## Deploying

Everything runs free, on Vercel's Hobby plan and a MongoDB Atlas M0 cluster. There is no separate backend: `api/index.js` runs the Express app as one Vercel Function, and the site calls it on the same domain, so the login cookie stays first-party.

1. **MongoDB Atlas:** create a free M0 cluster in Mumbai, to sit beside Vercel's `bom1` region. Add a database user. Under Network Access, allow `0.0.0.0/0`, because Vercel has no fixed address on the free plan. Copy the connection string, and add `/homex` before the `?`.
2. **Settings:** copy `deploy.env.example` to `deploy.env`, which git ignores, and fill it in.
3. **Demo data:** run `npm run seed:deploy`. This also creates the staff accounts and plans.
4. **Vercel:** import this repo. `vercel.json` sets the build. Under Environment Variables, paste the contents of `deploy.env`, then deploy.

### Limits of the free plans

- **No commercial use.** Vercel's Hobby plan is for personal, non-commercial projects. A demo is fine. A service charging real families needs a paid plan.
- **SOS escalation needs someone online.** An unanswered SOS reaches admins only when a page is open somewhere, or the parent stays on their SOS page, or at the daily cron at 9:30 PM India time. The alert itself still reaches open pages straight away. Do not rely on this for real emergencies.
- **Reminders and billing wait for visitors too.** They are safe to run late, and catch up on the next visit.
- **Monthly usage:** Vercel allows 1 million requests and 4 CPU hours. One open page uses 900 requests an hour, so that is about 1,100 page-hours a month. Over the limit, the site is paused rather than charged.
- **Storage:** Atlas M0 holds 512 MB, including every uploaded file.
- **Email:** with no SMTP settings, password reset links only appear in Vercel's Logs tab, which keeps them for an hour.
- **Slow first visit:** after a quiet spell, the first request takes a few seconds while the function starts.
