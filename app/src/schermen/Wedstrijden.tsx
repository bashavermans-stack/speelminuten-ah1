import { Kop, Sectie, aantal } from '../componenten/ui';
import { useDataset } from '../data';
import { datumNl } from '../lib/seizoen';
import { ga } from '../router';
import { tegenstanderNaam, uitslag } from '../stats/dataset';
import type { Wedstrijd } from '../types';

export function scoreTekst(w: Wedstrijd): string | null {
  if (w.doelpuntenVoor == null || w.doelpuntenTegen == null) return null;
  return w.thuisUit === 'uit' ? `${w.doelpuntenTegen}-${w.doelpuntenVoor}` : `${w.doelpuntenVoor}-${w.doelpuntenTegen}`;
}

export function Wedstrijden({ seizoen }: { seizoen?: string }) {
  const data = useDataset();
  const seizoenen = [...new Set(data.wedstrijden.map((w) => w.seizoen))].sort().reverse();
  const gekozen = seizoen && seizoenen.includes(seizoen) ? seizoen : seizoenen[0];
  const lijst = data.wedstrijden.filter((w) => w.seizoen === gekozen).reverse();

  return (
    <>
      <Kop titel="Wedstrijden" sub={gekozen ? `Seizoen ${gekozen}` : undefined} acties={<a href="#/invoeren">+ Nieuw</a>} />
      <Sectie>
        <select aria-label="Seizoen" value={gekozen} onChange={(e) => ga(`#/wedstrijden/${e.target.value}`)}>
          {seizoenen.map((s) => <option key={s} value={s}>Seizoen {s}</option>)}
        </select>
      </Sectie>
      <Sectie titel={aantal(lijst.length, 'wedstrijd', 'wedstrijden')} actie={gekozen && <a className="klein" href={`#/seizoen/${gekozen}`}>Seizoensoverzicht ›</a>}>
        <div className="kaart">
          {lijst.length === 0 ? (
            <p className="leeg">Nog geen wedstrijden. <a href="#/invoeren" style={{ textDecoration: 'underline' }}>Voer de eerste in</a>.</p>
          ) : (
            <ul className="lijst">
              {lijst.map((w) => {
                const u = uitslag(w);
                const n = data.deelnamesPerWedstrijd.get(w.id)?.length ?? 0;
                return (
                  <li key={w.id}>
                    <a className="item" href={`#/wedstrijd/${w.id}`}>
                      <div className="hoofd">
                        <div className="naam">{tegenstanderNaam(data, w.tegenstanderId)}{w.thuisUit && <span className="klein"> · {w.thuisUit}</span>}</div>
                        <div className="detail">{datumNl(w.datum)} · {n} spelers</div>
                      </div>
                      {u && <span className={`badge ${u}`}>{scoreTekst(w)}</span>}
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Sectie>
    </>
  );
}
