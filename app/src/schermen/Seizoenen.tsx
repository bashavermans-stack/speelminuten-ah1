import { useMemo } from 'react';
import { Kop, Sectie, Tegel, aantal, getal, toast } from '../componenten/ui';
import { useDataset } from '../data';
import { exporteerSeizoenCsv } from '../lib/backup';
import { datumNl } from '../lib/seizoen';
import { spelerNaam, tegenstanderNaam } from '../stats/dataset';
import { eersteSeizoenPerSpeler, seizoenOverzicht } from '../stats/extra';
import { berekenSpelerStats, maakRanglijst, RANGLIJSTEN } from '../stats/statistiek';

export function Seizoenen() {
  const data = useDataset();
  const overzichten = useMemo(() => {
    const eerste = eersteSeizoenPerSpeler(data);
    return [...data.seizoenen].reverse().map((s) => seizoenOverzicht(data, s, eerste));
  }, [data]);
  return (
    <>
      <Kop terugKnop titel="Seizoenen" sub="2011-12 ontbreekt in de Excel" />
      <Sectie>
        <div className="kaart">
          <ul className="lijst">
            {overzichten.map((o) => (
              <li key={o.seizoen}>
                <a className="item" href={`#/seizoen/${o.seizoen}`}>
                  <div className="hoofd">
                    <div className="naam">{o.seizoen}</div>
                    <div className="detail">
                      {aantal(o.wedstrijden.length, 'wedstrijd', 'wedstrijden')} · {aantal(o.spelersGebruikt, 'speler', 'spelers')} · {aantal(o.debutanten.length, 'debutant', 'debutanten')}
                      {o.ijzerenMan && ` · ijzeren man ${spelerNaam(data, o.ijzerenMan.spelerId)}`}
                    </div>
                  </div>
                  <span aria-hidden="true">›</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </Sectie>
    </>
  );
}

export function SeizoenDetail({ seizoen }: { seizoen: string }) {
  const data = useDataset();
  const o = useMemo(() => seizoenOverzicht(data, seizoen), [data, seizoen]);
  const filter = useMemo(() => ({ seizoen, tegenstanderId: 'alle', thuisUit: 'alle' as const }), [seizoen]);
  const stats = useMemo(() => berekenSpelerStats(data, filter), [data, filter]);
  const spelers = useMemo(() => maakRanglijst(data, filter, RANGLIJSTEN[0], stats), [data, filter, stats]);
  const topInval = useMemo(() => maakRanglijst(data, filter, RANGLIJSTEN.find((r) => r.sleutel === 'invalbeurten')!, stats)[0], [data, filter, stats]);
  const minuten = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of o.wedstrijden) for (const d of data.deelnamesPerWedstrijd.get(w.id) ?? []) m.set(`${d.spelerId}|${w.id}`, d.minuten);
    return m;
  }, [data, o]);
  const metUitslag = o.winst + o.gelijk + o.verlies;
  const kleur = (min: number | undefined) =>
    min == null ? undefined : { background: `color-mix(in srgb, var(--accent) ${Math.round(20 + (80 * min) / 90)}%, transparent)`, color: min >= 60 ? '#fff' : undefined };

  return (
    <>
      <Kop terugKnop titel={`Seizoen ${seizoen}`} acties={<button onClick={() => exporteerSeizoenCsv(data, seizoen).catch(() => toast('Exporteren geannuleerd'))}>CSV</button>} />
      <Sectie>
        <div className="tegels">
          <Tegel getal={o.wedstrijden.length} label="wedstrijden" />
          <Tegel getal={o.spelersGebruikt} label="spelers gebruikt" />
          <Tegel getal={o.debutanten.length} label="debutanten" />
          {metUitslag > 0 && <Tegel getal={`${o.winst}-${o.gelijk}-${o.verlies}`} label="W-G-V" />}
          {metUitslag > 0 && <Tegel getal={`${o.voor}-${o.tegen}`} label="doelsaldo" />}
          {metUitslag > 0 && <Tegel getal={o.winst * 3 + o.gelijk} label="punten" />}
        </div>
      </Sectie>
      <Sectie titel="Hoogtepunten">
        <div className="kaart">
          <ul className="lijst">
            {o.ijzerenMan && <li><a className="item" href={`#/speler/${o.ijzerenMan.spelerId}`}><div className="hoofd"><div className="detail">IJzeren man</div><div className="naam">{spelerNaam(data, o.ijzerenMan.spelerId)} · {getal(o.ijzerenMan.minuten)} min</div></div></a></li>}
            {topInval && <li><a className="item" href={`#/speler/${topInval.spelerId}`}><div className="hoofd"><div className="detail">Meeste invalbeurten ≈</div><div className="naam">{spelerNaam(data, topInval.spelerId)} · {topInval.waarde}×</div></div></a></li>}
            {o.debutanten.length > 0 && <li><div className="item" style={{ cursor: 'default' }}><div className="hoofd"><div className="detail">Debutanten</div><div>{o.debutanten.map((id) => spelerNaam(data, id)).join(', ')}</div></div></div></li>}
          </ul>
        </div>
      </Sectie>
      {o.wedstrijden.length > 0 && (
        <Sectie titel="Speelminuten per wedstrijd">
          <div className="kaart pad tabel-wrap">
            <table className="matrix">
              <thead>
                <tr>
                  <th />
                  {o.wedstrijden.map((w) => <th key={w.id} className="draai" title={datumNl(w.datum)}><a href={`#/wedstrijd/${w.id}`}>{tegenstanderNaam(data, w.tegenstanderId).slice(0, 10)}</a></th>)}
                  <th className="draai">totaal</th>
                </tr>
              </thead>
              <tbody>
                {spelers.map((r) => (
                  <tr key={r.spelerId}>
                    <td className="naam"><a href={`#/speler/${r.spelerId}`}>{spelerNaam(data, r.spelerId)}</a></td>
                    {o.wedstrijden.map((w) => {
                      const m = minuten.get(`${r.spelerId}|${w.id}`);
                      return <td key={w.id} style={kleur(m)}>{m ?? ''}</td>;
                    })}
                    <td style={{ fontWeight: 650, width: 'auto', paddingLeft: 6 }}>{getal(r.waarde)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Sectie>
      )}
    </>
  );
}
