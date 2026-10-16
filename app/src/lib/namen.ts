import type { Speler, Tegenstander } from '../types';

// Zelfde normalisatie als import/excel_naar_json.py, zodat sleutels overeenkomen.
const TUSSENVOEGSELS = new Set(['van', 'vd', 'v', 'de', 'der', 'den', 'het', 't', 'ter', 'ten', 'v.d.', 'v.d', 'vd.']);

export function zonderAccenten(s: string): string {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

function deel(s: string): string {
  return zonderAccenten(s)
    .toLowerCase()
    .replace(/\((k|[a-z]\d|o\d\d)\)/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !TUSSENVOEGSELS.has(w))
    .join('')
    .replace(/[^a-z]/g, '');
}

export function naamSleutel(voornaam: string, achternaam: string): string {
  return `${deel(voornaam)}|${deel(achternaam)}`;
}

/** Sleutel uit een alias zoals 'Jan vd | Berg'. */
function aliasSleutel(alias: string): string {
  const [v, a = ''] = alias.split('|');
  return naamSleutel(v, a);
}

export function tegenstanderSleutel(s: string): string {
  return zonderAccenten(s).toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let vorige = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const huidige = [i];
    for (let j = 1; j <= b.length; j++) {
      huidige.push(Math.min(vorige[j] + 1, huidige[j - 1] + 1, vorige[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)));
    }
    vorige = huidige;
  }
  return vorige[b.length];
}

/** Komen alle letters van kort in volgorde voor in lang? ('bboys' in 'buitenboys') */
export function isDeelreeks(kort: string, lang: string): boolean {
  if (kort.length < 3) return false;
  let i = 0;
  for (const ch of lang) if (ch === kort[i]) i++;
  return i === kort.length;
}

export interface NaamCheck<T> {
  /** Exact dezelfde (genormaliseerde) naam bestaat al. */
  exact: T | null;
  /** Lijkt sterk op deze bestaande namen. */
  lijktOp: T[];
}

export function controleerNieuweSpeler(voornaam: string, achternaam: string, spelers: Speler[]): NaamCheck<Speler> {
  const sleutel = naamSleutel(voornaam, achternaam);
  const [nv, na] = sleutel.split('|');
  let exact: Speler | null = null;
  const lijktOp: Speler[] = [];
  for (const s of spelers) {
    const sleutels = new Set([naamSleutel(s.voornaam, s.achternaam), ...s.aliassen.map(aliasSleutel)]);
    if (sleutels.has(sleutel)) {
      exact = s;
      continue;
    }
    const lijkt = [...sleutels].some((k) => {
      const [v, a] = k.split('|');
      if (levenshtein(k, sleutel) <= 2) return true;
      if (a && a === na && (v[0] === nv[0] || levenshtein(v, nv) <= 2)) return true;
      if (v && v === nv && na && levenshtein(a, na) <= 2) return true;
      return false;
    });
    if (lijkt) lijktOp.push(s);
  }
  return { exact, lijktOp };
}

export function controleerNieuweTegenstander(naam: string, tegenstanders: Tegenstander[]): NaamCheck<Tegenstander> {
  const sleutel = tegenstanderSleutel(naam);
  let exact: Tegenstander | null = null;
  const lijktOp: Tegenstander[] = [];
  for (const t of tegenstanders) {
    const sleutels = new Set([tegenstanderSleutel(t.naam), ...t.aliassen.map(tegenstanderSleutel)]);
    if (sleutels.has(sleutel)) {
      exact = t;
      continue;
    }
    const lijkt = [...sleutels].some(
      (k) => levenshtein(k, sleutel) <= 2 || isDeelreeks(k, sleutel) || isDeelreeks(sleutel, k),
    );
    if (lijkt) lijktOp.push(t);
  }
  return { exact, lijktOp };
}

/** Zoekfunctie: matcht op delen van de naam, zonder accenten. */
export function matchtZoekterm(tekst: string, zoek: string): boolean {
  const t = zonderAccenten(tekst).toLowerCase();
  return zonderAccenten(zoek)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => t.includes(w));
}

export function slug(s: string): string {
  return zonderAccenten(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function nieuwId(prefix: string, basis: string, bestaand: Set<string>): string {
  const kern = `${prefix}-${slug(basis) || 'x'}`;
  let id = kern;
  for (let i = 2; bestaand.has(id); i++) id = `${kern}-${i}`;
  return id;
}
