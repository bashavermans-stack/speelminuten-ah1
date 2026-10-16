import { useState } from 'react';
import { Kop, Modal, Sectie, toast } from '../componenten/ui';
import { verwijderWedstrijd } from '../db';
import { useData, useDataset } from '../data';
import { datumNl } from '../lib/seizoen';
import { ga } from '../router';
import { spelerNaam, tegenstanderNaam, uitslag } from '../stats/dataset';
import type { Deelname, Gebeurtenis } from '../types';
import { scoreTekst } from './Wedstrijden';

export function WedstrijdDetail({ id }: { id: string }) {
  const data = useDataset();
  const { herlaad } = useData();
  const [verwijderen, setVerwijderen] = useState(false);
  const w = data.wedstrijd.get(id);
  if (!w) return <><Kop titel="Wedstrijd" terugKnop /><p className="leeg">Wedstrijd niet gevonden.</p></>;

  const deelnames = [...(data.deelnamesPerWedstrijd.get(id) ?? [])].sort((a, b) => b.minuten - a.minuten || spelerNaam(data, a.spelerId).localeCompare(spelerNaam(data, b.spelerId)));
  const basis = deelnames.filter((d) => d.basis);
  const invallers = deelnames.filter((d) => !d.basis);
  const gebeurtenissen = [...(data.gebeurtenissenPerWedstrijd.get(id) ?? [])].sort((a, b) => (a.minuut ?? 99) - (b.minuut ?? 99));
  const goals = new Map<string, number>();
  const kaarten = new Map<string, Gebeurtenis['type'][]>();
  for (const g of gebeurtenissen) {
    if (!g.spelerId) continue;
    if (g.type === 'doelpunt') goals.set(g.spelerId, (goals.get(g.spelerId) ?? 0) + 1);
    if (g.type === 'geel' || g.type === 'rood') kaarten.set(g.spelerId, [...(kaarten.get(g.spelerId) ?? []), g.type]);
  }
  const geschat = deelnames.some((d) => d.basisBron === 'geschat');
  const tegen = tegenstanderNaam(data, w.tegenstanderId);
  const u = uitslag(w);

  const Rij = ({ d }: { d: Deelname }) => (
    <li>
      <a className="item" href={`#/speler/${d.spelerId}`}>
        <div className="hoofd">
          <div className="naam">
            {spelerNaam(data, d.spelerId)}
            {(goals.get(d.spelerId) ?? 0) > 0 && <span> {'⚽'.repeat(goals.get(d.spelerId)!)}</span>}
            {kaarten.get(d.spelerId)?.map((k, i) => <span key={i}> <span className={`kaartje ${k}`} /></span>)}
          </div>
          {d.gewisseld && <div className="detail">gewisseld</div>}
        </div>
        <div className="waarde">{d.minuten}'</div>
      </a>
    </li>
  );

  return (
    <>
      <Kop
        terugKnop
        titel={w.thuisUit === 'uit' ? `${tegen} – AH` : `AH – ${tegen}`}
        sub={`${datumNl(w.datum)}${w.thuisUit ? ` · ${w.thuisUit}` : ''} · seizoen ${w.seizoen}`}
        acties={<a href={`#/invoeren/${w.id}`}>Bewerk</a>}
      />
      <Sectie>
        <div className="kaart pad rij-tussen">
          <div>
            <div className="klein">Uitslag</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{scoreTekst(w) ?? '–'}</div>
          </div>
          {u ? <span className={`badge ${u}`}>{u === 'W' ? 'Gewonnen' : u === 'G' ? 'Gelijk' : 'Verloren'}</span> : <a className="knop klein" href={`#/invoeren/${w.id}`}>Uitslag invullen</a>}
        </div>
        {geschat && <p className="klein" style={{ margin: '8px 4px 0' }}>Uit de Excel: basis en invallers zijn geschat uit de speelminuten. <a href="#/uitleg" style={{ textDecoration: 'underline' }}>Uitleg</a></p>}
      </Sectie>
      <Sectie titel={`Basis (${basis.length})`}>
        <div className="kaart"><ul className="lijst">{basis.map((d) => <Rij key={d.spelerId} d={d} />)}</ul></div>
      </Sectie>
      {invallers.length > 0 && (
        <Sectie titel={`Invallers (${invallers.length})`}>
          <div className="kaart"><ul className="lijst">{invallers.map((d) => <Rij key={d.spelerId} d={d} />)}</ul></div>
        </Sectie>
      )}
      {w.bank && w.bank.length > 0 && (
        <Sectie titel="Op de bank, niet ingevallen">
          <div className="kaart pad">{w.bank.map((s) => spelerNaam(data, s)).join(', ')}</div>
        </Sectie>
      )}
      {gebeurtenissen.length > 0 && (
        <Sectie titel="Verloop">
          <div className="kaart verloop">
            <ul className="lijst">
              {gebeurtenissen.map((g) => (
                <li key={g.id}>
                  <div className="item">
                    <span className="min">{g.minuut != null ? `${g.minuut}'` : ''}</span>
                    <div className="hoofd">
                      {g.type === 'wissel' && <>🔁 <b>{spelerNaam(data, g.spelerInId)}</b> erin voor {spelerNaam(data, g.spelerId)}</>}
                      {g.type === 'doelpunt' && <>⚽ {g.spelerId ? <b>{spelerNaam(data, g.spelerId)}</b> : 'Eigen doelpunt tegenstander'}</>}
                      {(g.type === 'geel' || g.type === 'rood') && <><span className={`kaartje ${g.type}`} /> {spelerNaam(data, g.spelerId)}{g.opmerking && g.opmerking !== g.type ? <span className="klein"> · {g.opmerking}</span> : null}</>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Sectie>
      )}
      <Sectie>
        <div className="knoppen" style={{ marginTop: 8 }}>
          <a className="knop" href={`#/tegenstander/${w.tegenstanderId}`}>Alle duels met {tegen}</a>
          <button className="knop gevaar" onClick={() => setVerwijderen(true)}>Verwijderen</button>
        </div>
      </Sectie>
      {verwijderen && (
        <Modal titel="Wedstrijd verwijderen?" onSluit={() => setVerwijderen(false)}>
          <p>De wedstrijd tegen {tegen} van {datumNl(w.datum)} en alle minuten, wissels, doelpunten en kaarten ervan worden verwijderd. Dit kan niet ongedaan worden gemaakt (behalve via een back-up).</p>
          <div className="knoppen">
            <button className="knop" onClick={() => setVerwijderen(false)}>Annuleren</button>
            <button
              className="knop gevaar"
              onClick={async () => {
                await verwijderWedstrijd(w.id);
                await herlaad();
                toast('Wedstrijd verwijderd');
                ga(`#/wedstrijden/${w.seizoen}`);
              }}
            >
              Ja, verwijderen
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
