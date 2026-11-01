import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ['customer', 'caregiver', 'careManager', 'admin'],
      default: 'customer',
    },
    country: { type: String, default: 'IN' },
    timezone: { type: String, default: 'Asia/Kolkata' },
    referralCode: { type: String, unique: true, sparse: true },
    credit: { type: Number, default: 0 },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    avatar: { type: String },
    // Bumped on logout and password reset; any JWT carrying an older value stops working.
    tokenVersion: { type: Number, default: 0 },
    resetTokenHash: { type: String, select: false },
    resetTokenExpires: { type: Date, select: false },
  },
  { timestamps: true },
);

userSchema.methods.toPublic = function toPublic() {
  return {
    id: this.id,
    name: this.name,
    email: this.email,
    phone: this.phone,
    role: this.role,
    country: this.country,
    timezone: this.timezone,
    referralCode: this.referralCode ?? null,
    credit: this.credit,
    isVerified: this.isVerified,
    avatar: this.avatar ?? null,
    createdAt: this.createdAt,
  };
};

export const User = mongoose.model('User', userSchema);
