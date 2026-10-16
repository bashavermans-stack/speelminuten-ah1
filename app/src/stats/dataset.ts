import type { DataBestand, Deelname, Gebeurtenis, Seizoenstotaal, Speler, Tegenstander, Wedstrijd } from '../types';

/** Alle data in het geheugen, met handige opzoektabellen. Klein genoeg (±5.000 deelnames). */
export interface Dataset {
  spelers: Speler[];
  speler: Map<string, Speler>;
  tegenstanders: Tegenstander[];
  tegenstander: Map<string, Tegenstander>;
  /** Oplopend op datum. */
  wedstrijden: Wedstrijd[];
  wedstrijd: Map<string, Wedstrijd>;
  /** Index in `wedstrijden` (chronologische volgorde). */
  volgnummer: Map<string, number>;
  deelnames: Deelname[];
  deelnamesPerWedstrijd: Map<string, Deelname[]>;
  deelnamesPerSpeler: Map<string, Deelname[]>;
  gebeurtenissen: Gebeurtenis[];
  gebeurtenissenPerWedstrijd: Map<string, Gebeurtenis[]>;
  seizoenstotalen: Seizoenstotaal[];
  /** Oplopend: ['2010-2011', ...] */
  seizoenen: string[];
  /** Meest recente seizoen met wedstrijden. */
  laatsteSeizoen: string | null;
}

function groepeer<T>(lijst: T[], sleutel: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of lijst) {
    const k = sleutel(x);
    const l = m.get(k);
    if (l) l.push(x);
    else m.set(k, [x]);
  }
  return m;
}

export function maakDataset(raw: DataBestand): Dataset {
  const wedstrijden = [...raw.wedstrijden].sort((a, b) => a.datum.localeCompare(b.datum) || a.id.localeCompare(b.id));
  const seizoenen = [...new Set([...wedstrijden.map((w) => w.seizoen), ...raw.seizoenstotalen.map((t) => t.seizoen)])].sort();
  const spelers = [...raw.spelers].sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));
  const tegenstanders = [...raw.tegenstanders].sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));
  return {
    spelers,
    speler: new Map(spelers.map((s) => [s.id, s])),
    tegenstanders,
    tegenstander: new Map(tegenstanders.map((t) => [t.id, t])),
    wedstrijden,
    wedstrijd: new Map(wedstrijden.map((w) => [w.id, w])),
    volgnummer: new Map(wedstrijden.map((w, i) => [w.id, i])),
    deelnames: raw.deelnames,
    deelnamesPerWedstrijd: groepeer(raw.deelnames, (d) => d.wedstrijdId),
    deelnamesPerSpeler: groepeer(raw.deelnames, (d) => d.spelerId),
    gebeurtenissen: raw.gebeurtenissen,
    gebeurtenissenPerWedstrijd: groepeer(raw.gebeurtenissen, (g) => g.wedstrijdId),
    seizoenstotalen: raw.seizoenstotalen,
    seizoenen,
    laatsteSeizoen: wedstrijden.length ? wedstrijden[wedstrijden.length - 1].seizoen : null,
  };
}

export function spelerNaam(data: Dataset, id: string | null | undefined): string {
  if (!id) return 'eigen doelpunt tegenstander';
  return data.speler.get(id)?.naam ?? 'onbekende speler';
}

export function tegenstanderNaam(data: Dataset, id: string): string {
  return data.tegenstander.get(id)?.naam ?? id;
}

export type Uitslag = 'W' | 'G' | 'V';

export function uitslag(w: Wedstrijd): Uitslag | null {
  if (w.doelpuntenVoor == null || w.doelpuntenTegen == null) return null;
  return w.doelpuntenVoor > w.doelpuntenTegen ? 'W' : w.doelpuntenVoor === w.doelpuntenTegen ? 'G' : 'V';
}
