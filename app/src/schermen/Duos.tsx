import { useMemo } from 'react';
import { FilterBalk } from '../componenten/FilterBalk';
import { Balk, Kop, Positie, Sectie } from '../componenten/ui';
import { useDataset } from '../data';
import { useBewaardeState } from '../lib/bewaar';
import { spelerNaam } from '../stats/dataset';
import { duos } from '../stats/extra';
import { GEEN_FILTER, type Filter } from '../stats/statistiek';

export function Duos() {
  const data = useDataset();
  const [filter, setFilter] = useBewaardeState<Filter>('duos-filter', GEEN_FILTER);
  const lijst = useMemo(() => duos(data, filter).slice(0, 40), [data, filter]);
  return (
    <>
      <Kop terugKnop titel="Duo's" sub="Vaakst samen in dezelfde wedstrijd" />
      <FilterBalk filter={filter} onChange={setFilter} />
      <Sectie>
        <div className="kaart">
          {lijst.length === 0 ? <p className="leeg">Geen gegevens.</p> : (
            <ol className="lijst">
              {lijst.map((d, i) => (
                <li key={d.a + d.b}>
                  <div className="item" style={{ cursor: 'default' }}>
                    <Positie n={i + 1} />
                    <div className="hoofd">
                      <div className="naam"><a href={`#/speler/${d.a}`}>{spelerNaam(data, d.a)}</a> &amp; <a href={`#/speler/${d.b}`}>{spelerNaam(data, d.b)}</a></div>
                      <div className="detail">{d.samenBasis}× samen in de basis ≈</div>
                      <Balk waarde={d.wedstrijden} max={lijst[0].wedstrijden} />
                    </div>
                    <div className="waarde">{d.wedstrijden}<small>wed</small></div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </Sectie>
    </>
  );
}
