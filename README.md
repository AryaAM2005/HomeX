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

Check-ins are dated from the day you seed, so seed close to a demo. To start again, stop `npm run dev`, delete `server/.mongo-data` and `server/uploads`, then repeat steps 4 and 5.

### Using MongoDB Atlas

Put your `mongodb+srv://` connection string in `MONGODB_URI` in `server/.env`. `npm run dev` then skips the local database.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs the database, API and website together |
| `npm run seed` | Adds the full demo data. The database must be running |
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
- **Billing job:** every hour, and when the server starts, `server/jobs/subscriptionJob.js` ends finished trials and renews plans that are due. To test without waiting 7 days, use **End trial and pay now** on the Billing page.
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
- **Live updates:** Socket.IO sends `alert:new`, `alert:updated`, `checkin:new` and notifications. Clients only listen, and logging out closes the connection.
- **SOS:** the red button is on every logged-in page. Each parent also has a private page with one big button and no login. Set it up from My Parents. Repeated presses during one emergency stay as one alert.
- **Handling an alert:** the care manager acknowledges it, then resolves it with a note, at `/care-manager/alerts`. An SOS nobody acknowledges within 5 minutes goes to `/admin/alerts`. If a family has no care manager, it goes there straight away.

Alerts are also raised automatically:

| Alert | When |
| --- | --- |
| Abnormal vitals | A check-in has a reading outside the limits in `server/utils/vitals.js` |
| Missed medicine | A dose is marked missed, or stays unlogged 4 hours after it was due, on plans with daily check-ins |
| Missed check-in | Nothing is logged by 8 PM India time on daily plans, or within 7 days on the weekly plan |

`server/jobs/careJob.js` checks for escalations every 30 seconds, and for missed care and reminders every 15 minutes.

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

Files are stored in `server/uploads`, which is not a public folder. ID, police and training documents can only be opened through a logged-in route, by that caregiver or an admin. Check-in photos follow the same rule as the parent's health records. Uploads must be a real PDF, JPG or PNG of 5 MB or less. `server/utils/storage.js` is the one place to connect Cloudinary.

Render's free tier does not keep local files between deploys, so move to Cloudinary before relying on uploads in a deployed demo.

## Password reset emails

If `SMTP_HOST` is empty, reset emails are printed in the `npm run dev` terminal instead of being sent. Copy the link from there.

## Placeholders to replace

- **Helpline number and support email:** `client/src/data/site.js`
- **USD plan prices:** the defaults are in `server/utils/ensurePlans.js`, and admins can change them at `/admin/plans`
- **Reviews on the home page:** sample text in `client/src/pages/Home.jsx`

## Project layout

```
client/                 React + Vite + Tailwind
  src/api/              Axios instance and Socket.IO connection
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
  sockets/              Socket.IO login and rooms
  tests/                API and live event tests
  uploads/              Uploaded files (private, not in git)
  utils/                Env config, sessions, mail, pricing, billing, storage, validation schemas
  seed.js               Demo caregivers
```

## How sessions work

Login sets a 7-day JWT in an httpOnly cookie. Each token carries the user's `tokenVersion`, which goes up on logout and password reset. This means logging out cancels the token on the server, and it also signs that user out on their other devices.

## Requirements

`npm test` runs 209 API and live event tests. Test names carry their requirement ID, like `FR-22 SOS`, so you can map them to test cases in a lab report.

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

- **NFR-5:** an SOS reached a care manager's open page about 10 ms after the request finished, on one machine.
- **NFR-6:** the nearby search took about 25 ms with 10,000 caregivers.
- **NFR-8:** an axe WCAG 2.1 AA scan found no violations across 13 main pages. Automated scans only catch part of WCAG, so this does not replace testing with real assistive technology.

Not done:

- **NFR-9, Hindi and Odia:** the interface is English only, and its text is not yet set up for translation.
- **Real services:** payments are mocked, and the helpline number and support email are placeholders.
- **Outside the lab build, by design:** IVR calls, the WhatsApp Business API, IoT sensors, AI alerts, insurance and native apps.

## Deploying

The website runs on Vercel, the backend on Render and the database on MongoDB Atlas, all on free tiers.

The backend needs a server that stays running, for live alerts, the 30-second SOS escalation check and uploaded files. Vercel's free plan cannot do this: its scheduled jobs run once a day at most.

1. **MongoDB Atlas:** create a free cluster and a database user. Under Network Access, allow `0.0.0.0/0`, because Render's free tier has no fixed address. Copy the connection string.
2. **Render:** choose New, then Blueprint, and pick this repo. `render.yaml` sets everything up. Paste the Atlas connection string into `MONGODB_URI`, and your Vercel address into `CLIENT_URL`. If you don't have it yet, use a placeholder and update it after step 4.
3. **`vercel.json`:** if your Render address is not `homex-api.onrender.com`, change both rewrite destinations to match, and push.
4. **Vercel:** import this repo with no changes. `vercel.json` sets the build. Add no environment variables.

Vercel forwards `/api` and `/socket.io` to Render, so the browser only ever talks to one domain. That keeps the login cookie first-party, which Safari requires.

Render generates the passwords. Find them under Environment on the Render service. `SEED_ON_START` loads the demo data, so remove it before real use.

Limits of the free tiers:

- **Render sleeps after about 15 minutes idle.** The next visit takes about a minute to wake it, and scheduled jobs stop while it sleeps, including SOS escalation. Open the site a few minutes before a demo. For real use, move to a paid Render plan, which stays awake.
- **Uploaded files disappear when Render redeploys or restarts.** That covers caregiver documents, check-in photos and report attachments. Connect Cloudinary in `server/utils/storage.js` before real use.
- **Email:** with no SMTP settings, password reset links only appear in the Render logs.
