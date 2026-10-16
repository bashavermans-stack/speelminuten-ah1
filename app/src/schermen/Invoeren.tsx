import { useEffect, useMemo, useState } from 'react';
import { Kop, Modal, Sectie, Segment, toast } from '../componenten/ui';
import { leesMeta, schrijfMeta, slaWedstrijdOp } from '../db';
import { useData, useDataset } from '../data';
import {
  type DoelpuntInvoer, type KaartInvoer, type WisselInvoer, WEDSTRIJDDUUR, berekenMinuten, opVeldOp,
} from '../lib/opstelling';
import { controleerNieuweSpeler, controleerNieuweTegenstander, matchtZoekterm, nieuwId } from '../lib/namen';
import { datumNl, laatsteZaterdag, seizoenVanDatum } from '../lib/seizoen';
import { ga } from '../router';
import type { Dataset } from '../stats/dataset';
import type { Deelname, Gebeurtenis, Speler, Tegenstander, ThuisUit, Wedstrijd } from '../types';

interface Concept {
  bewerkId?: string;
  bron: 'app' | 'excel';
  datum: string;
  tegenstanderId: string | null;
  nieuweTegenstander: Tegenstander | null;
  thuisUit: ThuisUit;
  voor: string;
  tegen: string;
  selectie: string[];
  nieuweSpelers: Speler[];
  basis: string[];
  wissels: WisselInvoer[];
  kaarten: KaartInvoer[];
  doelpunten: DoelpuntInvoer[];
  handmatig: Record<string, number>;
  opmerking?: string;
  stap: number;
}

const STAPPEN = ['Wedstrijd', 'Selectie', 'Basis', 'Verloop', 'Controle'];
const nieuwConcept = (): Concept => ({
  bron: 'app', datum: laatsteZaterdag(), tegenstanderId: null, nieuweTegenstander: null, thuisUit: null, voor: '', tegen: '',
  selectie: [], nieuweSpelers: [], basis: [], wissels: [], kaarten: [], doelpunten: [], handmatig: {}, stap: 0,
});
const uid = () => Math.random().toString(36).slice(2, 10);

function conceptUitWedstrijd(data: Dataset, w: Wedstrijd): Concept {
  const ds = data.deelnamesPerWedstrijd.get(w.id) ?? [];
  const gs = data.gebeurtenissenPerWedstrijd.get(w.id) ?? [];
  const c: Concept = {
    bewerkId: w.id, bron: w.bron, datum: w.datum, tegenstanderId: w.tegenstanderId, nieuweTegenstander: null, thuisUit: w.thuisUit,
    voor: w.doelpuntenVoor?.toString() ?? '', tegen: w.doelpuntenTegen?.toString() ?? '',
    selectie: [...ds.map((d) => d.spelerId), ...(w.bank ?? [])], nieuweSpelers: [], basis: ds.filter((d) => d.basis).map((d) => d.spelerId),
    wissels: gs.filter((g) => g.type === 'wissel' && g.spelerId && g.spelerInId).map((g) => ({ id: g.id, minuut: g.minuut ?? 0, uit: g.spelerId!, in: g.spelerInId! })),
    kaarten: gs.filter((g) => (g.type === 'geel' || g.type === 'rood') && g.spelerId).map((g) => ({ id: g.id, type: g.type as 'geel' | 'rood', minuut: g.minuut, spelerId: g.spelerId!, opmerking: g.opmerking })),
    doelpunten: gs.filter((g) => g.type === 'doelpunt').map((g) => ({ id: g.id, minuut: g.minuut, spelerId: g.spelerId })),
    handmatig: {}, opmerking: w.opmerking, stap: 0,
  };
  const berekend = berekenMinuten(c.basis, c.wissels, c.kaarten).perSpeler;
  for (const d of ds) if (berekend.get(d.spelerId)?.minuten !== d.minuten) c.handmatig[d.spelerId] = d.minuten;
  return c;
}

