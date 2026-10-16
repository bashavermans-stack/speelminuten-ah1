import { useMemo, useState } from 'react';
import { Balk, Kop, Positie, Sectie, Tegel, getal } from '../componenten/ui';
import { useDataset } from '../data';
import { matchtZoekterm } from '../lib/namen';
import { datumNl, kortSeizoen } from '../lib/seizoen';
import { spelerNaam, uitslag } from '../stats/dataset';
import { berekenSpelerStats, maakRanglijst, RANGLIJSTEN } from '../stats/statistiek';
import { scoreTekst } from './Wedstrijden';

export function Tegenstanders() {
  const data = useDataset();
  const [zoek, setZoek] = useState('');
  const perTegenstander = useMemo(() => {
    const m = new Map<string, { aantal: number; laatste: string }>();
    for (const w of data.wedstrijden) m.set(w.tegenstanderId, { aantal: (m.get(w.tegenstanderId)?.aantal ?? 0) + 1, laatste: w.seizoen });
    return m;
  }, [data]);
  const lijst = data.tegenstanders
    .filter((t) => !zoek || matchtZoekterm(`${t.naam} ${t.aliassen.join(' ')}`, zoek))
    .sort((a, b) => (perTegenstander.get(b.id)?.aantal ?? 0) - (perTegenstander.get(a.id)?.aantal ?? 0) || a.naam.localeCompare(b.naam, 'nl'));
  return (
    <>
      <Kop terugKnop titel="Tegenstanders" sub={`${data.tegenstanders.length} clubs`} />
      <Sectie><input type="search" placeholder="Zoek tegenstander…" value={zoek} onChange={(e) => setZoek(e.target.value)} aria-label="Zoek tegenstander" /></Sectie>
      <Sectie>
        <div className="kaart">
          <ul className="lijst">
            {lijst.map((t) => (
              <li key={t.id}>
                <a className="item" href={`#/tegenstander/${t.id}`}>
                  <div className="hoofd">
                    <div className="naam">{t.naam}</div>
                    <div className="detail">laatst in {perTegenstander.get(t.id) ? kortSeizoen(perTegenstander.get(t.id)!.laatste) : '-'}</div>
                  </div>
                  <div className="waarde">{perTegenstander.get(t.id)?.aantal ?? 0}<small>duels</small></div>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </Sectie>
    </>
  );
}

export function TegenstanderDetail({ id }: { id: string }) {
  const data = useDataset();
  const t = data.tegenstander.get(id);
  const filter = useMemo(() => ({ seizoen: 'alle', tegenstanderId: id, thuisUit: 'alle' as const }), [id]);
  const stats = useMemo(() => berekenSpelerStats(data, filter), [data, filter]);
  const top = useMemo(() => maakRanglijst(data, filter, RANGLIJSTEN[0], stats).slice(0, 15), [data, filter, stats]);
  if (!t) return <><Kop terugKnop titel="Tegenstander" /><p className="leeg">Niet gevonden.</p></>;
  const duels = data.wedstrijden.filter((w) => w.tegenstanderId === id).reverse();
  const u = duels.map(uitslag);
  const metUitslag = u.filter(Boolean).length;
  return (
    <>
      <Kop terugKnop titel={t.naam} sub={t.aliassen.length ? `In de Excel: ${t.aliassen.join(', ')}` : undefined} />
      <Sectie>
        <div className="tegels">
          <Tegel getal={duels.length} label="duels" />
          <Tegel getal={stats.size} label="spelers ingezet" />
          {metUitslag > 0 && <Tegel getal={`${u.filter((x) => x === 'W').length}-${u.filter((x) => x === 'G').length}-${u.filter((x) => x === 'V').length}`} label="W-G-V" />}
        </div>
      </Sectie>
      <Sectie titel={`Meeste minuten tegen ${t.naam}`}>
        <div className="kaart">
          <ol className="lijst">
            {top.map((r, i) => (
              <li key={r.spelerId}>
                <a className="item" href={`#/speler/${r.spelerId}`}>
                  <Positie n={i + 1} />
                  <div className="hoofd">
                    <div className="naam">{spelerNaam(data, r.spelerId)}</div>
                    <div className="detail">{r.stats.wedstrijden} duels</div>
                    <Balk waarde={r.waarde} max={top[0].waarde} />
                  </div>
                  <div className="waarde">{getal(r.waarde)}<small>min</small></div>
                </a>
              </li>
            ))}
          </ol>
        </div>
      </Sectie>
      <Sectie titel="Alle duels">
        <div className="kaart">
          <ul className="lijst">
            {duels.map((w) => (
              <li key={w.id}>
                <a className="item" href={`#/wedstrijd/${w.id}`}>
                  <div className="hoofd"><div className="naam">{datumNl(w.datum)}</div><div className="detail">seizoen {w.seizoen}{w.thuisUit ? ` · ${w.thuisUit}` : ''}</div></div>
                  {uitslag(w) && <span className={`badge ${uitslag(w)}`}>{scoreTekst(w)}</span>}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </Sectie>
    </>
  );
}
