import { WEDSTRIJDDUUR } from '../lib/opstelling';
import { datumNl, startjaar } from '../lib/seizoen';
import type { Deelname, Wedstrijd } from '../types';
import { type Dataset, uitslag } from './dataset';
import { type Filter, berekenSpelerStats, filterWedstrijden } from './statistiek';

export interface Reeks {
  lengte: number;
  van: Wedstrijd | null;
  tot: Wedstrijd | null;
}

/**
 * Langste reeks opeenvolgende teamwedstrijden waarin `telt` waar is.
 * Een ontbrekend seizoen (bijv. 2011-12) onderbreekt de reeks.
 */
export function langsteReeks(data: Dataset, spelerId: string, telt: (d: Deelname | undefined) => boolean, wedstrijden = data.wedstrijden): Reeks {
  const perWedstrijd = new Map((data.deelnamesPerSpeler.get(spelerId) ?? []).map((d) => [d.wedstrijdId, d]));
  let beste: Reeks = { lengte: 0, van: null, tot: null };
  let huidig: Reeks = { lengte: 0, van: null, tot: null };
  let vorige: Wedstrijd | null = null;
  for (const w of wedstrijden) {
    if (vorige && startjaar(w.seizoen) - startjaar(vorige.seizoen) > 1) huidig = { lengte: 0, van: null, tot: null };
    vorige = w;
    if (telt(perWedstrijd.get(w.id))) {
      huidig = { lengte: huidig.lengte + 1, van: huidig.van ?? w, tot: w };
      if (huidig.lengte > beste.lengte) beste = huidig;
    } else {
      huidig = { lengte: 0, van: null, tot: null };
    }
  }
  return beste;
}

export const speeltMee = (d: Deelname | undefined) => !!d;
export const speeltVol = (d: Deelname | undefined) => !!d && d.minuten >= WEDSTRIJDDUUR;

export interface Profiel {
  debuut: Wedstrijd | null;
  laatste: Wedstrijd | null;
  favoriet: { tegenstanderId: string; minuten: number; wedstrijden: number } | null;
  reeksWedstrijden: Reeks;
  reeksVol: Reeks;
  kortsteInval: { minuten: number; wedstrijd: Wedstrijd; geschat: boolean } | null;
  langsteBank: number;
}

export function spelerProfiel(data: Dataset, spelerId: string): Profiel {
  const deelnames = [...(data.deelnamesPerSpeler.get(spelerId) ?? [])].sort(
    (a, b) => (data.volgnummer.get(a.wedstrijdId) ?? 0) - (data.volgnummer.get(b.wedstrijdId) ?? 0),
  );
  const w = (d: Deelname) => data.wedstrijd.get(d.wedstrijdId)!;
  const tegen = new Map<string, { minuten: number; wedstrijden: number }>();
  let kortsteInval: Profiel['kortsteInval'] = null;
  for (const d of deelnames) {
    const wed = w(d);
    const t = tegen.get(wed.tegenstanderId) ?? { minuten: 0, wedstrijden: 0 };
    t.minuten += d.minuten;
    t.wedstrijden++;
    tegen.set(wed.tegenstanderId, t);
    if (!d.basis && (!kortsteInval || d.minuten < kortsteInval.minuten)) kortsteInval = { minuten: d.minuten, wedstrijd: wed, geschat: d.basisBron === 'geschat' };
  }
  const fav = [...tegen.entries()].sort((a, b) => b[1].minuten - a[1].minuten)[0];
  const langsteBank = (() => {
    let max = 0;
    let n = 0;
    for (const wed of data.wedstrijden) {
      if (!wed.bank) continue;
      if (wed.bank.includes(spelerId)) max = Math.max(max, ++n);
      else n = 0;
    }
    return max;
  })();
  return {
    debuut: deelnames.length ? w(deelnames[0]) : null,
    laatste: deelnames.length ? w(deelnames[deelnames.length - 1]) : null,
    favoriet: fav ? { tegenstanderId: fav[0], ...fav[1] } : null,
    reeksWedstrijden: langsteReeks(data, spelerId, speeltMee),
    reeksVol: langsteReeks(data, spelerId, speeltVol),
    kortsteInval,
    langsteBank,
  };
}

