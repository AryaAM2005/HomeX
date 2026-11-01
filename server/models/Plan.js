import mongoose from 'mongoose';
import { planPrices } from '../utils/pricing.js';

const planSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    summary: { type: String, trim: true },
    features: [{ type: String, trim: true }],
    priceInr: { type: Number, required: true, min: 1 },
    usdPrice: { type: Number, required: true, min: 0.01 },
    checkinsPerWeek: { type: Number, default: 0 },
    visitsPerWeek: { type: Number, default: 0 },
    recommended: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

planSchema.methods.toPublic = function toPublic() {
  return {
    id: this.id,
    name: this.name,
    summary: this.summary,
    features: this.features,
    priceInr: this.priceInr,
    usdPrice: this.usdPrice,
    prices: planPrices(this),
    checkinsPerWeek: this.checkinsPerWeek,
    visitsPerWeek: this.visitsPerWeek,
    recommended: this.recommended,
    active: this.active,
  };
};

export const Plan = mongoose.model('Plan', planSchema);
