import { useEffect, useState } from 'react';
import { LocateFixed } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { homeIcon, TILE_ATTRIBUTION, TILE_URL } from './mapIcons';

const BHUBANESWAR = { lat: 20.2961, lng: 85.8245 };

function ClickToPlace({ onChange }) {
  useMapEvents({
    click: ({ latlng }) => onChange({ lat: latlng.lat, lng: latlng.lng }),
  });
  return null;
}

function KeepInView({ value }) {
  const map = useMap();

  useEffect(() => {
    if (value) map.panTo(value);
  }, [map, value]);

  return null;
}

function round(value) {
  return Math.round(value * 1e6) / 1e6;
}

export default function MapPicker({ label, hint, value, onChange, error }) {
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState('');
  const [draft, setDraft] = useState({ lat: null, lng: null });

  const place = ({ lat, lng }) => onChange({ lat: round(lat), lng: round(lng) });

  const useCurrentLocation = () => {
    setLocateError('');
    if (!navigator.geolocation) {
      setLocateError('Your browser cannot share its location. Tap the map instead.');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        place({ lat: coords.latitude, lng: coords.longitude });
      },
      () => {
        setLocating(false);
        setLocateError('We could not get your location. Tap the map instead.');
      },
    );
  };

  const shownCoordinate = (name) => draft[name] ?? value?.[name] ?? '';

  // Waits until both boxes hold valid numbers before moving the pin.
  const commitCoordinates = () => {
    const [latText, lngText] = [shownCoordinate('lat'), shownCoordinate('lng')];
    const [lat, lng] = [Number(latText), Number(lngText)];
    const isValid = latText !== '' && lngText !== '' && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

    if (isValid) {
      onChange({ lat, lng });
      setDraft({ lat: null, lng: null });
    }
  };

  const coordinateProps = (name) => ({
    inputMode: 'decimal',
    value: shownCoordinate(name),
    onChange: (event) => setDraft((current) => ({ ...current, [name]: event.target.value })),
    onBlur: commitCoordinates,
    className: 'mt-1.5 min-h-12 w-full rounded-xl border-2 border-line bg-white px-4 py-2',
  });

  return (
    <fieldset>
      <legend className="font-semibold">{label}</legend>
      {hint && <p className="text-base text-ink-soft">{hint}</p>}

      <div className="relative isolate mt-2 h-72 overflow-hidden rounded-xl border-2 border-line">
        <MapContainer
          center={value ?? BHUBANESWAR}
          zoom={value ? 15 : 12}
          className="h-full w-full"
          scrollWheelZoom={false}
        >
          <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
          <ClickToPlace onChange={place} />
          <KeepInView value={value} />
          {value && (
            <Marker
              position={value}
              icon={homeIcon}
              draggable
              title="Chosen location"
              eventHandlers={{
                dragend: (event) => place(event.target.getLatLng()),
              }}
            />
          )}
        </MapContainer>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={locating}
          className="btn btn-secondary"
        >
          <LocateFixed aria-hidden="true" size={20} />
          {locating ? 'Finding you…' : 'Use my current location'}
        </button>
        <p className="text-base text-ink-soft">
          {value ? 'Pin placed. Drag it or tap the map to move it.' : 'No pin yet. Tap the map.'}
        </p>
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer font-medium">Enter coordinates instead</summary>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="font-semibold">Latitude</span>
            <input {...coordinateProps('lat')} />
          </label>
          <label className="block">
            <span className="font-semibold">Longitude</span>
            <input {...coordinateProps('lng')} />
          </label>
        </div>
      </details>

      {(error || locateError) && (
        <p role="alert" className="mt-1.5 text-base font-medium text-danger">
          {error || locateError}
        </p>
      )}
    </fieldset>
  );
}
