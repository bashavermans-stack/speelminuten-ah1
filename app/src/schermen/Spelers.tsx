import { useMemo, useState } from 'react';
import { Kop, Sectie, Segment, getal } from '../componenten/ui';
import { useDataset } from '../data';
import { useBewaardeState } from '../lib/bewaar';
import { matchtZoekterm } from '../lib/namen';
import { kortSeizoen } from '../lib/seizoen';
import { GEEN_FILTER, berekenSpelerStats } from '../stats/statistiek';

type Groep = 'actief' | 'alle' | 'keepers';

export function Spelers() {
  const data = useDataset();
  const [zoek, setZoek] = useState('');
  const [groep, setGroep] = useBewaardeState<Groep>('spelers-groep', 'actief');
  const stats = useMemo(() => berekenSpelerStats(data, GEEN_FILTER), [data]);
  const periode = useMemo(() => {
    const m = new Map<string, { van: string; tot: string }>();
    for (const w of data.wedstrijden)
      for (const d of data.deelnamesPerWedstrijd.get(w.id) ?? []) {
        const p = m.get(d.spelerId);
        if (!p) m.set(d.spelerId, { van: w.seizoen, tot: w.seizoen });
        else p.tot = w.seizoen;
      }
    for (const t of data.seizoenstotalen) {
      const p = m.get(t.spelerId);
      if (!p) m.set(t.spelerId, { van: t.seizoen, tot: t.seizoen });
      else if (t.seizoen < p.van) p.van = t.seizoen;
    }
    return m;
  }, [data]);

  const lijst = data.spelers
    .filter((s) => (zoek ? matchtZoekterm(`${s.naam} ${s.aliassen.join(' ')}`, zoek) : groep === 'alle' || (groep === 'actief' ? s.actief : s.keeper)))
    .sort((a, b) => (stats.get(b.id)?.minuten ?? 0) - (stats.get(a.id)?.minuten ?? 0));

  return (
    <>
      <Kop titel="Spelers" sub={`${data.spelers.length} spelers sinds ${data.seizoenen[0] ?? '-'}`} acties={<a href="#/vergelijk">Vergelijk</a>} />
      <Sectie>
        <input type="search" placeholder="Zoek speler…" value={zoek} onChange={(e) => setZoek(e.target.value)} aria-label="Zoek speler" />
        {!zoek && (
          <div style={{ marginTop: 8 }}>
            <Segment<Groep> waarde={groep} onChange={setGroep} opties={[{ waarde: 'actief', label: 'Huidige selectie' }, { waarde: 'alle', label: 'Iedereen' }, { waarde: 'keepers', label: 'Keepers' }]} />
          </div>
        )}
      </Sectie>
      <Sectie titel={`${lijst.length} spelers`}>
        <div className="kaart">
          {lijst.length === 0 ? (
            <p className="leeg">Geen spelers gevonden.</p>
          ) : (
            <ul className="lijst">
              {lijst.map((s) => {
                const st = stats.get(s.id);
                const p = periode.get(s.id);
                return (
                  <li key={s.id}>
                    <a className="item" href={`#/speler/${s.id}`}>
                      <div className="hoofd">
                        <div className="naam">
                          {s.naam} {s.keeper && <span className="badge grijs">K</span>}
                        </div>
                        <div className="detail">
                          {p ? (p.van === p.tot ? kortSeizoen(p.van) : `${kortSeizoen(p.van)} t/m ${kortSeizoen(p.tot)}`) : 'nog niet gespeeld'}
                          {st ? ` · ${getal(st.wedstrijden)} wed` : ''}
                        </div>
                      </div>
                      <div className="waarde">{getal(st?.minuten ?? 0)}<small>min</small></div>
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
