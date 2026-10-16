import { WEDSTRIJDDUUR } from '../lib/opstelling';
import type { Wedstrijd } from '../types';
import { type Dataset, uitslag } from './dataset';

export interface Filter {
  seizoen: string; // 'alle' of '2025-2026'
  tegenstanderId: string; // 'alle' of id
  thuisUit: 'alle' | 'thuis' | 'uit';
}

export const GEEN_FILTER: Filter = { seizoen: 'alle', tegenstanderId: 'alle', thuisUit: 'alle' };

export function filterWedstrijden(data: Dataset, f: Filter): Wedstrijd[] {
  return data.wedstrijden.filter(
    (w) =>
      (f.seizoen === 'alle' || w.seizoen === f.seizoen) &&
      (f.tegenstanderId === 'alle' || w.tegenstanderId === f.tegenstanderId) &&
      (f.thuisUit === 'alle' || w.thuisUit === f.thuisUit),
  );
}

/** Seizoenstotalen (wedstrijden zonder detail) tellen alleen mee zonder tegenstander/thuis-uit-filter. */
function telSeizoenstotalenMee(f: Filter): boolean {
  return f.tegenstanderId === 'alle' && f.thuisUit === 'alle';
}

export interface SpelerStats {
  spelerId: string;
  minuten: number;
  wedstrijden: number;
  basis: number;
  volledig: number;
  invalbeurten: number;
  gewisseld: number;
  doelpunten: number;
  geel: number;
  rood: number;
  seizoenen: number;
  /** Minuten als percentage van de beschikbare minuten in seizoenen waarin hij speelde. */
  percentage: number;
  gemMinuten: number;
  /** Wedstrijden in de basis waarvan de uitslag bekend is. */
  basisMetUitslag: number;
  basisWinst: number;
  basisGelijk: number;
  basisPunten: number;
  /** Bevat basis/invaller-gegevens die geschat zijn (historische Excel-data). */
  geschat: boolean;
  /** Minuten/wedstrijden uit seizoenstotalen zonder wedstrijddetail. */
  zonderDetailMinuten: number;
}

function leeg(spelerId: string): SpelerStats {
  return {
    spelerId, minuten: 0, wedstrijden: 0, basis: 0, volledig: 0, invalbeurten: 0, gewisseld: 0, doelpunten: 0,
    geel: 0, rood: 0, seizoenen: 0, percentage: 0, gemMinuten: 0, basisMetUitslag: 0, basisWinst: 0, basisGelijk: 0,
    basisPunten: 0, geschat: false, zonderDetailMinuten: 0,
  };
}

export function berekenSpelerStats(data: Dataset, f: Filter): Map<string, SpelerStats> {
  const wedstrijden = filterWedstrijden(data, f);
  const perSeizoen = new Map<string, number>();
  for (const w of wedstrijden) perSeizoen.set(w.seizoen, (perSeizoen.get(w.seizoen) ?? 0) + 1);
  const stats = new Map<string, SpelerStats>();
  const seizoenenVan = new Map<string, Set<string>>();
  const get = (id: string) => {
    let s = stats.get(id);
    if (!s) stats.set(id, (s = leeg(id)));
    return s;
  };
  for (const w of wedstrijden) {
    const u = uitslag(w);
    for (const d of data.deelnamesPerWedstrijd.get(w.id) ?? []) {
      const s = get(d.spelerId);
      s.minuten += d.minuten;
      s.wedstrijden++;
      if (d.basis) s.basis++;
      else s.invalbeurten++;
      if (d.minuten >= WEDSTRIJDDUUR) s.volledig++;
      if (d.gewisseld) s.gewisseld++;
      if (d.basisBron === 'geschat' && d.minuten < WEDSTRIJDDUUR) s.geschat = true;
      if (d.basis && u) {
        s.basisMetUitslag++;
        if (u === 'W') s.basisWinst++;
        if (u === 'G') s.basisGelijk++;
        s.basisPunten += u === 'W' ? 3 : u === 'G' ? 1 : 0;
      }
      let set = seizoenenVan.get(d.spelerId);
      if (!set) seizoenenVan.set(d.spelerId, (set = new Set()));
      set.add(w.seizoen);
    }
    for (const g of data.gebeurtenissenPerWedstrijd.get(w.id) ?? []) {
      if (!g.spelerId) continue;
      if (g.type === 'doelpunt') get(g.spelerId).doelpunten++;
      if (g.type === 'geel') get(g.spelerId).geel++;
      if (g.type === 'rood') get(g.spelerId).rood++;
    }
  }
  for (const [id, s] of stats) {
    const set = seizoenenVan.get(id) ?? new Set<string>();
    const beschikbaar = [...set].reduce((som, sz) => som + (perSeizoen.get(sz) ?? 0) * WEDSTRIJDDUUR, 0);
    s.percentage = beschikbaar ? (100 * s.minuten) / beschikbaar : 0;
    s.gemMinuten = s.wedstrijden ? s.minuten / s.wedstrijden : 0;
  }
  if (telSeizoenstotalenMee(f)) {
    for (const t of data.seizoenstotalen) {
      if (f.seizoen !== 'alle' && t.seizoen !== f.seizoen) continue;
      const s = get(t.spelerId);
      s.minuten += t.minuten;
      s.wedstrijden += t.wedstrijden;
      s.zonderDetailMinuten += t.minuten;
      let set = seizoenenVan.get(t.spelerId);
      if (!set) seizoenenVan.set(t.spelerId, (set = new Set()));
      set.add(t.seizoen);
    }
  }
  for (const [id, s] of stats) s.seizoenen = seizoenenVan.get(id)?.size ?? 0;
  return stats;
}

