import { Plan } from '../models/Plan.js';

export async function listPlans(req, res) {
  const plans = await Plan.find({ active: true }).sort({ priceInr: 1 });
  res.json({ plans: plans.map((plan) => plan.toPublic()) });
}
