import { useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { Link } from 'react-router';
import { caregiverIcon, homeIcon, TILE_ATTRIBUTION, TILE_URL } from './mapIcons';

function FitToCircle({ home, radiusKm }) {
  const map = useMap();

  useEffect(() => {
    map.fitBounds(L.latLng(home).toBounds(radiusKm * 2000));
  }, [map, home, radiusKm]);

  return null;
}

export default function CaregiverMap({ home, homeName, radiusKm, caregivers, profileLink }) {
  return (
    <div className="relative isolate h-80 overflow-hidden rounded-2xl border border-line lg:h-[32rem]">
      <MapContainer center={home} zoom={12} className="h-full w-full" scrollWheelZoom={false}>
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        <FitToCircle home={home} radiusKm={radiusKm} />
        <Circle
          center={home}
          radius={radiusKm * 1000}
          pathOptions={{ color: '#a8431f', weight: 2, fillOpacity: 0.06 }}
        />
        <Marker position={home} icon={homeIcon} title={`${homeName}'s home`}>
          <Popup>{homeName}'s home</Popup>
        </Marker>
        {caregivers.map((caregiver) => (
          <Marker
            key={caregiver.id}
            position={caregiver.location}
            icon={caregiverIcon}
            title={`${caregiver.name}, ${caregiver.distanceKm} km away`}
          >
            <Popup>
              <strong>{caregiver.name}</strong>
              <br />
              {caregiver.distanceKm} km away
              <br />
              <Link to={profileLink(caregiver)}>View profile</Link>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
