const EARTH_RADIUS_KM = 6371;
const toRadians = (degrees) => (degrees * Math.PI) / 180;

export function distanceKm(from, to) {
  const latChange = toRadians(to.lat - from.lat);
  const lngChange = toRadians(to.lng - from.lng);
  const a =
    Math.sin(latChange / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(lngChange / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

// About 100 metres. Families see the neighbourhood, not a caregiver's exact home.
export const blurCoordinate = (value) => Math.round(value * 1000) / 1000;
