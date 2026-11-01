import L from 'leaflet';

const pin = (variant) =>
  L.divIcon({
    className: '',
    html: `<span class="map-pin map-pin-${variant}"></span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 30],
    popupAnchor: [0, -30],
  });

export const homeIcon = pin('home');
export const caregiverIcon = pin('caregiver');

export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
