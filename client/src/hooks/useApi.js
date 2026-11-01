import { useCallback, useEffect, useState } from 'react';
import { api, getErrorMessage } from '../api/client';

export function useApi(url) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let ignore = false;

    api
      .get(url)
      .then((res) => {
        if (!ignore) setState({ data: res.data, loading: false, error: '' });
      })
      .catch((err) => {
        if (!ignore) setState({ data: null, loading: false, error: getErrorMessage(err) });
      });

    return () => {
      ignore = true;
    };
  }, [url, version]);

  const reload = useCallback(() => setVersion((current) => current + 1), []);

  return { ...state, reload };
}
