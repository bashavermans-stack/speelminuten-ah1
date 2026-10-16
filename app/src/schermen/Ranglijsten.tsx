import { useMemo, useState } from 'react';
import { FilterBalk } from '../componenten/FilterBalk';
import { Balk, Geschat, Kop, Positie, Sectie, getal } from '../componenten/ui';
import { useData, useDataset } from '../data';
import { maakBackup } from '../lib/backup';
import { datumNl } from '../lib/seizoen';
import { spelerNaam, tegenstanderNaam, uitslag } from '../stats/dataset';
import { mijlpalen } from '../stats/extra';
import { GEEN_FILTER, RANGLIJSTEN, type Filter, berekenSpelerStats, maakRanglijst } from '../stats/statistiek';
import { useBewaardeState } from '../lib/bewaar';

export function Ranglijsten() {
  const data = useDataset();
  const { wijzigingenSindsBackup, herlaad } = useData();
  const [bewaardFilter, setFilter] = useBewaardeState<Filter>('ranglijst-filter', GEEN_FILTER);
  // een bewaard filter kan verwijzen naar een seizoen/tegenstander die niet meer bestaat
  const filter: Filter = {
    seizoen: data.seizoenen.includes(bewaardFilter.seizoen) ? bewaardFilter.seizoen : 'alle',
    tegenstanderId: data.tegenstander.has(bewaardFilter.tegenstanderId) ? bewaardFilter.tegenstanderId : 'alle',
    thuisUit: bewaardFilter.thuisUit ?? 'alle',
  };
  const [sleutel, setSleutel] = useBewaardeState('ranglijst-soort', 'minuten');
  const [alles, setAlles] = useState(false);

  const beschikbaar = useMemo(() => {
    const heeftGoals = data.gebeurtenissen.some((g) => g.type === 'doelpunt');
    const heeftGeel = data.gebeurtenissen.some((g) => g.type === 'geel');
    const heeftUitslag = data.wedstrijden.filter((w) => uitslag(w)).length >= 5;
    return RANGLIJSTEN.filter((r) => {
      if (r.sleutel === 'doelpunten') return heeftGoals;
      if (r.sleutel === 'geel') return heeftGeel;
      if (r.sleutel === 'winst' || r.sleutel === 'punten') return heeftUitslag;
      return true;
    });
  }, [data]);
  const r = beschikbaar.find((x) => x.sleutel === sleutel) ?? beschikbaar[0];
  const filterSleutel = JSON.stringify(filter);
  const stats = useMemo(() => berekenSpelerStats(data, filter), [data, filterSleutel]);
  const lijst = useMemo(() => maakRanglijst(data, filter, r, stats), [data, filterSleutel, r, stats]);
  const { binnenkort } = useMemo(() => mijlpalen(data), [data]);
  const laatste = data.wedstrijden[data.wedstrijden.length - 1];
  const max = lijst[0]?.waarde ?? 0;
  const zichtbaar = alles ? lijst : lijst.slice(0, 25);
  const fmt = r.formaat ?? getal;

  return (
    <>
      <Kop titel="Ranglijsten" sub="AmstelveenHeemraad 1" />
      {wijzigingenSindsBackup >= 3 && (
        <Sectie>
          <div className="melding">
            <span>{wijzigingenSindsBackup} wijzigingen sinds de laatste back-up.</span>
            <button className="knop klein" onClick={async () => { await maakBackup().catch(() => undefined); await herlaad(); }}>Back-up</button>
          </div>
        </Sectie>
      )}
      {laatste && filter.seizoen === 'alle' && filter.tegenstanderId === 'alle' && (
        <Sectie>
          <a className="kaart pad rij-tussen" href={`#/wedstrijd/${laatste.id}`}>
            <div>
              <div className="klein">Laatste wedstrijd · {datumNl(laatste.datum)}</div>
              <div style={{ fontWeight: 600 }}>
                {laatste.thuisUit === 'uit' ? `${tegenstanderNaam(data, laatste.tegenstanderId)} – AH` : `AH – ${tegenstanderNaam(data, laatste.tegenstanderId)}`}
              </div>
            </div>
            {uitslag(laatste) && (
              <span className={`badge ${uitslag(laatste)}`}>
                {laatste.thuisUit === 'uit' ? `${laatste.doelpuntenTegen}-${laatste.doelpuntenVoor}` : `${laatste.doelpuntenVoor}-${laatste.doelpuntenTegen}`}
              </span>
            )}
          </a>
          {binnenkort.length > 0 && (
            <a className="kaart pad" href="#/records" style={{ display: 'block' }}>
              <div className="klein" style={{ marginBottom: 4 }}>Binnenkort een mijlpaal</div>
              {binnenkort.slice(0, 3).map((m) => (
                <div key={m.spelerId + m.soort} style={{ fontSize: '0.92rem' }}>
                  <b>{spelerNaam(data, m.spelerId)}</b>: nog {getal(m.nogNodig)} {m.soort === 'minuten' ? 'minuten' : m.nogNodig === 1 ? 'wedstrijd' : 'wedstrijden'} tot {getal(m.grens)}
                </div>
              ))}
            </a>
          )}
        </Sectie>
      )}
      <FilterBalk filter={filter} onChange={(f) => { setFilter(f); setAlles(false); }} />
      <div className="chips" role="tablist">
        {beschikbaar.map((x) => (
          <button key={x.sleutel} role="tab" aria-selected={x.sleutel === r.sleutel} className={`chip ${x.sleutel === r.sleutel ? 'aan' : ''}`} onClick={() => { setSleutel(x.sleutel); setAlles(false); }}>
            {x.chip}
          </button>
        ))}
      </div>
      <Sectie titel={<>{r.label}{r.geschat && <Geschat />}</>}>
        {(r.uitleg || r.geschat) && (
          <p className="klein" style={{ margin: '-4px 4px 8px' }}>
            {r.uitleg} {r.geschat && <>Basis/invaller is voor de Excel-jaren geschat uit de minuten. <a href="#/uitleg" style={{ textDecoration: 'underline' }}>Uitleg</a></>}
          </p>
        )}
        <div className="kaart">
          {lijst.length === 0 ? (
            <p className="leeg">Geen gegevens voor deze selectie.</p>
          ) : (
            <ol className="lijst">
              {zichtbaar.map((regel, i) => {
                const s = regel.stats;
                const pos = i > 0 && lijst[i - 1].waarde === regel.waarde ? undefined : i + 1;
                return (
                  <li key={regel.spelerId}>
                    <a className="item" href={`#/speler/${regel.spelerId}`}>
                      {pos ? <Positie n={pos} /> : <span className="positie" />}
                      <div className="hoofd">
                        <div className="naam">{spelerNaam(data, regel.spelerId)}</div>
                        <div className="detail">
                          {getal(s.wedstrijden)} wed · {getal(s.minuten)} min{s.seizoenen > 1 ? ` · ${s.seizoenen} seizoenen` : ''}
                        </div>
                        <Balk waarde={regel.waarde} max={max} />
                      </div>
                      <div className="waarde">{fmt(regel.waarde)}<small>{r.kort}</small></div>
                    </a>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
        {!alles && lijst.length > 25 && (
          <button className="knop breed" style={{ marginTop: 10 }} onClick={() => setAlles(true)}>Toon alle {lijst.length}</button>
        )}
      </Sectie>
    </>
  );
}
