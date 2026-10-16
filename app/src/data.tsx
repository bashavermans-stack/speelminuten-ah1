import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { leesAlles, leesMeta } from './db';
import { type Dataset, maakDataset } from './stats/dataset';

interface DataContext {
  data: Dataset | null;
  laden: boolean;
  /** Aantal wijzigingen sinds de laatste back-up. */
  wijzigingenSindsBackup: number;
  herlaad: () => Promise<void>;
}

const Ctx = createContext<DataContext | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Dataset | null>(null);
  const [laden, setLaden] = useState(true);
  const [wijzigingenSindsBackup, setWijzigingen] = useState(0);

  const herlaad = useCallback(async () => {
    const [raw, n, gestart] = await Promise.all([leesAlles(), leesMeta('wijzigingenSindsBackup', 0), leesMeta('gestart', false)]);
    setData(raw.wedstrijden.length || raw.spelers.length || gestart ? maakDataset(raw) : null);
    setWijzigingen(n);
    setLaden(false);
  }, []);

  useEffect(() => {
    herlaad();
  }, [herlaad]);

  return <Ctx.Provider value={{ data, laden, wijzigingenSindsBackup, herlaad }}>{children}</Ctx.Provider>;
}

export function useData(): DataContext {
  const c = useContext(Ctx);
  if (!c) throw new Error('useData buiten DataProvider');
  return c;
}

/** Voor schermen die alleen met geladen data werken. */
export function useDataset(): Dataset {
  const { data } = useData();
  if (!data) throw new Error('Geen data geladen');
  return data;
}
