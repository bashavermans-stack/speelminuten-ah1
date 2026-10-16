import { useMemo } from 'react';
import { Kop, Sectie, getal } from '../componenten/ui';
import { useDataset } from '../data';
import { datumNl } from '../lib/seizoen';
import { spelerNaam, tegenstanderNaam } from '../stats/dataset';
import { MIJLPALEN_MINUTEN, MIJLPALEN_WEDSTRIJDEN, mijlpalen, records } from '../stats/extra';

export function Records() {
  const data = useDataset();
  const lijst = useMemo(() => records(data), [data]);
  const { behaald, binnenkort } = useMemo(() => mijlpalen(data), [data]);
  const wedTekst = (id: string) => {
    const w = data.wedstrijd.get(id);
    return w ? `${tegenstanderNaam(data, w.tegenstanderId)}, ${datumNl(w.datum)}` : id;
  };
  const clubs = [
    ...[...MIJLPALEN_MINUTEN].reverse().map((g) => ({ titel: `${getal(g)}-minutenclub`, soort: 'minuten' as const, g })),
    ...[...MIJLPALEN_WEDSTRIJDEN].reverse().map((g) => ({ titel: `${g} wedstrijden`, soort: 'wedstrijden' as const, g })),
  ];
  const getoond = new Set<string>();

  return (
    <>
      <Kop terugKnop titel="Records & mijlpalen" />
      <Sectie titel="Records">
        <div className="kaart">
          <ul className="lijst">
            {lijst.map((r) => {
              const href = r.soort === 'speler' ? `#/speler/${r.wie}` : r.soort === 'seizoen' ? `#/seizoen/${r.wie}` : `#/wedstrijd/${r.wie}`;
              const wie = r.soort === 'speler' ? spelerNaam(data, r.wie) : r.soort === 'seizoen' ? `Seizoen ${r.wie}` : wedTekst(r.wie);
              const toelichting = r.toelichting?.startsWith('w-') || data.wedstrijd.has(r.toelichting ?? '') ? wedTekst(r.toelichting!) : r.toelichting;
              return (
                <li key={r.titel}>
                  <a className="item" href={href}>
                    <div className="hoofd">
                      <div className="detail">{r.titel}</div>
                      <div className="naam">{wie}</div>
                      {toelichting && <div className="detail">{toelichting}</div>}
                    </div>
                    <div className="waarde">{r.waarde}</div>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </Sectie>
      {binnenkort.length > 0 && (
        <Sectie titel="Binnenkort">
          <div className="kaart">
            <ul className="lijst">
              {binnenkort.map((m) => (
                <li key={m.spelerId + m.soort}>
                  <a className="item" href={`#/speler/${m.spelerId}`}>
                    <div className="hoofd"><div className="naam">{spelerNaam(data, m.spelerId)}</div><div className="detail">{getal(m.huidig)} → {getal(m.grens)} {m.soort}</div></div>
                    <div className="waarde">nog {getal(m.nogNodig)}<small>{m.soort === 'minuten' ? 'min' : 'wed'}</small></div>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </Sectie>
      )}
      {clubs.map((club) => {
        const leden = behaald.filter((m) => m.soort === club.soort && m.grens === club.g && !getoond.has(`${m.soort}|${m.spelerId}`));
        leden.forEach((m) => getoond.add(`${m.soort}|${m.spelerId}`));
        if (!leden.length) return null;
        return (
          <Sectie key={club.titel} titel={`${club.titel} (${leden.length})`}>
            <div className="kaart pad">
              {leden.map((m, i) => (
                <span key={m.spelerId}>
                  {i > 0 && ', '}
                  <a href={`#/speler/${m.spelerId}`}><b>{spelerNaam(data, m.spelerId)}</b></a> <span className="klein">{getal(m.huidig)}</span>
                </span>
              ))}
            </div>
          </Sectie>
        );
      })}
    </>
  );
}
