import { useMemo, useState, type ReactNode } from 'react';
import { Geschat, Kop, Modal, Sectie, Tegel, getal, toast } from '../componenten/ui';
import { bewaarSpeler } from '../db';
import { useData, useDataset } from '../data';
import { controleerNieuweSpeler } from '../lib/namen';
import { datumNl, kortSeizoen } from '../lib/seizoen';
import { spelerNaam, tegenstanderNaam } from '../stats/dataset';
import { MIJLPALEN_MINUTEN, MIJLPALEN_WEDSTRIJDEN, duos, spelerProfiel } from '../stats/extra';
import { GEEN_FILTER, berekenSpelerStats, seizoensRijen } from '../stats/statistiek';
import type { Speler } from '../types';

export function SpelerDetail({ id }: { id: string }) {
  const data = useDataset();
  const speler = data.speler.get(id);
  const [bewerken, setBewerken] = useState(false);
  const [alleWedstrijden, setAlleWedstrijden] = useState(false);
  const st =useMemo(() => berekenSpelerStats(data, GEEN_FILTER).get(id), [data, id]);
  const profiel = useMemo(() => spelerProfiel(data, id), [data, id]);
  const rijen = useMemo(() => seizoensRijen(data, id), [data, id]);
  const maatje = useMemo(() => duos(data, GEEN_FILTER, id)[0], [data, id]);
  if (!speler) return <><Kop titel="Speler" terugKnop /><p className="leeg">Speler niet gevonden.</p></>;

  const kaarten = (st?.geel ?? 0) + (st?.rood ?? 0);
  const maxMin = Math.max(...rijen.map((r) => r.minuten), 1);
  const periode = rijen.length ? (rijen.length === 1 ? rijen[0].seizoen : `${kortSeizoen(rijen[0].seizoen)} t/m ${kortSeizoen(rijen[rijen.length - 1].seizoen)}`) : 'nog niet gespeeld';
  const wedNaam = (wid: string) => {
    const w = data.wedstrijd.get(wid);
    return w ? `${tegenstanderNaam(data, w.tegenstanderId)}, ${datumNl(w.datum)}` : '';
  };
  const volgendeWed = MIJLPALEN_WEDSTRIJDEN.find((g) => g > (st?.wedstrijden ?? 0));
  const volgendeMin = MIJLPALEN_MINUTEN.find((g) => g > (st?.minuten ?? 0));
  const deelnames = [...(data.deelnamesPerSpeler.get(id) ?? [])].sort((a, b) => (data.volgnummer.get(b.wedstrijdId) ?? 0) - (data.volgnummer.get(a.wedstrijdId) ?? 0));

  return (
    <>
      <Kop
        terugKnop
        titel={speler.naam}
        sub={`${speler.keeper ? 'Keeper · ' : ''}${periode}${speler.actief ? '' : ' · niet in huidige selectie'}`}
        acties={<button onClick={() => setBewerken(true)}>Bewerk</button>}
      />
      <Sectie>
        <div className="tegels">
          <Tegel getal={getal(st?.minuten ?? 0)} label="minuten" />
          <Tegel getal={getal(st?.wedstrijden ?? 0)} label="wedstrijden" />
          <Tegel getal={st?.seizoenen ?? 0} label="seizoenen" />
          <Tegel getal={st?.volledig ?? 0} label="volledig (90')" />
          <Tegel getal={st?.basis ?? 0} label="in de basis" geschat={st?.geschat} />
          <Tegel getal={st?.invalbeurten ?? 0} label="invalbeurten" geschat={st?.geschat} />
          <Tegel getal={st?.gewisseld ?? 0} label="gewisseld" geschat={st?.geschat} />
          <Tegel getal={st ? Math.round(st.gemMinuten) : 0} label="gem. minuten" />
          {(st?.doelpunten ?? 0) > 0 && <Tegel getal={st!.doelpunten} label="doelpunten" />}
          {kaarten > 0 && <Tegel getal={<>{st!.geel > 0 && <><span className="kaartje geel" /> {st!.geel} </>}{st!.rood > 0 && <><span className="kaartje rood" /> {st!.rood}</>}</>} label="kaarten" />}
          {st && st.basisMetUitslag >= 3 && <Tegel getal={`${Math.round((100 * st.basisWinst) / st.basisMetUitslag)}%`} label={`winst in basis (${st.basisMetUitslag})`} />}
        </div>
      </Sectie>

      {rijen.length > 0 && (
        <Sectie titel="Minuten per seizoen">
          <div className="kaart pad">
            <div className="staafgrafiek" role="img" aria-label="Minuten per seizoen">
              {rijen.map((r) => (
                <div className="kolom" key={r.seizoen} title={`${r.seizoen}: ${r.minuten} min`}>
                  <div className="wrd">{r.minuten >= 1000 ? `${(r.minuten / 1000).toFixed(1)}k` : r.minuten}</div>
                  <div className={`staaf ${r.zonderDetail ? 'deels' : ''}`} style={{ height: `${(100 * r.minuten) / maxMin}%` }} />
                  <div className="lbl">{kortSeizoen(r.seizoen)}</div>
                </div>
              ))}
            </div>
            {rijen.some((r) => r.zonderDetail) && <p className="klein" style={{ margin: '8px 0 0' }}>Gestreept: deels zonder wedstrijddetail (alleen totaal bekend).</p>}
          </div>
        </Sectie>
      )}

      <Sectie titel="Wist je dat…">
        <div className="kaart">
          <ul className="lijst">
            {profiel.debuut && <Feit label="Debuut" waarde={`${datumNl(profiel.debuut.datum)} tegen ${tegenstanderNaam(data, profiel.debuut.tegenstanderId)}`} href={`#/wedstrijd/${profiel.debuut.id}`} />}
            {profiel.laatste && profiel.laatste.id !== profiel.debuut?.id && <Feit label="Laatste wedstrijd" waarde={`${datumNl(profiel.laatste.datum)} tegen ${tegenstanderNaam(data, profiel.laatste.tegenstanderId)}`} href={`#/wedstrijd/${profiel.laatste.id}`} />}
            {profiel.favoriet && profiel.favoriet.wedstrijden > 1 && <Feit label="Favoriete tegenstander" waarde={`${tegenstanderNaam(data, profiel.favoriet.tegenstanderId)} (${profiel.favoriet.wedstrijden} wed, ${getal(profiel.favoriet.minuten)} min)`} href={`#/tegenstander/${profiel.favoriet.tegenstanderId}`} />}
            {profiel.reeksWedstrijden.lengte > 1 && <Feit label="Langste reeks op rij" waarde={`${profiel.reeksWedstrijden.lengte} wedstrijden (${datumNl(profiel.reeksWedstrijden.van!.datum)} – ${datumNl(profiel.reeksWedstrijden.tot!.datum)})`} />}
            {profiel.reeksVol.lengte > 1 && <Feit label="Langste reeks van 90 minuten" waarde={`${profiel.reeksVol.lengte} wedstrijden`} />}
            {profiel.kortsteInval && <Feit label={<>Kortste invalbeurt{profiel.kortsteInval.geschat && <Geschat />}</>} waarde={`${profiel.kortsteInval.minuten} min (${wedNaam(profiel.kortsteInval.wedstrijd.id)})`} href={`#/wedstrijd/${profiel.kortsteInval.wedstrijd.id}`} />}
            {maatje && <Feit label="Vaakst samen gespeeld met" waarde={`${spelerNaam(data, maatje.a === id ? maatje.b : maatje.a)} (${maatje.wedstrijden} wed)`} href={`#/speler/${maatje.a === id ? maatje.b : maatje.a}`} />}
            {profiel.langsteBank > 1 && <Feit label="Langst op de bank zonder speeltijd" waarde={`${profiel.langsteBank} wedstrijden op rij`} />}
            {(volgendeWed || volgendeMin) && (
              <Feit
                label="Volgende mijlpaal"
                waarde={[volgendeWed && `${volgendeWed} wed (nog ${volgendeWed - (st?.wedstrijden ?? 0)})`, volgendeMin && `${getal(volgendeMin)} min (nog ${getal(volgendeMin - (st?.minuten ?? 0))})`].filter(Boolean).join(' · ')}
              />
            )}
          </ul>
        </div>
      </Sectie>

      {rijen.length > 0 && (
        <Sectie titel="Per seizoen">
          <div className="kaart tabel-wrap">
            <table className="tabel">
              <thead>
                <tr><th>Seizoen</th><th>Wed</th><th>Min</th><th>Basis≈</th><th>In≈</th><th>Uit≈</th><th>90'</th>{rijen.some((r) => r.doelpunten) && <th>Goals</th>}</tr>
              </thead>
              <tbody>
                {[...rijen].reverse().map((r) => (
                  <tr key={r.seizoen}>
                    <td><a href={`#/seizoen/${r.seizoen}`}>{r.seizoen}</a></td>
                    <td>{r.wedstrijden}</td>
                    <td>{getal(r.minuten)}{r.zonderDetail ? '*' : ''}</td>
                    <td>{r.basis}</td>
                    <td>{r.invalbeurten}</td>
                    <td>{r.gewisseld}</td>
                    <td>{r.volledig}</td>
                    {rijen.some((x) => x.doelpunten) && <td>{r.doelpunten}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rijen.some((r) => r.zonderDetail) && <p className="klein" style={{ margin: '6px 4px' }}>* inclusief minuten zonder wedstrijddetail; basis/invallen alleen over wedstrijden met detail.</p>}
        </Sectie>
      )}

      {deelnames.length > 0 && (
        <Sectie titel="Wedstrijden">
          <div className="kaart">
            <ul className="lijst">
              {(alleWedstrijden ? deelnames : deelnames.slice(0, 15)).map((d) => {
                const w = data.wedstrijd.get(d.wedstrijdId)!;
                return (
                  <li key={d.wedstrijdId}>
                    <a className="item" href={`#/wedstrijd/${w.id}`}>
                      <div className="hoofd">
                        <div className="naam">{tegenstanderNaam(data, w.tegenstanderId)}</div>
                        <div className="detail">{datumNl(w.datum)} · {d.basis ? (d.gewisseld ? 'basis, gewisseld' : 'basis') : 'invaller'}{d.basisBron === 'geschat' && d.minuten < 90 ? ' ≈' : ''}</div>
                      </div>
                      <div className="waarde">{d.minuten}'</div>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
          {!alleWedstrijden && deelnames.length > 15 && (
            <button className="knop breed" style={{ marginTop: 10 }} onClick={() => setAlleWedstrijden(true)}>Toon alle {deelnames.length} wedstrijden</button>
          )}
        </Sectie>
      )}
      {bewerken && <BewerkSpeler speler={speler} onSluit={() => setBewerken(false)} />}
    </>
  );
}

function Feit({ label, waarde, href }: { label: ReactNode; waarde: ReactNode; href?: string }) {
  const inhoud = (
    <div className="hoofd">
      <div className="detail">{label}</div>
      <div style={{ fontWeight: 550 }}>{waarde}</div>
    </div>
  );
  return <li>{href ? <a className="item" href={href}>{inhoud}</a> : <div className="item" style={{ cursor: 'default' }}>{inhoud}</div>}</li>;
}

function BewerkSpeler({ speler, onSluit }: { speler: Speler; onSluit: () => void }) {
  const data = useDataset();
  const { herlaad } = useData();
  const [voornaam, setVoornaam] = useState(speler.voornaam);
  const [achternaam, setAchternaam] = useState(speler.achternaam);
  const [keeper, setKeeper] = useState(speler.keeper);
  const [actief, setActief] = useState(speler.actief);
  const check = controleerNieuweSpeler(voornaam, achternaam, data.spelers.filter((s) => s.id !== speler.id));

  async function opslaan() {
    await bewaarSpeler({ ...speler, voornaam: voornaam.trim(), achternaam: achternaam.trim(), naam: `${voornaam.trim()} ${achternaam.trim()}`.trim(), keeper, actief });
    await herlaad();
    toast('Speler opgeslagen');
    onSluit();
  }

  return (
    <Modal titel="Speler bewerken" onSluit={onSluit}>
      <label className="veld"><span>Voornaam</span><input type="text" value={voornaam} onChange={(e) => setVoornaam(e.target.value)} /></label>
      <label className="veld"><span>Achternaam</span><input type="text" value={achternaam} onChange={(e) => setAchternaam(e.target.value)} /></label>
      <label className="rij-tussen" style={{ marginBottom: 12 }}><span>Keeper</span><input type="checkbox" checked={keeper} onChange={(e) => setKeeper(e.target.checked)} /></label>
      <label className="rij-tussen" style={{ marginBottom: 16 }}><span>In huidige selectie (verschijnt bij invoeren)</span><input type="checkbox" checked={actief} onChange={(e) => setActief(e.target.checked)} /></label>
      {check.exact && <p className="melding fout">Er bestaat al een speler met deze naam: {check.exact.naam}. Gebruik "Spelers samenvoegen" bij Meer → Back-up & instellingen.</p>}
      <button className="knop primair breed" disabled={!voornaam.trim() || !!check.exact} onClick={opslaan}>Opslaan</button>
    </Modal>
  );
}
