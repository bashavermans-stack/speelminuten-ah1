/** Seizoen loopt van juli t/m juni: 2025-09-20 → '2025-2026'. */
export function seizoenVanDatum(iso: string): string {
  const [jaar, maand] = iso.split('-').map(Number);
  const start = maand >= 7 ? jaar : jaar - 1;
  return `${start}-${start + 1}`;
}

/** '2025-2026' → '25-26' */
export function kortSeizoen(seizoen: string): string {
  const [a, b] = seizoen.split('-');
  return `${a.slice(2)}-${b.slice(2)}`;
}

export function startjaar(seizoen: string): number {
  return Number(seizoen.slice(0, 4));
}

export function vandaagIso(nu = new Date()): string {
  const d = new Date(nu.getTime() - nu.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 10);
}

/** Meest recente zaterdag (vandaag als het zaterdag is). */
export function laatsteZaterdag(nu = new Date()): string {
  const d = new Date(nu);
  const terug = (d.getDay() + 1) % 7; // za=6 → 0, zo=0 → 1, ma=1 → 2 ...
  d.setDate(d.getDate() - terug);
  return vandaagIso(d);
}

const MAANDEN = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

/** '2025-09-20' → '20 sep 2025' */
export function datumNl(iso: string, metJaar = true): string {
  const [j, m, d] = iso.split('-').map(Number);
  return `${d} ${MAANDEN[m - 1]}${metJaar ? ` ${j}` : ''}`;
}