export function Invoeren({ bewerkId }: { bewerkId?: string }) {
  const data = useDataset();
  const { herlaad } = useData();
  const bestaand = bewerkId ? data.wedstrijd.get(bewerkId) : undefined;
  const [c, setC] = useState<Concept | null>(bestaand ? conceptUitWedstrijd(data, bestaand) : null);
  const [opslaan, setOpslaan] = useState(false);

  useEffect(() => {
    if (bewerkId) return;
    leesMeta<Concept | null>('concept', null).then((k) => setC(k ?? nieuwConcept()));
  }, [bewerkId]);
  useEffect(() => {
    if (c && !c.bewerkId) schrijfMeta('concept', c);
  }, [c]);

  if (bewerkId && !bestaand) return <><Kop titel="Bewerken" terugKnop /><p className="leeg">Wedstrijd niet gevonden.</p></>;
  if (!c) return <Kop titel="Nieuwe wedstrijd" />;

  const zet = (p: Partial<Concept> | ((oud: Concept) => Partial<Concept>)) => setC((oud) => ({ ...oud!, ...(typeof p === 'function' ? p(oud!) : p) }));
  const alleSpelers = [...data.spelers, ...c.nieuweSpelers];
  const spelerMap = new Map(alleSpelers.map((s) => [s.id, s]));
  const naam = (id: string | null) => (id ? spelerMap.get(id)?.naam ?? '?' : 'Eigen doelpunt tegenstander');
  const tegenstanderNaam = c.nieuweTegenstander?.id === c.tegenstanderId ? c.nieuweTegenstander?.naam : data.tegenstander.get(c.tegenstanderId ?? '')?.naam;
  const kanVerder = [!!c.tegenstanderId && !!c.datum, c.selectie.length > 0, c.basis.length > 0, true, true][c.stap];

  async function bewaar() {
    if (!c) return;
    setOpslaan(true);
    try {
      const opslag = maakOpslag(data, c);
      await slaWedstrijdOp(opslag);
      if (!c.bewerkId) await schrijfMeta('concept', null);
      await herlaad();
      toast(c.bewerkId ? 'Wedstrijd bijgewerkt' : 'Wedstrijd opgeslagen');
      ga(`#/wedstrijd/${opslag.wedstrijd.id}`);
    } finally {
      setOpslaan(false);
    }
  }

  return (
    <div className="met-onderbalk">
      <Kop
        terugKnop={!!c.bewerkId}
        titel={c.bewerkId ? 'Wedstrijd bewerken' : 'Nieuwe wedstrijd'}
        sub={`${STAPPEN[c.stap]}${tegenstanderNaam ? ` · ${tegenstanderNaam}, ${datumNl(c.datum, false)}` : ''}`}
        acties={!c.bewerkId && (c.tegenstanderId || c.selectie.length > 0) ? <button onClick={() => setC(nieuwConcept())}>Opnieuw</button> : undefined}
      />
      <div className="stappen" aria-hidden="true">{STAPPEN.map((s, i) => <span key={s} className={i <= c.stap ? 'klaar' : ''} />)}</div>
      {c.stap === 0 && <StapWedstrijd c={c} zet={zet} />}
      {c.stap === 1 && <StapSelectie c={c} zet={zet} />}
      {c.stap === 2 && <StapBasis c={c} zet={zet} naam={naam} spelerMap={spelerMap} />}
      {c.stap === 3 && <StapVerloop c={c} zet={zet} naam={naam} />}
      {c.stap === 4 && <StapControle c={c} zet={zet} naam={naam} />}
      <div className="onderbalk">
        <div className="binnen">
          {c.stap > 0 && <button className="knop" onClick={() => zet({ stap: c.stap - 1 })}>Vorige</button>}
          {c.stap < STAPPEN.length - 1 ? (
            <button className="knop primair" disabled={!kanVerder} onClick={() => zet({ stap: c.stap + 1 })}>Volgende: {STAPPEN[c.stap + 1]}</button>
          ) : (
            <button className="knop primair" disabled={opslaan} onClick={bewaar}>{opslaan ? 'Opslaan…' : 'Opslaan'}</button>
          )}
        </div>
      </div>
    </div>
  );
}

type StapProps = { c: Concept; zet: (p: Partial<Concept> | ((oud: Concept) => Partial<Concept>)) => void };

// ---------------------------------------------------------------- stap 1: wedstrijd