export interface Ranglijst {
  sleutel: string;
  label: string;
  /** Korte naam voor de keuzeknop. */
  chip: string;
  kort: string;
  waarde: (s: SpelerStats) => number;
  formaat?: (n: number) => string;
  /** Leunt op geschatte basis/invaller-gegevens. */
  geschat?: boolean;
  /** Minimaal aantal wedstrijden om mee te tellen (voor gemiddelden/percentages). */
  minWedstrijden?: number;
  /** Alleen zinvol met gegevens die vanaf de app worden ingevoerd. */
  nieuw?: boolean;
  uitleg?: string;
}

const pct = (n: number) => `${Math.round(n)}%`;
const een = (n: number) => n.toLocaleString('nl-NL', { maximumFractionDigits: 1 });

export const RANGLIJSTEN: Ranglijst[] = [
  { sleutel: 'minuten', label: 'Meeste minuten', chip: 'Minuten', kort: 'min', waarde: (s) => s.minuten },
  { sleutel: 'wedstrijden', label: 'Meeste wedstrijden', chip: 'Wedstrijden', kort: 'wed', waarde: (s) => s.wedstrijden },
  { sleutel: 'basis', label: 'Meeste basisplaatsen', chip: 'Basis', kort: 'basis', waarde: (s) => s.basis, geschat: true },
  { sleutel: 'volledig', label: 'Meeste volledige wedstrijden', chip: '90 minuten', kort: "90'", waarde: (s) => s.volledig, uitleg: 'Wedstrijden van 90 minuten.' },
  { sleutel: 'invalbeurten', label: 'Meeste invalbeurten', chip: 'Invalbeurten', kort: 'in', waarde: (s) => s.invalbeurten, geschat: true },
  { sleutel: 'gewisseld', label: 'Meeste keer gewisseld', chip: 'Gewisseld', kort: 'uit', waarde: (s) => s.gewisseld, geschat: true, uitleg: 'Basisspeler die eruit is gehaald.' },
  { sleutel: 'gemMinuten', label: 'Hoogste gem. minuten per wedstrijd', chip: 'Gemiddeld', kort: 'gem', waarde: (s) => s.gemMinuten, formaat: een, minWedstrijden: 10, uitleg: 'Minimaal 10 wedstrijden.' },
  { sleutel: 'percentage', label: 'Hoogste % van beschikbare minuten', chip: '% minuten', kort: '%', waarde: (s) => s.percentage, formaat: pct, minWedstrijden: 10, uitleg: 'Over de seizoenen waarin de speler speelde; minimaal 10 wedstrijden.' },
  { sleutel: 'seizoenen', label: 'Meeste seizoenen in het 1e', chip: 'Seizoenen', kort: 'seiz', waarde: (s) => s.seizoenen },
  { sleutel: 'superSub', label: 'Supersub: meeste minuten als invaller', chip: 'Supersub', kort: 'min', waarde: () => 0, geschat: true },
  { sleutel: 'doelpunten', label: 'Topscorers', chip: 'Topscorers', kort: 'goals', waarde: (s) => s.doelpunten, nieuw: true },
  { sleutel: 'geel', label: 'Meeste gele kaarten', chip: 'Geel', kort: 'geel', waarde: (s) => s.geel, nieuw: true },
  { sleutel: 'rood', label: 'Meeste rode kaarten', chip: 'Rood', kort: 'rood', waarde: (s) => s.rood, uitleg: 'Historisch alleen voor zover genoteerd in de Excel.' },
  { sleutel: 'winst', label: 'Hoogste winst% in de basis', chip: 'Winst%', kort: 'winst', waarde: (s) => (s.basisMetUitslag ? (100 * s.basisWinst) / s.basisMetUitslag : 0), formaat: pct, nieuw: true, uitleg: 'Alleen wedstrijden met bekende uitslag; minimaal 5 keer in de basis.' },
  { sleutel: 'punten', label: 'Meeste punten per wedstrijd in de basis', chip: 'Punten', kort: 'ppw', waarde: (s) => (s.basisMetUitslag ? s.basisPunten / s.basisMetUitslag : 0), formaat: (n) => n.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), nieuw: true, uitleg: 'Alleen wedstrijden met bekende uitslag; minimaal 5 keer in de basis.' },
];

