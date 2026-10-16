import { useMemo } from 'react';
import { Kop, Sectie, getal } from '../componenten/ui';
import { useDataset } from '../data';
import { kortSeizoen } from '../lib/seizoen';
import { ga } from '../router';
import { GEEN_FILTER, berekenSpelerStats, seizoensRijen, type SpelerStats } from '../stats/statistiek';
import { duos } from '../stats/extra';

const REGELS: { label: string; waarde: (s: SpelerStats) => number; fmt?: (n: number) => string }[] = [
  { label: 'Minuten', waarde: (s) => s.minuten },
  { label: 'Wedstrijden', waarde: (s) => s.wedstrijden },
  { label: 'Seizoenen', waarde: (s) => s.seizoenen },
  { label: 'Basis ≈', waarde: (s) => s.basis },
  { label: 'Invalbeurten ≈', waarde: (s) => s.invalbeurten },
  { label: 'Gewisseld ≈', waarde: (s) => s.gewisseld },
  { label: "Volledig (90')", waarde: (s) => s.volledig },
  { label: 'Gem. minuten', waarde: (s) => s.gemMinuten, fmt: (n) => String(Math.round(n)) },
  { label: '% beschikbare min.', waarde: (s) => s.percentage, fmt: (n) => `${Math.round(n)}%` },
  { label: 'Doelpunten', waarde: (s) => s.doelpunten },
];

export function Vergelijk({ a, b }: { a?: string; b?: string }) {
  const data = useDataset();
  const stats = useMemo(() => berekenSpelerStats(data, GEEN_FILTER), [data]);
  const spelers = [...data.spelers].sort((x, y) => (stats.get(y.id)?.minuten ?? 0) - (stats.get(x.id)?.minuten ?? 0));
  const sa = a ? stats.get(a) : undefined;
  const sb = b ? stats.get(b) : undefined;
  const samen = useMemo(() => (a && b ? duos(data, GEEN_FILTER, a).find((d) => d.a === b || d.b === b)?.wedstrijden ?? 0 : 0), [data, a, b]);
  const rijenA = a ? seizoensRijen(data, a) : [];
  const rijenB = b ? seizoensRijen(data, b) : [];
  const seizoenen = [...new Set([...rijenA, ...rijenB].map((r) => r.seizoen))].sort();
  const kies = (welke: 'a' | 'b', id: string) => ga(`#/vergelijk/${welke === 'a' ? id : a ?? '-'}/${welke === 'b' ? id : b ?? '-'}`);

  const Keuze = ({ welke, waarde }: { welke: 'a' | 'b'; waarde?: string }) => (
    <select aria-label={`Speler ${welke.toUpperCase()}`} value={waarde && waarde !== '-' ? waarde : ''} onChange={(e) => kies(welke, e.target.value)}>
      <option value="">Kies speler…</option>
      {spelers.map((s) => <option key={s.id} value={s.id}>{s.naam}</option>)}
    </select>
  );

  return (
    <>
      <Kop terugKnop titel="Vergelijk spelers" />
      <div className="filters">
        <Keuze welke="a" waarde={a} />
        <Keuze welke="b" waarde={b} />
      </div>
      {sa && sb && (
        <>
          <Sectie>
            <div className="kaart tabel-wrap">
              <table className="tabel">
                <thead><tr><th /><th>{data.speler.get(a!)?.voornaam}</th><th>{data.speler.get(b!)?.voornaam}</th></tr></thead>
                <tbody>
                  {REGELS.map((r) => {
                    const x = r.waarde(sa);
                    const y = r.waarde(sb);
                    const f = r.fmt ?? getal;
                    return (
                      <tr key={r.label}>
                        <td>{r.label}</td>
                        <td style={{ fontWeight: x > y ? 700 : 400 }}>{f(x)}</td>
                        <td style={{ fontWeight: y > x ? 700 : 400 }}>{f(y)}</td>
                      </tr>
                    );
                  })}
                  <tr><td>Samen gespeeld</td><td colSpan={2} style={{ textAlign: 'center' }}>{samen} wedstrijden</td></tr>
                </tbody>
              </table>
            </div>
          </Sectie>
          <Sectie titel="Minuten per seizoen">
            <div className="kaart tabel-wrap">
              <table className="tabel">
                <thead><tr><th>Seizoen</th><th>{data.speler.get(a!)?.voornaam}</th><th>{data.speler.get(b!)?.voornaam}</th></tr></thead>
                <tbody>
                  {seizoenen.map((sz) => (
                    <tr key={sz}>
                      <td>{kortSeizoen(sz)}</td>
                      <td>{getal(rijenA.find((r) => r.seizoen === sz)?.minuten ?? 0)}</td>
                      <td>{getal(rijenB.find((r) => r.seizoen === sz)?.minuten ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Sectie>
        </>
      )}
      {!(sa && sb) && <p className="leeg">Kies twee spelers om te vergelijken.</p>}
    </>
  );
}
