import mongoose from 'mongoose';

const employerCodeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    company: { type: String, required: true, trim: true },
    employeeCount: { type: Number, required: true, min: 10 },
    discountPct: { type: Number, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const discountForEmployees = (employeeCount) => (employeeCount >= 50 ? 20 : 10);

employerCodeSchema.methods.toPublic = function toPublic() {
  return {
    id: this.id,
    code: this.code,
    company: this.company,
    employeeCount: this.employeeCount,
    discountPct: this.discountPct,
    active: this.active,
  };
};

export const EmployerCode = mongoose.model('EmployerCode', employerCodeSchema);
