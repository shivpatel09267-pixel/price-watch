import { useEffect, useState } from 'react';
import { fetchNationalAverages, type NationalAverages } from '../services/blsService';

export interface NationalAveragesState {
  averages: NationalAverages;
  loading: boolean;
  // True when the network fetch failed and these figures came from a
  // previous session's cache. Worth showing, since "official data" that's
  // quietly out of date is worse than data labelled as out of date.
  stale: boolean;
  error: string | null;
}

// Loads real BLS national average prices once per app session (the
// service layer handles day-level caching underneath).
export function useNationalAverages(): NationalAveragesState {
  const [state, setState] = useState<NationalAveragesState>({
    averages: {},
    loading: true,
    stale: false,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    fetchNationalAverages()
      .then(({ averages, stale }) => {
        if (!cancelled) setState({ averages, loading: false, stale, error: null });
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setState({
            averages: {},
            loading: false,
            stale: false,
            error: "Couldn't load official BLS figures. Check your connection.",
          });
        }
        console.warn(`[useNationalAverages] failed:`, fetchError?.message ?? fetchError);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
