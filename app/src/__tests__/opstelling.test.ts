import { describe, expect, it } from 'vitest';
import { berekenMinuten, opVeldOp } from '../lib/opstelling';

const basis = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'];

describe('berekenMinuten', () => {
  it('geeft de basis 90 minuten zonder wissels', () => {
    const { perSpeler, fouten } = berekenMinuten(basis, [], []);
    expect(fouten).toEqual([]);
    expect([...perSpeler.values()].every((s) => s.minuten === 90 && s.basis && !s.gewisseld)).toBe(true);
  });

  it('verdeelt minuten bij een wissel', () => {
    const { perSpeler } = berekenMinuten(basis, [{ id: '1', minuut: 65, uit: 'a', in: 'x' }], []);
    expect(perSpeler.get('a')).toMatchObject({ minuten: 65, basis: true, gewisseld: true });
    expect(perSpeler.get('x')).toMatchObject({ minuten: 25, basis: false, gewisseld: false });
  });

  it('kan een invaller weer wisselen', () => {
    const { perSpeler } = berekenMinuten(
      basis,
      [
        { id: '1', minuut: 30, uit: 'a', in: 'x' },
        { id: '2', minuut: 80, uit: 'x', in: 'y' },
      ],
      [],
    );
    expect(perSpeler.get('x')?.minuten).toBe(50);
    expect(perSpeler.get('x')?.gewisseld).toBe(false); // invaller, geen basisspeler
    expect(perSpeler.get('y')?.minuten).toBe(10);
  });

  it('verwerkt een rode kaart zonder vervanger', () => {
    const { perSpeler } = berekenMinuten(basis, [], [{ id: 'r', type: 'rood', minuut: 70, spelerId: 'b' }]);
    expect(perSpeler.get('b')).toMatchObject({ minuten: 70, rood: true, gewisseld: false });
    const totaal = [...perSpeler.values()].reduce((s, x) => s + x.minuten, 0);
    expect(totaal).toBe(10 * 90 + 70);
  });

  it('geeft een invaller op minuut 90 minimaal 1 minuut', () => {
    const { perSpeler } = berekenMinuten(basis, [{ id: '1', minuut: 90, uit: 'a', in: 'x' }], []);
    expect(perSpeler.get('x')?.minuten).toBe(1);
  });

  it('meldt fouten in het verloop', () => {
    const { fouten } = berekenMinuten(basis, [{ id: '1', minuut: 50, uit: 'zz', in: 'x' }], []);
    expect(fouten[0]).toContain('niet in het veld');
    expect(berekenMinuten(basis.slice(0, 10), [], []).fouten[0]).toContain('10 spelers');
  });

  it('weet wie er op een moment in het veld staat', () => {
    const veld = opVeldOp(basis, [{ id: '1', minuut: 60, uit: 'a', in: 'x' }], [], 70);
    expect(veld.has('a')).toBe(false);
    expect(veld.has('x')).toBe(true);
  });
});
