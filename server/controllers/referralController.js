import { Referral, REFERRAL_CREDIT_INR } from '../models/Referral.js';

export async function getReferrals(req, res) {
  const referrals = await Referral.find({ referrerId: req.user.id })
    .populate('refereeId', 'name')
    .sort({ createdAt: -1 });

  res.json({
    referralCode: req.user.referralCode,
    credit: req.user.credit,
    creditPerReferral: REFERRAL_CREDIT_INR,
    referrals: referrals.map((referral) => ({
      id: referral.id,
      // First name only: the rest of a referred family's details stay private.
      name: referral.refereeId?.name.split(' ')[0] ?? 'A family',
      status: referral.status,
      date: referral.createdAt,
    })),
  });
}
