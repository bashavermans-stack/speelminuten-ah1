export const WEDSTRIJDDUUR = 90;

export interface WisselInvoer {
  id: string;
  minuut: number;
  uit: string;
  in: string;
}

export interface KaartInvoer {
  id: string;
  type: 'geel' | 'rood';
  minuut: number | null;
  spelerId: string;
  opmerking?: string;
}

export interface DoelpuntInvoer {
  id: string;
  minuut: number | null;
  /** null = eigen doelpunt van de tegenstander */
  spelerId: string | null;
}

export interface SpelerMinuten {
  minuten: number;
  basis: boolean;
  /** Basisspeler die eruit gewisseld is. */
  gewisseld: boolean;
  /** Kreeg rood (of 2x geel). */
  rood: boolean;
}

export interface Berekening {
  perSpeler: Map<string, SpelerMinuten>;
  fouten: string[];
}

/**
 * Berekent speelminuten uit basisopstelling, wissels en rode kaarten.
 * Een wissel op minuut m: speler 'uit' heeft tot m gespeeld, speler 'in' vanaf m.
 * Wie op minuut 90 invalt krijgt minimaal 1 minuut.
 */
export function berekenMinuten(
  basis: string[],
  wissels: WisselInvoer[],
  kaarten: KaartInvoer[],
  namen: (id: string) => string = (id) => id,
): Berekening {
  const fouten: string[] = [];
  const perSpeler = new Map<string, SpelerMinuten>();
  const opVeld = new Map<string, number>(); // speler → minuut van binnenkomst
  for (const id of basis) {
    perSpeler.set(id, { minuten: 0, basis: true, gewisseld: false, rood: false });
    opVeld.set(id, 0);
  }
  if (basis.length !== 11) fouten.push(`Er staan ${basis.length} spelers in de basis (verwacht 11).`);

  type Moment = { minuut: number; volgorde: number; soort: 'wissel'; w: WisselInvoer } | { minuut: number; volgorde: number; soort: 'rood'; k: KaartInvoer };
  const momenten: Moment[] = [
    ...wissels.map((w, i) => ({ minuut: klem(w.minuut), volgorde: i, soort: 'wissel' as const, w })),
    ...kaarten
      .filter((k) => k.type === 'rood')
      .map((k, i) => ({ minuut: klem(k.minuut ?? WEDSTRIJDDUUR), volgorde: 1000 + i, soort: 'rood' as const, k })),
  ].sort((a, b) => a.minuut - b.minuut || a.volgorde - b.volgorde);

  const verlaat = (id: string, minuut: number) => {
    const sinds = opVeld.get(id)!;
    const s = perSpeler.get(id)!;
    s.minuten += Math.max(minuut - sinds, 0);
    opVeld.delete(id);
  };

  for (const m of momenten) {
    if (m.soort === 'wissel') {
      const { uit, in: erin } = m.w;
      if (!opVeld.has(uit)) {
        fouten.push(`Wissel ${m.minuut}': ${namen(uit)} staat op dat moment niet in het veld.`);
        continue;
      }
      if (opVeld.has(erin)) {
        fouten.push(`Wissel ${m.minuut}': ${namen(erin)} staat al in het veld.`);
        continue;
      }
      if (perSpeler.get(erin)?.rood) {
        fouten.push(`Wissel ${m.minuut}': ${namen(erin)} heeft rood gekregen.`);
        continue;
      }
      verlaat(uit, m.minuut);
      const u = perSpeler.get(uit)!;
      if (u.basis) u.gewisseld = true;
      if (!perSpeler.has(erin)) perSpeler.set(erin, { minuten: 0, basis: false, gewisseld: false, rood: false });
      opVeld.set(erin, m.minuut);
    } else {
      const id = m.k.spelerId;
      if (!opVeld.has(id)) {
        fouten.push(`Rood ${m.minuut}': ${namen(id)} staat op dat moment niet in het veld.`);
        continue;
      }
      verlaat(id, m.minuut);
      const s = perSpeler.get(id)!;
      s.rood = true;
      s.gewisseld = false;
    }
  }
  for (const id of [...opVeld.keys()]) verlaat(id, WEDSTRIJDDUUR);
  for (const s of perSpeler.values()) {
    if (!s.basis && s.minuten === 0) s.minuten = 1;
    s.minuten = Math.min(s.minuten, WEDSTRIJDDUUR);
  }
  return { perSpeler, fouten };
}

function klem(minuut: number): number {
  return Math.min(Math.max(Math.round(minuut), 0), WEDSTRIJDDUUR);
}

/** Wie staat er in het veld vlak vóór minuut m (handig voor de keuzelijst bij een nieuwe wissel)? */
export function opVeldOp(basis: string[], wissels: WisselInvoer[], kaarten: KaartInvoer[], minuut: number, negeerId?: string): Set<string> {
  const veld = new Set(basis);
  const momenten = [
    ...wissels.filter((w) => w.id !== negeerId).map((w) => ({ m: w.minuut, f: () => { if (veld.has(w.uit)) { veld.delete(w.uit); veld.add(w.in); } } })),
    ...kaarten.filter((k) => k.type === 'rood' && k.id !== negeerId).map((k) => ({ m: k.minuut ?? WEDSTRIJDDUUR, f: () => veld.delete(k.spelerId) })),
  ].sort((a, b) => a.m - b.m);
  for (const x of momenten) if (x.m <= minuut) x.f();
  return veld;
}
