import { lazy, Suspense } from 'react';
import Loading from './Loading';

// Leaflet is large, so it only loads on the pages that show a map.
const LazyMapPicker = lazy(() => import('./MapPicker'));
const LazyCaregiverMap = lazy(() => import('./CaregiverMap'));

export function MapPicker(props) {
  return (
    <Suspense fallback={<Loading />}>
      <LazyMapPicker {...props} />
    </Suspense>
  );
}

export function CaregiverMap(props) {
  return (
    <Suspense fallback={<Loading />}>
      <LazyCaregiverMap {...props} />
    </Suspense>
  );
}
