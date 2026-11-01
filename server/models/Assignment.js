import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

// One caregiver's link to one parent, from the first request until it ends.
const assignmentSchema = new mongoose.Schema(
  {
    parentId: { type: ObjectId, ref: 'Parent', required: true },
    customerId: { type: ObjectId, ref: 'User', required: true },
    caregiverId: { type: ObjectId, ref: 'User', required: true, index: true },
    requestedBy: { type: ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['primary', 'backup'], required: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'cancelled', 'ended'],
      default: 'pending',
    },
    respondedAt: { type: Date },
  },
  { timestamps: true },
);

assignmentSchema.index({ parentId: 1, createdAt: -1 });

// A parent can have one open request of each type.
assignmentSchema.index(
  { parentId: 1, type: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } },
);

export const Assignment = mongoose.model('Assignment', assignmentSchema);
