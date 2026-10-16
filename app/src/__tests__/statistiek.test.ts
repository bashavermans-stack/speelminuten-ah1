import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { valideerBestand } from '../lib/backup';
import { maakDataset } from '../stats/dataset';
import { duos, langsteReeks, mijlpalen, records, seizoenOverzicht, speeltMee } from '../stats/extra';
import { GEEN_FILTER, RANGLIJSTEN, berekenSpelerStats, maakRanglijst } from '../stats/statistiek';
import type { DataBestand } from '../types';

const mini: DataBestand = {
  versie: 1,
  gegenereerd: '',
  bron: 'test',
  spelers: [
    { id: 'p-a', voornaam: 'A', achternaam: 'A', naam: 'A A', keeper: true, actief: true, aliassen: [] },
    { id: 'p-b', voornaam: 'B', achternaam: 'B', naam: 'B B', keeper: false, actief: true, aliassen: [] },
  ],
  tegenstanders: [
    { id: 't-x', naam: 'X', aliassen: [] },
    { id: 't-y', naam: 'Y', aliassen: [] },
  ],
  wedstrijden: [
    { id: 'w1', seizoen: '2024-2025', datum: '2024-09-01', tegenstanderId: 't-x', thuisUit: 'thuis', doelpuntenVoor: 2, doelpuntenTegen: 0, bron: 'app' },
    { id: 'w2', seizoen: '2024-2025', datum: '2024-09-08', tegenstanderId: 't-y', thuisUit: 'uit', doelpuntenVoor: 1, doelpuntenTegen: 1, bron: 'app' },
    { id: 'w3', seizoen: '2025-2026', datum: '2025-09-07', tegenstanderId: 't-x', thuisUit: null, doelpuntenVoor: null, doelpuntenTegen: null, bron: 'excel' },
  ],
  deelnames: [
    { wedstrijdId: 'w1', spelerId: 'p-a', minuten: 90, basis: true, gewisseld: false, basisBron: 'exact' },
    { wedstrijdId: 'w1', spelerId: 'p-b', minuten: 20, basis: false, gewisseld: false, basisBron: 'exact' },
    { wedstrijdId: 'w2', spelerId: 'p-a', minuten: 90, basis: true, gewisseld: false, basisBron: 'exact' },
    { wedstrijdId: 'w2', spelerId: 'p-b', minuten: 70, basis: true, gewisseld: true, basisBron: 'exact' },
    { wedstrijdId: 'w3', spelerId: 'p-a', minuten: 90, basis: true, gewisseld: false, basisBron: 'geschat' },
  ],
  gebeurtenissen: [
    { id: 'g1', wedstrijdId: 'w1', type: 'doelpunt', minuut: 10, spelerId: 'p-b' },
    { id: 'g2', wedstrijdId: 'w1', type: 'doelpunt', minuut: 80, spelerId: null },
    { id: 'g3', wedstrijdId: 'w2', type: 'geel', minuut: null, spelerId: 'p-b' },
  ],
  seizoenstotalen: [{ seizoen: '2023-2024', spelerId: 'p-b', minuten: 100, wedstrijden: 2, opmerking: 'test' }],
};

describe('statistieken (kleine dataset)', () => {
  const data = maakDataset(mini);
  it('telt minuten, basis, invalbeurten en wissels', () => {
    const s = berekenSpelerStats(data, GEEN_FILTER);
    expect(s.get('p-a')).toMatchObject({ minuten: 270, wedstrijden: 3, basis: 3, volledig: 3, invalbeurten: 0, seizoenen: 2 });
    expect(s.get('p-b')).toMatchObject({ minuten: 190, wedstrijden: 4, basis: 1, invalbeurten: 1, gewisseld: 1, doelpunten: 1, geel: 1, seizoenen: 2 });
    expect(s.get('p-b')!.zonderDetailMinuten).toBe(100);
  });
  it('filtert op tegenstander (zonder seizoenstotalen)', () => {
    const s = berekenSpelerStats(data, { seizoen: 'alle', tegenstanderId: 't-x', thuisUit: 'alle' });
    expect(s.get('p-a')?.minuten).toBe(180);
    expect(s.get('p-b')?.minuten).toBe(20);
  });
  it('berekent winst en punten in de basis', () => {
    const a = berekenSpelerStats(data, GEEN_FILTER).get('p-a')!;
    expect(a.basisMetUitslag).toBe(2);
    expect(a.basisPunten).toBe(4);
  });
  it('maakt ranglijsten in de juiste volgorde', () => {
    const r = maakRanglijst(data, GEEN_FILTER, RANGLIJSTEN.find((x) => x.sleutel === 'minuten')!);
    expect(r.map((x) => x.spelerId)).toEqual(['p-a', 'p-b']);
  });
  it('vindt reeksen, duo’s en seizoensoverzichten', () => {
    expect(langsteReeks(data, 'p-a', speeltMee).lengte).toBe(3);
    expect(duos(data, GEEN_FILTER)[0]).toMatchObject({ wedstrijden: 2, samenBasis: 1 });
    expect(seizoenOverzicht(data, '2024-2025')).toMatchObject({ winst: 1, gelijk: 1, voor: 3, tegen: 1, spelersGebruikt: 2 });
  });
});

const echtBestand = resolve(__dirname, '../../../data/voetbal-data.json');
describe.skipIf(!existsSync(echtBestand))('echte data uit de Excel', () => {
  const data = existsSync(echtBestand) ? maakDataset(valideerBestand(JSON.parse(readFileSync(echtBestand, 'utf-8')))) : maakDataset(mini);
  // Geen namen of totalen per speler hier (openbare repository); die controle doet import/controlerapport.md.
  it('is intern consistent', () => {
    for (const d of data.deelnames) {
      expect(data.speler.has(d.spelerId)).toBe(true);
      expect(data.wedstrijd.has(d.wedstrijdId)).toBe(true);
      expect(d.minuten).toBeGreaterThan(0);
      expect(d.minuten).toBeLessThanOrEqual(90);
    }
    for (const w of data.wedstrijden) {
      const som = data.deelnamesPerWedstrijd.get(w.id)!.reduce((s, d) => s + d.minuten, 0);
      expect(som).toBeLessThanOrEqual(990);
    }
    const totaal = [...berekenSpelerStats(data, GEEN_FILTER).values()].reduce((s, x) => s + x.minuten, 0);
    const verwacht = data.deelnames.reduce((s, d) => s + d.minuten, 0) + data.seizoenstotalen.reduce((s, t) => s + t.minuten, 0);
    expect(totaal).toBe(verwacht);
  });
  it('heeft per wedstrijd precies 11 basisspelers', () => {
    for (const w of data.wedstrijden) expect(data.deelnamesPerWedstrijd.get(w.id)!.filter((d) => d.basis).length).toBe(11);
  });
  it('kan records en mijlpalen berekenen', () => {
    expect(records(data).length).toBeGreaterThan(5);
    expect(mijlpalen(data).behaald.some((m) => m.soort === 'minuten' && m.grens === 10000)).toBe(true);
  });
});
