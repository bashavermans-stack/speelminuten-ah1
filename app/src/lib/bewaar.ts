import { useState } from 'react';

/** useState die de keuze onthoudt in localStorage (alleen een gemak; werkt ook zonder). */
export function useBewaardeState<T>(sleutel: string, standaard: T): [T, (w: T) => void] {
  const [waarde, setWaarde] = useState<T>(() => {
    try {
      const s = localStorage.getItem(`sm:${sleutel}`);
      return s ? (JSON.parse(s) as T) : standaard;
    } catch {
      return standaard;
    }
  });
  const zet = (w: T) => {
    setWaarde(w);
    try {
      localStorage.setItem(`sm:${sleutel}`, JSON.stringify(w));
    } catch {
      /* geen opslag beschikbaar */
    }
  };
  return [waarde, zet];
}