// ---------------------------------------------------------------- mijlpalen

export const MIJLPALEN_WEDSTRIJDEN = [50, 100, 150, 200, 250, 300];
export const MIJLPALEN_MINUTEN = [2500, 5000, 7500, 10000, 12500, 15000];

export interface Mijlpaal {
  spelerId: string;
  soort: 'wedstrijden' | 'minuten';
  grens: number;
  huidig: number;
  nogNodig: number;
}

/** Behaalde en eerstvolgende mijlpalen per speler (all-time). */
export function mijlpalen(data: Dataset) {
  const stats = berekenSpelerStats(data, { seizoen: 'alle', tegenstanderId: 'alle', thuisUit: 'alle' });
  const behaald: Mijlpaal[] = [];
  const binnenkort: Mijlpaal[] = [];
  for (const s of stats.values()) {
    const speler = data.speler.get(s.spelerId);
    for (const [soort, grenzen, huidig, marge] of [
      ['wedstrijden', MIJLPALEN_WEDSTRIJDEN, s.wedstrijden, 8],
      ['minuten', MIJLPALEN_MINUTEN, s.minuten, 600],
    ] as const) {
      for (const g of grenzen) if (huidig >= g) behaald.push({ spelerId: s.spelerId, soort, grens: g, huidig, nogNodig: 0 });
      const volgende = grenzen.find((g) => g > huidig);
      if (volgende && speler?.actief && volgende - huidig <= marge)
        binnenkort.push({ spelerId: s.spelerId, soort, grens: volgende, huidig, nogNodig: volgende - huidig });
    }
  }
  behaald.sort((a, b) => b.grens - a.grens || b.huidig - a.huidig);
  binnenkort.sort((a, b) => a.nogNodig / a.grens - b.nogNodig / b.grens);
  return { behaald, binnenkort };
}

// ---------------------------------------------------------------- duo's

export interface Duo {
  a: string;
  b: string;
  wedstrijden: number;
  /** Beiden in de basis. */
  samenBasis: number;
}

export function duos(data: Dataset, f: Filter, spelerId?: string): Duo[] {
  const m = new Map<string, Duo>();
  for (const w of filterWedstrijden(data, f)) {
    const ds = data.deelnamesPerWedstrijd.get(w.id) ?? [];
    for (let i = 0; i < ds.length; i++)
      for (let j = i + 1; j < ds.length; j++) {
        let [x, y] = [ds[i], ds[j]];
        if (x.spelerId > y.spelerId) [x, y] = [y, x];
        if (spelerId && x.spelerId !== spelerId && y.spelerId !== spelerId) continue;
        const k = `${x.spelerId}|${y.spelerId}`;
        const duo = m.get(k) ?? { a: x.spelerId, b: y.spelerId, wedstrijden: 0, samenBasis: 0 };
        duo.wedstrijden++;
        if (x.basis && y.basis) duo.samenBasis++;
        m.set(k, duo);
      }
  }
  return [...m.values()].sort((a, b) => b.wedstrijden - a.wedstrijden || b.samenBasis - a.samenBasis);
}

// ---------------------------------------------------------------- seizoenen

export interface SeizoenOverzicht {
  seizoen: string;
  wedstrijden: Wedstrijd[];
  spelersGebruikt: number;
  debutanten: string[];
  ijzerenMan: { spelerId: string; minuten: number } | null;
  winst: number;
  gelijk: number;
  verlies: number;
  voor: number;
  tegen: number;
}

export function eersteSeizoenPerSpeler(data: Dataset): Map<string, string> {
  const eerste = new Map<string, string>();
  for (const w of data.wedstrijden)
    for (const d of data.deelnamesPerWedstrijd.get(w.id) ?? []) if (!eerste.has(d.spelerId)) eerste.set(d.spelerId, w.seizoen);
  for (const t of data.seizoenstotalen) {
    const e = eerste.get(t.spelerId);
    if (!e || t.seizoen < e) eerste.set(t.spelerId, t.seizoen);
  }
  return eerste;
}

