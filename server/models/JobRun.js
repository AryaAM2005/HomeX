import mongoose from 'mongoose';

// One row per scheduled job, so servers that come and go agree on when it last ran.
const jobRunSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  nextRunAt: { type: Date, required: true },
});

export const JobRun = mongoose.model('JobRun', jobRunSchema);
