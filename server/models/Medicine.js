import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

// Dates and dose times are plain India-time text, so they never shift with a viewer's time zone.
const medicineSchema = new mongoose.Schema(
  {
    parentId: { type: ObjectId, ref: 'Parent', required: true, index: true },
    name: { type: String, required: true, trim: true },
    dose: { type: String, required: true, trim: true },
    times: [{ type: String, required: true }],
    startDate: { type: String, required: true },
    endDate: { type: String },
    stoppedAt: { type: Date },
    addedBy: { type: ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

medicineSchema.methods.isActiveOn = function isActiveOn(date) {
  return (
    !this.stoppedAt && this.startDate <= date && (!this.endDate || this.endDate >= date)
  );
};

export const Medicine = mongoose.model('Medicine', medicineSchema);