export function seizoenOverzicht(data: Dataset, seizoen: string, eerste = eersteSeizoenPerSpeler(data)): SeizoenOverzicht {
  const wedstrijden = data.wedstrijden.filter((w) => w.seizoen === seizoen);
  const minuten = new Map<string, number>();
  for (const w of wedstrijden) for (const d of data.deelnamesPerWedstrijd.get(w.id) ?? []) minuten.set(d.spelerId, (minuten.get(d.spelerId) ?? 0) + d.minuten);
  for (const t of data.seizoenstotalen) if (t.seizoen === seizoen) minuten.set(t.spelerId, (minuten.get(t.spelerId) ?? 0) + t.minuten);
  const top = [...minuten.entries()].sort((a, b) => b[1] - a[1])[0];
  const o: SeizoenOverzicht = {
    seizoen, wedstrijden, spelersGebruikt: minuten.size,
    debutanten: [...minuten.keys()].filter((id) => eerste.get(id) === seizoen && seizoen !== data.seizoenen[0]),
    ijzerenMan: top ? { spelerId: top[0], minuten: top[1] } : null,
    winst: 0, gelijk: 0, verlies: 0, voor: 0, tegen: 0,
  };
  for (const w of wedstrijden) {
    const u = uitslag(w);
    if (!u) continue;
    if (u === 'W') o.winst++;
    if (u === 'G') o.gelijk++;
    if (u === 'V') o.verlies++;
    o.voor += w.doelpuntenVoor ?? 0;
    o.tegen += w.doelpuntenTegen ?? 0;
  }
  return o;
}

// ---------------------------------------------------------------- records

export interface Record {
  titel: string;
  waarde: string;
  wie: string; // spelerId, seizoen of wedstrijdId (zie soort)
  soort: 'speler' | 'seizoen' | 'wedstrijd';
  toelichting?: string;
}