function StapWedstrijd({ c, zet }: StapProps) {
  const data = useDataset();
  const [zoek, setZoek] = useState('');
  const [twijfel, setTwijfel] = useState<{ naam: string; opties: Tegenstander[] } | null>(null);
  const seizoen = seizoenVanDatum(c.datum || laatsteZaterdag());
  const alle = [...data.tegenstanders, ...(c.nieuweTegenstander ? [c.nieuweTegenstander] : [])];
  const recenteSeizoenen = new Set([seizoen, ...data.seizoenen.filter((sz) => sz <= seizoen).slice(-2)]);
  const ditSeizoen = new Set(data.wedstrijden.filter((w) => recenteSeizoenen.has(w.seizoen)).map((w) => w.tegenstanderId));
  const gekozen = alle.find((t) => t.id === c.tegenstanderId);
  const gefilterd = alle
    .filter((t) => !zoek || matchtZoekterm(`${t.naam} ${t.aliassen.join(' ')}`, zoek))
    .sort((a, b) => Number(ditSeizoen.has(b.id)) - Number(ditSeizoen.has(a.id)) || a.naam.localeCompare(b.naam, 'nl'));
  const dubbel = data.wedstrijden.find((w) => w.datum === c.datum && w.tegenstanderId === c.tegenstanderId && w.id !== c.bewerkId);

  const kies = (t: Tegenstander) => {
    zet({ tegenstanderId: t.id });
    setZoek('');
    setTwijfel(null);
  };
  const maakNieuw = (naam: string) => {
    const t: Tegenstander = { id: nieuwId('t', naam, new Set(data.tegenstanders.map((x) => x.id))), naam: naam.trim(), aliassen: [] };
    zet({ nieuweTegenstander: t, tegenstanderId: t.id });
    setZoek('');
    setTwijfel(null);
  };
  const probeerNieuw = () => {
    const check = controleerNieuweTegenstander(zoek, alle);
    if (check.exact) kies(check.exact);
    else if (check.lijktOp.length) setTwijfel({ naam: zoek.trim(), opties: check.lijktOp });
    else maakNieuw(zoek);
  };

  return (
    <>
      <Sectie titel="Datum">
        <input type="date" value={c.datum} onChange={(e) => zet({ datum: e.target.value })} aria-label="Datum" />
        <p className="klein" style={{ margin: '6px 4px 0' }}>Seizoen {seizoen}</p>
      </Sectie>
      <Sectie titel="Tegenstander">
        {gekozen ? (
          <div className="kaart pad rij-tussen">
            <b>{gekozen.naam}</b>
            <button className="knop klein" onClick={() => zet({ tegenstanderId: null })}>Wijzig</button>
          </div>
        ) : (
          <>
            <input type="search" placeholder="Zoek of typ een nieuwe tegenstander…" value={zoek} onChange={(e) => setZoek(e.target.value)} aria-label="Zoek tegenstander" />
            {zoek.trim() && !gefilterd.some((t) => t.naam.toLowerCase() === zoek.trim().toLowerCase()) && (
              <button className="knop breed" style={{ marginTop: 8 }} onClick={probeerNieuw}>+ "{zoek.trim()}" toevoegen als nieuwe tegenstander</button>
            )}
            <div className="kaart" style={{ marginTop: 8, maxHeight: 330, overflowY: 'auto' }}>
              <ul className="lijst">
                {gefilterd.slice(0, 60).map((t) => (
                  <li key={t.id}>
                    <button className="item" onClick={() => kies(t)}>
                      <div className="hoofd"><div className="naam">{t.naam}</div></div>
                      {ditSeizoen.has(t.id) && <span className="badge grijs">recent</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
        {dubbel && <p className="melding" style={{ marginTop: 8 }}>Let op: er staat al een wedstrijd tegen deze tegenstander op deze datum.</p>}
      </Sectie>
      <Sectie titel="Thuis of uit">
        <Segment<'thuis' | 'uit' | 'onbekend'> waarde={c.thuisUit ?? 'onbekend'} onChange={(w) => zet({ thuisUit: w === 'onbekend' ? null : w })} opties={[{ waarde: 'thuis', label: 'Thuis' }, { waarde: 'uit', label: 'Uit' }, { waarde: 'onbekend', label: 'Onbekend' }]} />
      </Sectie>
      <Sectie titel="Uitslag (mag ook later)">
        <div className="rij-tussen">
          <label className="veld" style={{ flex: 1, margin: 0 }}><span>AH</span><input type="number" inputMode="numeric" min={0} value={c.voor} onChange={(e) => zet({ voor: e.target.value })} /></label>
          <span style={{ paddingTop: 20, fontWeight: 700 }}>–</span>
          <label className="veld" style={{ flex: 1, margin: 0 }}><span>{gekozen?.naam ?? 'Tegenstander'}</span><input type="number" inputMode="numeric" min={0} value={c.tegen} onChange={(e) => zet({ tegen: e.target.value })} /></label>
        </div>
      </Sectie>
      {twijfel && (
        <Modal titel="Bestaat deze tegenstander al?" onSluit={() => setTwijfel(null)}>
          <p>"{twijfel.naam}" lijkt op:</p>
          <div className="kaart"><ul className="lijst">{twijfel.opties.map((t) => <li key={t.id}><button className="item" onClick={() => kies(t)}><div className="hoofd"><div className="naam">Ja, {t.naam}</div><div className="detail">{t.aliassen.slice(0, 4).join(', ')}</div></div></button></li>)}</ul></div>
          <button className="knop breed" style={{ marginTop: 12 }} onClick={() => maakNieuw(twijfel.naam)}>Nee, "{twijfel.naam}" is echt een nieuwe tegenstander</button>
        </Modal>
      )}
    </>
  );
}

// ---------------------------------------------------------------- stap 2: selectie

/** Sorteert spelers op minuten in de laatste twee seizoenen (vaste spelers bovenaan). */
function useSorteerOpRecent() {
  const data = useDataset();
  const recenteMinuten = useMemo(() => {
    const m = new Map<string, number>();
    const seizoenen = new Set(data.seizoenen.slice(-2));
    for (const d of data.deelnames) if (seizoenen.has(data.wedstrijd.get(d.wedstrijdId)?.seizoen ?? '')) m.set(d.spelerId, (m.get(d.spelerId) ?? 0) + d.minuten);
    return m;
  }, [data]);
  return (a: Pick<Speler, 'id' | 'naam'>, b: Pick<Speler, 'id' | 'naam'>) =>
    (recenteMinuten.get(b.id) ?? 0) - (recenteMinuten.get(a.id) ?? 0) || a.naam.localeCompare(b.naam, 'nl');
}

function StapSelectie({ c, zet }: StapProps) {
  const data = useDataset();
  const [zoek, setZoek] = useState('');
  const [nieuw, setNieuw] = useState(false);
  const geselecteerd = new Set(c.selectie);
  const alle = [...data.spelers, ...c.nieuweSpelers];
  const voorDatum = data.wedstrijden.filter((w) => w.datum < c.datum && w.id !== c.bewerkId);
  const vorige = voorDatum[voorDatum.length - 1];
  const vorigSeizoen = vorige?.seizoen ?? data.laatsteSeizoen;
  const sorteer = useSorteerOpRecent();
  const kern = alle.filter((s) => s.actief || geselecteerd.has(s.id) || c.nieuweSpelers.includes(s)).sort(sorteer);
  const zoekResultaat = zoek ? alle.filter((s) => !kern.includes(s) && matchtZoekterm(`${s.naam} ${s.aliassen.join(' ')}`, zoek)).sort(sorteer) : [];

  const toggle = (id: string) =>
    zet((oud) =>
      oud.selectie.includes(id) ? { selectie: oud.selectie.filter((x) => x !== id), basis: oud.basis.filter((x) => x !== id) } : { selectie: [...oud.selectie, id] },
    );
  const neemOver = (ids: string[]) => zet((oud) => ({ selectie: [...new Set([...oud.selectie, ...ids])] }));
  const vanVorige = vorige ? [...(data.deelnamesPerWedstrijd.get(vorige.id) ?? []).map((d) => d.spelerId), ...(vorige.bank ?? [])] : [];
  const vanSeizoen = [...new Set(data.wedstrijden.filter((w) => w.seizoen === vorigSeizoen).flatMap((w) => (data.deelnamesPerWedstrijd.get(w.id) ?? []).map((d) => d.spelerId)))];

  return (
    <>
      <Sectie>
        <div className="knoppen">
          {vorige && <button className="knop klein" onClick={() => neemOver(vanVorige)}>Zelfde als vorige wedstrijd ({vanVorige.length})</button>}
          {vorigSeizoen && <button className="knop klein" onClick={() => neemOver(vanSeizoen)}>Iedereen van {vorigSeizoen} ({vanSeizoen.length})</button>}
          {c.selectie.length > 0 && <button className="knop klein gevaar" onClick={() => zet({ selectie: [], basis: [] })}>Wis</button>}
        </div>
      </Sectie>
      <Sectie titel={<>Selectie: <span className="teller">{c.selectie.length}</span> spelers</>} actie={<button className="knop klein" onClick={() => setNieuw(true)}>+ Nieuwe speler</button>}>
        <div className="kaart">
          <ul className="lijst">
            {kern.map((s) => (
              <li key={s.id}>
                <button className="item" onClick={() => toggle(s.id)} aria-pressed={geselecteerd.has(s.id)}>
                  <span className={`vink ${geselecteerd.has(s.id) ? 'aan' : ''}`}>{geselecteerd.has(s.id) ? '✓' : ''}</span>
                  <div className="hoofd">
                    <div className="naam">{s.naam} {s.keeper && <span className="badge grijs">K</span>} {c.nieuweSpelers.includes(s) && <span className="badge">nieuw</span>}</div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </Sectie>
      <Sectie titel="Oud-speler terughalen">
        <input type="search" placeholder="Zoek in alle spelers sinds 2010…" value={zoek} onChange={(e) => setZoek(e.target.value)} aria-label="Zoek oud-speler" />
        {zoekResultaat.length > 0 && (
          <div className="kaart" style={{ marginTop: 8 }}>
            <ul className="lijst">
              {zoekResultaat.slice(0, 20).map((s) => (
                <li key={s.id}><button className="item" onClick={() => { toggle(s.id); setZoek(''); }}><span className="vink" /><div className="hoofd"><div className="naam">{s.naam}</div></div></button></li>
              ))}
            </ul>
          </div>
        )}
        {zoek && zoekResultaat.length === 0 && <p className="klein" style={{ margin: '8px 4px' }}>Niemand gevonden. Gebruik "+ Nieuwe speler".</p>}
      </Sectie>
      {nieuw && (
        <NieuweSpeler
          bestaand={alle}
          onSluit={() => setNieuw(false)}
          onKies={(id) => { if (!geselecteerd.has(id)) zet({ selectie: [...c.selectie, id] }); setNieuw(false); }}
          onNieuw={(s) => { zet({ nieuweSpelers: [...c.nieuweSpelers, s], selectie: [...c.selectie, s.id] }); setNieuw(false); }}
        />
      )}
    </>
  );
}

function NieuweSpeler({ bestaand, onSluit, onKies, onNieuw }: { bestaand: Speler[]; onSluit: () => void; onKies: (id: string) => void; onNieuw: (s: Speler) => void }) {
  const [voornaam, setVoornaam] = useState('');
  const [achternaam, setAchternaam] = useState('');
  const [keeper, setKeeper] = useState(false);
  const [gecontroleerd, setGecontroleerd] = useState(false);
  const check = controleerNieuweSpeler(voornaam, achternaam, bestaand);
  const maak = () => {
    const v = voornaam.trim();
    const a = achternaam.trim();
    onNieuw({ id: nieuwId('p', `${v} ${a}`, new Set(bestaand.map((s) => s.id))), voornaam: v, achternaam: a, naam: `${v} ${a}`.trim(), keeper, actief: true, aliassen: [] });
  };
  const toevoegen = () => {
    if (check.exact) return;
    if (check.lijktOp.length && !gecontroleerd) setGecontroleerd(true);
    else maak();
  };
  return (
    <Modal titel="Nieuwe speler" onSluit={onSluit}>
      <label className="veld"><span>Voornaam</span><input type="text" autoFocus value={voornaam} onChange={(e) => { setVoornaam(e.target.value); setGecontroleerd(false); }} autoCapitalize="words" /></label>
      <label className="veld"><span>Achternaam (met tussenvoegsel, bijv. "van Dijk")</span><input type="text" value={achternaam} onChange={(e) => { setAchternaam(e.target.value); setGecontroleerd(false); }} autoCapitalize="words" /></label>
      <label className="rij-tussen" style={{ marginBottom: 14 }}><span>Keeper</span><input type="checkbox" checked={keeper} onChange={(e) => setKeeper(e.target.checked)} /></label>
      {check.exact && (
        <div className="melding fout" style={{ marginBottom: 12 }}>
          <span>{check.exact.naam} bestaat al.</span>
          <button className="knop klein" onClick={() => onKies(check.exact!.id)}>Selecteer</button>
        </div>
      )}
      {!check.exact && gecontroleerd && check.lijktOp.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ margin: '0 0 8px' }}><b>Bedoel je een van deze spelers?</b></p>
          <div className="kaart"><ul className="lijst">{check.lijktOp.map((s) => <li key={s.id}><button className="item" onClick={() => onKies(s.id)}><div className="hoofd"><div className="naam">Ja, {s.naam}</div><div className="detail">{s.aliassen.slice(0, 3).join(' · ')}</div></div></button></li>)}</ul></div>
        </div>
      )}
      <button className="knop primair breed" disabled={!voornaam.trim() || !!check.exact} onClick={toevoegen}>
        {gecontroleerd && check.lijktOp.length ? `Nee, ${`${voornaam} ${achternaam}`.trim()} is echt nieuw` : 'Toevoegen'}
      </button>
    </Modal>
  );
}

// ---------------------------------------------------------------- stap 3: basis

function StapBasis({ c, zet, naam, spelerMap }: StapProps & { naam: (id: string) => string; spelerMap: Map<string, Speler> }) {
  const basis = new Set(c.basis);
  const sorteer = useSorteerOpRecent();
  const volgorde = [...c.selectie].sort((a, b) => sorteer({ id: a, naam: naam(a) }, { id: b, naam: naam(b) }));
  const toggle = (id: string) =>
    zet((oud) =>
      oud.basis.includes(id) ? { basis: oud.basis.filter((x) => x !== id), wissels: oud.wissels.filter((w) => w.uit !== id) } : { basis: [...oud.basis, id] },
    );
  const keepers = c.basis.filter((id) => spelerMap.get(id)?.keeper).length;
  return (
    <Sectie titel={<>Basis: <span className="teller">{c.basis.length}</span>/11</>}>
      <p className="klein" style={{ margin: '0 4px 8px' }}>Tik de 11 basisspelers aan; de rest zit op de bank.</p>
      {c.basis.length > 11 && <p className="melding" style={{ marginBottom: 8 }}>Er staan meer dan 11 spelers in de basis.</p>}
      {c.basis.length === 11 && keepers === 0 && [...spelerMap.values()].some((s) => s.keeper && c.selectie.includes(s.id)) && <p className="melding" style={{ marginBottom: 8 }}>Geen keeper in de basis?</p>}
      <div className="kaart">
        <ul className="lijst">
          {volgorde.map((id) => (
            <li key={id}>
              <button className="item" onClick={() => toggle(id)} aria-pressed={basis.has(id)}>
                <span className={`vink ${basis.has(id) ? 'basis' : ''}`}>{basis.has(id) ? '✓' : ''}</span>
                <div className="hoofd"><div className="naam">{naam(id)} {spelerMap.get(id)?.keeper && <span className="badge grijs">K</span>}</div></div>
                <span className="klein">{basis.has(id) ? 'basis' : 'bank'}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Sectie>
  );
}

// ---------------------------------------------------------------- stap 4: verloop

type Soort = 'wissel' | 'doelpunt' | 'geel' | 'rood';

function StapVerloop({ c, zet, naam }: StapProps & { naam: (id: string | null) => string }) {
  const [modal, setModal] = useState<Soort | null>(null);
  const { fouten, perSpeler } = berekenMinuten(c.basis, c.wissels, c.kaarten, naam);
  const items = [
    ...c.wissels.map((w) => ({ id: w.id, minuut: w.minuut as number | null, tekst: <>🔁 <b>{naam(w.in)}</b> erin voor {naam(w.uit)}</>, weg: () => zet({ wissels: c.wissels.filter((x) => x.id !== w.id) }) })),
    ...c.doelpunten.map((d) => ({ id: d.id, minuut: d.minuut, tekst: <>⚽ {d.spelerId ? <b>{naam(d.spelerId)}</b> : 'Eigen doelpunt tegenstander'}</>, weg: () => zet({ doelpunten: c.doelpunten.filter((x) => x.id !== d.id) }) })),
    ...c.kaarten.map((k) => ({ id: k.id, minuut: k.minuut, tekst: <><span className={`kaartje ${k.type}`} /> {naam(k.spelerId)}</>, weg: () => zet({ kaarten: c.kaarten.filter((x) => x.id !== k.id) }) })),
  ].sort((a, b) => (a.minuut ?? 99) - (b.minuut ?? 99));
  const goals = c.doelpunten.length;
  const voor = c.voor === '' ? null : Number(c.voor);
  const gespeeld = [...perSpeler.keys()];

  return (
    <>
      <Sectie>
        <div className="knoppen">
          <button className="knop" onClick={() => setModal('wissel')}>+ Wissel</button>
          <button className="knop" onClick={() => setModal('doelpunt')}>+ Doelpunt</button>
          <button className="knop" onClick={() => setModal('geel')}><span className="kaartje geel" /> Geel</button>
          <button className="knop" onClick={() => setModal('rood')}><span className="kaartje rood" /> Rood</button>
        </div>
        <p className="klein" style={{ margin: '8px 4px 0' }}>Alles is optioneel; zonder wissels speelt de basis 90 minuten.</p>
      </Sectie>
      {c.bron === 'excel' && <Sectie><p className="melding">Historische wedstrijd uit de Excel: de minuten staan vast (zie Controle). Wissels zijn niet bekend.</p></Sectie>}
      {c.bron === 'app' && fouten.filter((f) => !f.startsWith('Er staan')).map((f) => <Sectie key={f}><p className="melding fout">{f}</p></Sectie>)}
      {voor != null && goals > 0 && goals !== voor && <Sectie><p className="melding">{goals} doelpunten ingevoerd, maar de uitslag zegt {voor} voor AH.</p></Sectie>}
      <Sectie titel="Verloop">
        <div className="kaart verloop">
          {items.length === 0 ? <p className="leeg">Nog niets ingevoerd.</p> : (
            <ul className="lijst">
              {items.map((it) => (
                <li key={it.id}>
                  <div className="item">
                    <span className="min">{it.minuut != null ? `${it.minuut}'` : ''}</span>
                    <div className="hoofd">{it.tekst}</div>
                    <button className="knop klein" onClick={it.weg} aria-label="Verwijder">×</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Sectie>
      {modal === 'wissel' && <WisselModal c={c} naam={naam} onSluit={() => setModal(null)} onOk={(w) => { zet({ wissels: [...c.wissels, w] }); setModal(null); }} />}
      {(modal === 'doelpunt' || modal === 'geel' || modal === 'rood') && (
        <GebeurtenisModal
          soort={modal}
          spelers={modal === 'geel' ? c.selectie : gespeeld}
          naam={naam}
          onSluit={() => setModal(null)}
          onOk={(spelerId, minuut) => {
            if (modal === 'doelpunt') zet({ doelpunten: [...c.doelpunten, { id: uid(), minuut, spelerId }] });
            else if (spelerId) zet({ kaarten: [...c.kaarten, { id: uid(), type: modal, minuut, spelerId }] });
            setModal(null);
          }}
        />
      )}
    </>
  );
}

function WisselModal({ c, naam, onSluit, onOk }: { c: Concept; naam: (id: string) => string; onSluit: () => void; onOk: (w: WisselInvoer) => void }) {
  const laatste = Math.max(45, ...c.wissels.map((w) => w.minuut));
  const [minuut, setMinuut] = useState(String(Math.min(laatste + 5, 85)));
  const m = Number(minuut);
  const veld = opVeldOp(c.basis, c.wissels, c.kaarten, m);
  const alGespeeld = new Set([...c.basis, ...c.wissels.map((w) => w.in)]);
  const bank = c.selectie.filter((id) => !alGespeeld.has(id));
  const [uit, setUit] = useState('');
  const [erin, setErin] = useState('');
  const geldig = minuut !== '' && m >= 0 && m <= WEDSTRIJDDUUR && veld.has(uit) && bank.includes(erin);
  return (
    <Modal titel="Wissel" onSluit={onSluit}>
      <label className="veld"><span>Minuut</span><input className="minuut-invoer" type="number" inputMode="numeric" min={0} max={90} value={minuut} onChange={(e) => setMinuut(e.target.value)} /></label>
      <label className="veld"><span>Eruit</span>
        <select value={uit} onChange={(e) => setUit(e.target.value)}>
          <option value="">Kies speler…</option>
          {[...veld].map((id) => <option key={id} value={id}>{naam(id)}</option>)}
        </select>
      </label>
      <label className="veld"><span>Erin</span>
        <select value={erin} onChange={(e) => setErin(e.target.value)}>
          <option value="">Kies speler…</option>
          {bank.map((id) => <option key={id} value={id}>{naam(id)}</option>)}
        </select>
      </label>
      {bank.length === 0 && <p className="melding" style={{ marginBottom: 12 }}>Er zit niemand meer op de bank. Voeg spelers toe bij Selectie.</p>}
      <button className="knop primair breed" disabled={!geldig} onClick={() => onOk({ id: uid(), minuut: m, uit, in: erin })}>Wissel toevoegen</button>
    </Modal>
  );
}

function GebeurtenisModal({ soort, spelers, naam, onSluit, onOk }: { soort: 'doelpunt' | 'geel' | 'rood'; spelers: string[]; naam: (id: string | null) => string; onSluit: () => void; onOk: (spelerId: string | null, minuut: number | null) => void }) {
  const [speler, setSpeler] = useState('');
  const [minuut, setMinuut] = useState('');
  const titel = soort === 'doelpunt' ? 'Doelpunt' : soort === 'geel' ? 'Gele kaart' : 'Rode kaart';
  const geldig = speler !== '' && (soort !== 'rood' || minuut !== '');
  return (
    <Modal titel={titel} onSluit={onSluit}>
      <label className="veld"><span>Speler</span>
        <select value={speler} onChange={(e) => setSpeler(e.target.value)}>
          <option value="">Kies speler…</option>
          {soort === 'doelpunt' && <option value="__eigen">Eigen doelpunt tegenstander</option>}
          {spelers.map((id) => <option key={id} value={id}>{naam(id)}</option>)}
        </select>
      </label>
      <label className="veld"><span>Minuut {soort === 'rood' ? '(nodig voor de speelminuten)' : '(optioneel)'}</span><input className="minuut-invoer" type="number" inputMode="numeric" min={0} max={90} value={minuut} onChange={(e) => setMinuut(e.target.value)} /></label>
      {soort === 'rood' && <p className="klein" style={{ marginTop: -4 }}>Twee keer geel? Voer dan één rode kaart in (en eventueel de eerste gele).</p>}
      <button className="knop primair breed" disabled={!geldig} onClick={() => onOk(speler === '__eigen' ? null : speler, minuut === '' ? null : Math.min(90, Math.max(0, Number(minuut))))}>Toevoegen</button>
    </Modal>
  );
}

// ---------------------------------------------------------------- stap 5: controle

function StapControle({ c, zet, naam }: StapProps & { naam: (id: string) => string }) {
  const { perSpeler, fouten } = berekenMinuten(c.basis, c.wissels, c.kaarten, naam);
  const rijen = c.selectie
    .map((id) => {
      const b = perSpeler.get(id);
      const berekend = b?.minuten ?? 0;
      const minuten = c.handmatig[id] ?? berekend;
      return { id, b, berekend, minuten, aangepast: c.handmatig[id] != null && c.handmatig[id] !== berekend };
    })
    .sort((a, b) => Number(!!b.b?.basis) - Number(!!a.b?.basis) || b.minuten - a.minuten);
  const totaal = rijen.reduce((s, r) => s + r.minuten, 0);
  const pas = (id: string, waarde: string) => {
    const h = { ...c.handmatig };
    if (waarde === '') delete h[id];
    else h[id] = Math.max(0, Math.min(90, Number(waarde)));
    zet({ handmatig: h });
  };
  return (
    <>
      {c.bron === 'app' && fouten.map((f) => <Sectie key={f}><p className="melding fout">{f}</p></Sectie>)}
      <Sectie titel="Speelminuten" actie={<span className={`klein ${totaal > 990 ? 'fout' : ''}`}>totaal {totaal} / 990</span>}>
        <p className="klein" style={{ margin: '0 4px 8px' }}>Berekend uit opstelling en wissels. Klopt iets niet? Pas het getal aan.</p>
        <div className="kaart">
          <ul className="lijst">
            {rijen.map((r) => (
              <li key={r.id}>
                <div className="item" style={{ cursor: 'default' }}>
                  <div className="hoofd">
                    <div className="naam">{naam(r.id)}</div>
                    <div className="detail">
                      {r.b ? (r.b.basis ? (r.b.rood ? 'basis, rood' : r.b.gewisseld ? 'basis, gewisseld' : 'basis') : 'invaller') : 'bank'}
                      {r.aangepast && ` · berekend ${r.berekend}`}
                    </div>
                  </div>
                  <input className="minuut-invoer" type="number" inputMode="numeric" min={0} max={90} aria-label={`Minuten ${naam(r.id)}`} value={c.handmatig[r.id] ?? r.berekend} onChange={(e) => pas(r.id, e.target.value)} style={r.aangepast ? { borderColor: 'var(--geel)' } : undefined} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Sectie>
      <Sectie titel="Opmerking (optioneel)">
        <input type="text" value={c.opmerking ?? ''} onChange={(e) => zet({ opmerking: e.target.value })} placeholder="Bijv. bekerwedstrijd, gestaakt…" />
      </Sectie>
    </>
  );
}

// ---------------------------------------------------------------- opslaan

function maakOpslag(data: Dataset, c: Concept) {
  const naam = (id: string) => data.speler.get(id)?.naam ?? c.nieuweSpelers.find((s) => s.id === id)?.naam ?? id;
  const tegenstander = c.nieuweTegenstander?.id === c.tegenstanderId ? c.nieuweTegenstander : data.tegenstander.get(c.tegenstanderId!)!;
  const id = c.bewerkId ?? nieuwId('w', `${c.datum}-${tegenstander.naam}`, new Set(data.wedstrijden.map((w) => w.id)));
  const { perSpeler } = berekenMinuten(c.basis, c.wissels, c.kaarten, naam);
  const deelnames: Deelname[] = [];
  const bank: string[] = [];
  for (const sid of c.selectie) {
    const b = perSpeler.get(sid);
    const minuten = c.handmatig[sid] ?? b?.minuten ?? 0;
    if (minuten <= 0) {
      bank.push(sid);
      continue;
    }
    const basis = b?.basis ?? c.basis.includes(sid);
    deelnames.push({
      wedstrijdId: id, spelerId: sid, minuten, basis,
      gewisseld: basis && !b?.rood && (!!b?.gewisseld || minuten < WEDSTRIJDDUUR),
      basisBron: c.bron === 'excel' ? 'geschat' : 'exact',
    });
  }
  const gebeurtenissen: Gebeurtenis[] = [
    ...c.wissels.map((w, i) => ({ id: `${id}-w${i}`, wedstrijdId: id, type: 'wissel' as const, minuut: w.minuut, spelerId: w.uit, spelerInId: w.in })),
    ...c.doelpunten.map((d, i) => ({ id: `${id}-d${i}`, wedstrijdId: id, type: 'doelpunt' as const, minuut: d.minuut, spelerId: d.spelerId })),
    ...c.kaarten.map((k, i) => ({ id: `${id}-k${i}`, wedstrijdId: id, type: k.type, minuut: k.minuut, spelerId: k.spelerId, ...(k.opmerking ? { opmerking: k.opmerking } : {}) })),
  ];
  const getalOfNull = (s: string) => (s.trim() === '' ? null : Math.max(0, Math.round(Number(s))));
  const wedstrijd: Wedstrijd = {
    id, seizoen: seizoenVanDatum(c.datum), datum: c.datum, tegenstanderId: tegenstander.id, thuisUit: c.thuisUit,
    doelpuntenVoor: getalOfNull(c.voor), doelpuntenTegen: getalOfNull(c.tegen), bron: c.bron,
    ...(bank.length ? { bank } : {}), ...(c.opmerking?.trim() ? { opmerking: c.opmerking.trim() } : {}),
  };
  const gebruikt = new Set([...c.selectie]);
  return {
    wedstrijd, deelnames, gebeurtenissen,
    nieuweSpelers: c.nieuweSpelers.filter((s) => gebruikt.has(s.id)),
    nieuweTegenstander: c.nieuweTegenstander?.id === tegenstander.id ? c.nieuweTegenstander : null,
    vorigId: c.bewerkId,
  };
}

