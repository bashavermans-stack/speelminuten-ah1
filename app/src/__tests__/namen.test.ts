import { describe, expect, it } from 'vitest';
import { controleerNieuweSpeler, controleerNieuweTegenstander, naamSleutel } from '../lib/namen';
import { datumNl, laatsteZaterdag, seizoenVanDatum } from '../lib/seizoen';
import type { Speler, Tegenstander } from '../types';

// Verzonnen namen: deze repository is openbaar.
const sp = (voornaam: string, achternaam: string, aliassen: string[] = []): Speler => ({
  id: `p-${voornaam}-${achternaam}`.toLowerCase(),
  voornaam,
  achternaam,
  naam: `${voornaam} ${achternaam}`,
  keeper: false,
  actief: true,
  aliassen,
});
const spelers = [sp('Noël', 'Janssen', ['Noel | Janssen (A1)']), sp('Kees', 'vd Berg'), sp('Tom', 'Visser'), sp('Bram', 'Visser')];

describe('naamSleutel', () => {
  it('negeert accenten, tussenvoegsels en labels', () => {
    expect(naamSleutel('Noël', 'Janssen')).toBe(naamSleutel('Noel', 'Janssen (A1)'));
    expect(naamSleutel('Kees', 'van der Berg')).toBe(naamSleutel('Kees vd', 'Berg'));
  });
});

describe('controleerNieuweSpeler', () => {
  it('herkent exact dezelfde speler', () => {
    expect(controleerNieuweSpeler('noel', 'janssen', spelers).exact?.naam).toBe('Noël Janssen');
    expect(controleerNieuweSpeler('Kees', 'van der Berg', spelers).exact?.naam).toBe('Kees vd Berg');
  });
  it('waarschuwt bij een tikfout', () => {
    const r = controleerNieuweSpeler('Noel', 'Jansen', spelers);
    expect(r.exact).toBeNull();
    expect(r.lijktOp.map((s) => s.naam)).toContain('Noël Janssen');
  });
  it('laat een echt nieuwe speler door', () => {
    const r = controleerNieuweSpeler('Sem', 'de Vries', spelers);
    expect(r.exact).toBeNull();
    expect(r.lijktOp).toEqual([]);
  });
  it('broers met dezelfde achternaam zijn geen exacte dubbel', () => {
    expect(controleerNieuweSpeler('Rik', 'Visser', spelers).exact).toBeNull();
  });
});

describe('controleerNieuweTegenstander', () => {
  const t: Tegenstander[] = [
    { id: 't-buitenboys', naam: 'Buitenboys', aliassen: ["B'boys"] },
    { id: 't-amvj', naam: 'AMVJ', aliassen: [] },
  ];
  it('herkent aliassen en afkortingen', () => {
    expect(controleerNieuweTegenstander("b'boys", t).exact?.id).toBe('t-buitenboys');
    expect(controleerNieuweTegenstander('Buitenboy', t).lijktOp.map((x) => x.id)).toContain('t-buitenboys');
    expect(controleerNieuweTegenstander('Hercules', t)).toEqual({ exact: null, lijktOp: [] });
  });
});

describe('seizoen', () => {
  it('bepaalt het seizoen uit de datum', () => {
    expect(seizoenVanDatum('2025-09-20')).toBe('2025-2026');
    expect(seizoenVanDatum('2026-05-09')).toBe('2025-2026');
    expect(seizoenVanDatum('2026-07-01')).toBe('2026-2027');
  });
  it('vindt de laatste zaterdag', () => {
    expect(laatsteZaterdag(new Date(2026, 9, 16))).toBe('2026-10-10'); // vrijdag
    expect(laatsteZaterdag(new Date(2026, 9, 17))).toBe('2026-10-17'); // zaterdag
  });
  it('schrijft datums in het Nederlands', () => {
    expect(datumNl('2025-09-20')).toBe('20 sep 2025');
  });
});
