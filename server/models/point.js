import mongoose from 'mongoose';

export const pointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true },
  },
  { _id: false },
);

export const toPoint = ({ lat, lng }) => ({ type: 'Point', coordinates: [lng, lat] });

export function fromPoint(point) {
  if (!point) return null;
  const [lng, lat] = point.coordinates;
  return { lat, lng };
}
