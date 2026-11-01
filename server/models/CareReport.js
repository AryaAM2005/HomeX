import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const careReportSchema = new mongoose.Schema(
  {
    bookingId: { type: ObjectId, ref: 'Booking', required: true, unique: true },
    parentId: { type: ObjectId, ref: 'Parent', required: true, index: true },
    caregiverId: { type: ObjectId, ref: 'User', required: true },
    doctorName: { type: String, required: true, trim: true },
    hospital: { type: String, trim: true },
    diagnosisSummary: { type: String, required: true, trim: true },
    vitals: {
      bpSystolic: Number,
      bpDiastolic: Number,
      sugar: Number,
      temperature: Number,
      pulse: Number,
    },
    prescriptions: { type: String, trim: true },
    nextFollowUp: { type: String },
    notes: { type: String, trim: true },
    attachments: [
      {
        name: { type: String, required: true },
        file: { type: String, required: true },
        mime: { type: String, required: true },
      },
    ],
  },
  { timestamps: true },
);

export const CareReport = mongoose.model('CareReport', careReportSchema);