export function records(data: Dataset): Record[] {
  const uit: Record[] = [];
  const perSpelerSeizoen = new Map<string, { minuten: number; wedstrijden: number; invallen: number }>();
  for (const d of data.deelnames) {
    const w = data.wedstrijd.get(d.wedstrijdId);
    if (!w) continue;
    const k = `${d.spelerId}|${w.seizoen}`;
    const r = perSpelerSeizoen.get(k) ?? { minuten: 0, wedstrijden: 0, invallen: 0 };
    r.minuten += d.minuten;
    r.wedstrijden++;
    if (!d.basis) r.invallen++;
    perSpelerSeizoen.set(k, r);
  }
  const top = (veld: 'minuten' | 'wedstrijden' | 'invallen') => [...perSpelerSeizoen.entries()].sort((a, b) => b[1][veld] - a[1][veld])[0];
  for (const [veld, titel, eenheid] of [
    ['minuten', 'Meeste minuten in één seizoen', 'min'],
    ['wedstrijden', 'Meeste wedstrijden in één seizoen', 'wed'],
    ['invallen', 'Meeste invalbeurten in één seizoen ≈', 'keer'],
  ] as const) {
    const t = top(veld);
    if (t) {
      const [spelerId, seizoen] = t[0].split('|');
      uit.push({ titel, waarde: `${t[1][veld].toLocaleString('nl-NL')} ${eenheid}`, wie: spelerId, soort: 'speler', toelichting: seizoen });
    }
  }
  let besteReeks = { spelerId: '', r: { lengte: 0, van: null, tot: null } as Reeks };
  let besteVol = { spelerId: '', r: { lengte: 0, van: null, tot: null } as Reeks };
  for (const s of data.spelers) {
    const r = langsteReeks(data, s.id, speeltMee);
    if (r.lengte > besteReeks.r.lengte) besteReeks = { spelerId: s.id, r };
    const v = langsteReeks(data, s.id, speeltVol);
    if (v.lengte > besteVol.r.lengte) besteVol = { spelerId: s.id, r: v };
  }
  if (besteReeks.spelerId)
    uit.push({ titel: 'Langste reeks wedstrijden op rij', waarde: `${besteReeks.r.lengte} wed`, wie: besteReeks.spelerId, soort: 'speler', toelichting: reeksTekst(besteReeks.r) });
  if (besteVol.spelerId)
    uit.push({ titel: "Langste reeks volledige wedstrijden (90')", waarde: `${besteVol.r.lengte} wed`, wie: besteVol.spelerId, soort: 'speler', toelichting: reeksTekst(besteVol.r) });

  const stats = berekenSpelerStats(data, { seizoen: 'alle', tegenstanderId: 'alle', thuisUit: 'alle' });
  const meesteSeizoenen = [...stats.values()].sort((a, b) => b.seizoenen - a.seizoenen || b.minuten - a.minuten)[0];
  if (meesteSeizoenen) uit.push({ titel: 'Meeste seizoenen in het 1e', waarde: `${meesteSeizoenen.seizoenen} seizoenen`, wie: meesteSeizoenen.spelerId, soort: 'speler' });

  const eerste = eersteSeizoenPerSpeler(data);
  const metWedstrijden = new Set(data.wedstrijden.map((w) => w.seizoen));
  const overzichten = data.seizoenen.filter((sz) => metWedstrijden.has(sz)).map((sz) => seizoenOverzicht(data, sz, eerste));
  const volledig = overzichten.filter((o) => o.wedstrijden.length >= 20);
  const meesteSpelers = [...volledig].sort((a, b) => b.spelersGebruikt - a.spelersGebruikt)[0];
  const minsteSpelers = [...volledig].sort((a, b) => a.spelersGebruikt - b.spelersGebruikt)[0];
  const meesteDebutanten = [...overzichten].sort((a, b) => b.debutanten.length - a.debutanten.length)[0];
  if (meesteSpelers) uit.push({ titel: 'Meeste spelers gebruikt in een seizoen', waarde: `${meesteSpelers.spelersGebruikt} spelers`, wie: meesteSpelers.seizoen, soort: 'seizoen' });
  if (minsteSpelers) uit.push({ titel: 'Minste spelers gebruikt in een seizoen', waarde: `${minsteSpelers.spelersGebruikt} spelers`, wie: minsteSpelers.seizoen, soort: 'seizoen', toelichting: 'Seizoenen met minstens 20 wedstrijden' });
  if (meesteDebutanten) uit.push({ titel: 'Meeste debutanten in een seizoen', waarde: `${meesteDebutanten.debutanten.length} debutanten`, wie: meesteDebutanten.seizoen, soort: 'seizoen' });

  const kortste = data.deelnames.filter((d) => !d.basis).sort((a, b) => a.minuten - b.minuten)[0];
  if (kortste) uit.push({ titel: 'Kortste invalbeurt', waarde: `${kortste.minuten} min`, wie: kortste.spelerId, soort: 'speler', toelichting: kortste.wedstrijdId });

  const metUitslag = data.wedstrijden.filter((w) => uitslag(w));
  const grootsteWinst = [...metUitslag].sort((a, b) => b.doelpuntenVoor! - b.doelpuntenTegen! - (a.doelpuntenVoor! - a.doelpuntenTegen!))[0];
  if (grootsteWinst && uitslag(grootsteWinst) === 'W')
    uit.push({ titel: 'Grootste overwinning', waarde: `${grootsteWinst.doelpuntenVoor}-${grootsteWinst.doelpuntenTegen}`, wie: grootsteWinst.id, soort: 'wedstrijd' });

  const goalsPerWedstrijd = new Map<string, number>();
  for (const g of data.gebeurtenissen) if (g.type === 'doelpunt' && g.spelerId) goalsPerWedstrijd.set(`${g.spelerId}|${g.wedstrijdId}`, (goalsPerWedstrijd.get(`${g.spelerId}|${g.wedstrijdId}`) ?? 0) + 1);
  const hattrick = [...goalsPerWedstrijd.entries()].sort((a, b) => b[1] - a[1])[0];
  if (hattrick && hattrick[1] >= 2) {
    const [spelerId, wedstrijdId] = hattrick[0].split('|');
    uit.push({ titel: 'Meeste doelpunten in één wedstrijd', waarde: `${hattrick[1]} goals`, wie: spelerId, soort: 'speler', toelichting: wedstrijdId });
  }
  return uit;
}

function reeksTekst(r: Reeks): string {
  return r.van && r.tot ? `${datumNl(r.van.datum)} t/m ${datumNl(r.tot.datum)}` : '';
}
