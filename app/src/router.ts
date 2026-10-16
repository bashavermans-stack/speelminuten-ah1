import { useEffect, useState } from 'react';

/** Eenvoudige hash-router: '#/speler/p-jan-jansen' → ['speler', 'p-jan-jansen']. */
export function useRoute(): string[] {
  const lees = () =>
    decodeURIComponent(window.location.hash.replace(/^#\/?/, ''))
      .split('/')
      .filter(Boolean);
  const [pad, setPad] = useState(lees);
  useEffect(() => {
    const opWijziging = () => {
      setPad(lees());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', opWijziging);
    return () => window.removeEventListener('hashchange', opWijziging);
  }, []);
  return pad;
}

export function ga(pad: string) {
  window.location.hash = pad.startsWith('#') ? pad : `#${pad}`;
}

export function terug(standaard = '#/') {
  if (window.history.length > 1) window.history.back();
  else ga(standaard);
}