/** Minuten als invaller per speler (voor de supersub-lijst). */
export function invalMinuten(data: Dataset, f: Filter): Map<string, number> {
  const m = new Map<string, number>();
  for (const w of filterWedstrijden(data, f))
    for (const d of data.deelnamesPerWedstrijd.get(w.id) ?? []) if (!d.basis) m.set(d.spelerId, (m.get(d.spelerId) ?? 0) + d.minuten);
  return m;
}

export interface RanglijstRegel {
  spelerId: string;
  waarde: number;
  stats: SpelerStats;
}

export function maakRanglijst(data: Dataset, f: Filter, r: Ranglijst, stats = berekenSpelerStats(data, f)): RanglijstRegel[] {
  const inval = r.sleutel === 'superSub' ? invalMinuten(data, f) : null;
  const regels: RanglijstRegel[] = [];
  for (const s of stats.values()) {
    if (r.minWedstrijden && s.wedstrijden < r.minWedstrijden) continue;
    if ((r.sleutel === 'winst' || r.sleutel === 'punten') && s.basisMetUitslag < 5) continue;
    const waarde = inval ? (inval.get(s.spelerId) ?? 0) : r.waarde(s);
    if (waarde > 0) regels.push({ spelerId: s.spelerId, waarde, stats: s });
  }
  return regels.sort((a, b) => b.waarde - a.waarde || b.stats.minuten - a.stats.minuten);
}

/** Per seizoen een rij met kerncijfers van één speler. */
export function seizoensRijen(data: Dataset, spelerId: string) {
  const rijen = new Map<string, { seizoen: string; wedstrijden: number; minuten: number; basis: number; invalbeurten: number; gewisseld: number; volledig: number; doelpunten: number; zonderDetail: number; teamWedstrijden: number }>();
  const teamPerSeizoen = new Map<string, number>();
  for (const w of data.wedstrijden) teamPerSeizoen.set(w.seizoen, (teamPerSeizoen.get(w.seizoen) ?? 0) + 1);
  const rij = (sz: string) => {
    let r = rijen.get(sz);
    if (!r) rijen.set(sz, (r = { seizoen: sz, wedstrijden: 0, minuten: 0, basis: 0, invalbeurten: 0, gewisseld: 0, volledig: 0, doelpunten: 0, zonderDetail: 0, teamWedstrijden: teamPerSeizoen.get(sz) ?? 0 }));
    return r;
  };
  for (const d of data.deelnamesPerSpeler.get(spelerId) ?? []) {
    const w = data.wedstrijd.get(d.wedstrijdId);
    if (!w) continue;
    const r = rij(w.seizoen);
    r.wedstrijden++;
    r.minuten += d.minuten;
    if (d.basis) r.basis++;
    else r.invalbeurten++;
    if (d.gewisseld) r.gewisseld++;
    if (d.minuten >= WEDSTRIJDDUUR) r.volledig++;
  }
  for (const g of data.gebeurtenissen) {
    if (g.type === 'doelpunt' && g.spelerId === spelerId) {
      const w = data.wedstrijd.get(g.wedstrijdId);
      if (w) rij(w.seizoen).doelpunten++;
    }
  }
  for (const t of data.seizoenstotalen) {
    if (t.spelerId !== spelerId) continue;
    const r = rij(t.seizoen);
    r.minuten += t.minuten;
    r.wedstrijden += t.wedstrijden;
    r.zonderDetail += t.minuten;
  }
  return [...rijen.values()].sort((a, b) => a.seizoen.localeCompare(b.seizoen));
}
