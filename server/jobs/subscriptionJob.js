import cron from 'node-cron';
import { Subscription } from '../models/Subscription.js';
import { billSubscription } from '../utils/billing.js';

// Ends trials that are over and renews plans that are due. A failed charge stays
// due, so the next run retries it.
export async function processDueSubscriptions(now = new Date()) {
  const due = await Subscription.find({
    status: { $in: ['trial', 'active'] },
    renewsAt: { $lte: now },
  });

  for (const subscription of due) {
    try {
      await billSubscription(subscription, { periodStart: subscription.renewsAt });
    } catch (err) {
      console.error(`Could not bill subscription ${subscription.id}:`, err);
    }
  }
}

export function startSubscriptionJob() {
  const run = () => processDueSubscriptions().catch((err) => console.error(err));
  cron.schedule('0 * * * *', run);
  run();
}
