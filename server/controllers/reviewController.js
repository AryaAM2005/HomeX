import { Booking } from '../models/Booking.js';
import { CaregiverProfile } from '../models/CaregiverProfile.js';
import { Parent } from '../models/Parent.js';
import { Review } from '../models/Review.js';
import { ApiError } from '../utils/ApiError.js';
import { istMonth } from '../utils/time.js';

const FINISHED_STATUSES = ['COMPLETED', 'REPORT_SUBMITTED'];
const ALREADY_REVIEWED = 'You have already rated this';

async function checkCanReview(customerId, caregiverId, bookingId) {
  if (bookingId) {
    const booking = await Booking.findOne({ _id: bookingId, customerId, caregiverId });
    if (!booking) throw new ApiError(404, 'We could not find that booking');
    if (!FINISHED_STATUSES.includes(booking.status)) {
      throw new ApiError(409, 'You can rate a visit once it has finished');
    }
    return { bookingId };
  }

  const isRegularCaregiver = await Parent.exists({
    customerId,
    $or: [{ primaryCaregiverId: caregiverId }, { backupCaregiverId: caregiverId }],
  });
  if (!isRegularCaregiver) throw new ApiError(403, 'You can only rate your own caregivers');
  return { month: istMonth() };
}

export async function createReview(req, res) {
  const { caregiverId, bookingId, rating, comment } = req.body;
  const scope = await checkCanReview(req.user.id, caregiverId, bookingId);

  try {
    await Review.create({ customerId: req.user.id, caregiverId, rating, comment, ...scope });
  } catch (err) {
    if (err.code === 11000) throw new ApiError(409, ALREADY_REVIEWED);
    throw err;
  }

  // A running average, so ratings that came with no written review still count.
  await CaregiverProfile.updateOne(
    { userId: caregiverId },
    [
      {
        $set: {
          ratingAvg: {
            $divide: [
              { $add: [{ $multiply: ['$ratingAvg', '$ratingCount'] }, rating] },
              { $add: ['$ratingCount', 1] },
            ],
          },
          ratingCount: { $add: ['$ratingCount', 1] },
        },
      },
    ],
    { updatePipeline: true },
  );

  res.status(201).json({ review: { rating, comment } });
}

export async function listCaregiverReviews(caregiverId) {
  const reviews = await Review.find({ caregiverId })
    .sort({ createdAt: -1 })
    .limit(10)
    .populate('customerId', 'name');

  return reviews.map((review) => ({
    id: review.id,
    rating: review.rating,
    comment: review.comment ?? '',
    author: review.customerId?.name?.split(' ')[0] ?? 'A family',
    date: review.createdAt,
  }));
}
