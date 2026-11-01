import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

// A review belongs to one finished booking, or to one month with a regular caregiver.
const reviewSchema = new mongoose.Schema(
  {
    // Cleared if the family deletes their account, leaving an anonymous rating.
    customerId: { type: ObjectId, ref: 'User' },
    caregiverId: { type: ObjectId, ref: 'User', required: true, index: true },
    bookingId: { type: ObjectId, ref: 'Booking' },
    month: { type: String },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true },
  },
  { timestamps: true },
);

reviewSchema.index({ bookingId: 1 }, { unique: true, sparse: true });
reviewSchema.index(
  { customerId: 1, caregiverId: 1, month: 1 },
  { unique: true, partialFilterExpression: { month: { $exists: true } } },
);

export const Review = mongoose.model('Review', reviewSchema);
