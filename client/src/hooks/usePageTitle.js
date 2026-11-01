import { useEffect } from 'react';

export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | HOMEX` : 'HOMEX | Care That Comes Home';
  }, [title]);
}
