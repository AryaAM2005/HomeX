import mongoose from 'mongoose';

const measure = { _id: false, avg: Number, min: Number, max: Number, change: Number };

const wellnessReportSchema = new mongoose.Schema(
  {
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Parent', required: true },
    // Monday and Sunday of the report's week, in India time.
    weekStart: { type: String, required: true },
    weekEnd: { type: String, required: true },
    summary: { type: String, required: true },
    vitalsTrend: {
      bpSystolic: measure,
      bpDiastolic: measure,
      sugar: measure,
      temperature: measure,
      pulse: measure,
    },
    adherencePct: { type: Number },
    checkinCount: { type: Number, required: true },
    expectedCheckins: { type: Number, required: true },
    alertCount: { type: Number, required: true },
  },
  { timestamps: true },
);

wellnessReportSchema.index({ parentId: 1, weekStart: -1 }, { unique: true });

export const WellnessReport = mongoose.model('WellnessReport', wellnessReportSchema);
