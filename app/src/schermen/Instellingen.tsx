import { useEffect, useRef, useState } from 'react';
import { Kop, Modal, Sectie, toast } from '../componenten/ui';
import { bewaarTegenstander, leesMeta, schrijfMeta, vervangAlles, voegSpelersSamen, voegTegenstandersSamen, wisAlles } from '../db';
import { useData } from '../data';
import { exporteerSeizoenCsv, leesBestand, maakBackup } from '../lib/backup';
import { ga } from '../router';
import type { DataBestand } from '../types';

export function Instellingen() {
  const { data, herlaad, wijzigingenSindsBackup } = useData();
  const bestand = useRef<HTMLInputElement>(null);
  const [laatsteBackup, setLaatsteBackup] = useState<string | null>(null);
  const [beschermd, setBeschermd] = useState<boolean | null>(null);
  const [terugzetten, setTerugzetten] = useState<DataBestand | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [csvSeizoen, setCsvSeizoen] = useState(data?.laatsteSeizoen ?? '');
  const [samenvoegen, setSamenvoegen] = useState<{ soort: 'speler' | 'tegenstander'; blijft: string; weg: string } | null>(null);
  const [wissen, setWissen] = useState(false);
  const [hernoem, setHernoem] = useState<{ id: string; naam: string } | null>(null);

  useEffect(() => {
    leesMeta<string | null>('laatsteBackup', null).then(setLaatsteBackup);
    navigator.storage?.persisted?.().then(setBeschermd).catch(() => setBeschermd(null));
  }, [wijzigingenSindsBackup]);

  async function backup() {
    try {
      const r = await maakBackup();
      toast(r === 'gedeeld' ? 'Back-up gedeeld' : 'Back-up gedownload');
      await herlaad();
    } catch {
      toast('Back-up geannuleerd');
    }
  }

  async function kiesBestand(f: File) {
    setFout(null);
    try {
      setTerugzetten(await leesBestand(f));
    } catch (e) {
      setFout((e as Error).message);
    }
  }

  return (
    <>
      <Kop terugKnop titel="Back-up & instellingen" />
      <Sectie titel="Back-up">
        <div className="kaart pad">
          <p style={{ marginTop: 0 }}>
            De gegevens staan alleen op deze telefoon. Maak na elke paar wedstrijden een back-up en bewaar die bijvoorbeeld in Google Drive of stuur hem naar jezelf.
          </p>
          <p className="klein">
            Laatste back-up: {laatsteBackup ? new Date(laatsteBackup).toLocaleString('nl-NL', { dateStyle: 'medium', timeStyle: 'short' }) : 'nog nooit'}
            {wijzigingenSindsBackup > 0 && ` · ${wijzigingenSindsBackup} wijzigingen sindsdien`}
            {beschermd === true && ' · opslag beschermd tegen opruimen'}
          </p>
          <div className="knoppen">
            <button className="knop primair" onClick={backup}>Back-up maken / delen</button>
            <button className="knop" onClick={() => bestand.current?.click()}>Back-up terugzetten</button>
          </div>
          <input ref={bestand} type="file" accept=".json,application/json" hidden onChange={(e) => { if (e.target.files?.[0]) kiesBestand(e.target.files[0]); e.target.value = ''; }} />
          {fout && <p className="melding fout" style={{ marginTop: 12 }}>{fout}</p>}
        </div>
      </Sectie>

      {data && (
        <>
          <Sectie titel="Exporteren naar Excel">
            <div className="kaart pad">
              <p className="klein" style={{ marginTop: 0 }}>Een seizoensoverzicht (spelers × wedstrijden) als CSV-bestand dat je in Excel kunt openen.</p>
              <div className="rij-tussen">
                <select value={csvSeizoen} onChange={(e) => setCsvSeizoen(e.target.value)} aria-label="Seizoen voor CSV">
                  {[...data.seizoenen].reverse().map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <button className="knop" onClick={() => exporteerSeizoenCsv(data, csvSeizoen).catch(() => toast('Geannuleerd'))}>CSV</button>
              </div>
            </div>
          </Sectie>

          <Sectie titel="Dubbele spelers of clubs samenvoegen">
            <div className="kaart pad">
              <p className="klein" style={{ marginTop: 0 }}>Staat iemand er twee keer in (bijv. door een tikfout)? Voeg ze samen: alle minuten gaan over naar de speler die blijft.</p>
              <div className="knoppen">
                <button className="knop" onClick={() => setSamenvoegen({ soort: 'speler', blijft: '', weg: '' })}>Spelers samenvoegen</button>
                <button className="knop" onClick={() => setSamenvoegen({ soort: 'tegenstander', blijft: '', weg: '' })}>Tegenstanders samenvoegen</button>
                <button className="knop" onClick={() => setHernoem({ id: '', naam: '' })}>Tegenstander hernoemen</button>
              </div>
            </div>
          </Sectie>
        </>
      )}

      <Sectie titel="Gevarenzone">
        <div className="kaart pad">
          <button className="knop gevaar" onClick={() => setWissen(true)}>Alle gegevens van deze telefoon wissen</button>
        </div>
      </Sectie>
      <p className="klein" style={{ textAlign: 'center', margin: '18px 0' }}>Speelminuten AH 1 · versie 1.0</p>

      {terugzetten && (
        <Modal titel="Back-up terugzetten?" onSluit={() => setTerugzetten(null)}>
          <p>
            Dit bestand bevat {terugzetten.wedstrijden.length} wedstrijden en {terugzetten.spelers.length} spelers
            {terugzetten.gegenereerd ? ` (gemaakt ${new Date(terugzetten.gegenereerd).toLocaleDateString('nl-NL')})` : ''}.
          </p>
          <p><b>Alle huidige gegevens op deze telefoon worden vervangen.</b></p>
          <div className="knoppen">
            <button className="knop" onClick={() => setTerugzetten(null)}>Annuleren</button>
            <button
              className="knop primair"
              onClick={async () => {
                await vervangAlles(terugzetten);
                await schrijfMeta('gestart', true);
                await schrijfMeta('wijzigingenSindsBackup', 0);
                await navigator.storage?.persist?.();
                await herlaad();
                setTerugzetten(null);
                toast('Back-up teruggezet');
                ga('#/');
              }}
            >
              Vervangen
            </button>
          </div>
        </Modal>
      )}

      {samenvoegen && data && (
        <Modal titel={samenvoegen.soort === 'speler' ? 'Spelers samenvoegen' : 'Tegenstanders samenvoegen'} onSluit={() => setSamenvoegen(null)}>
          {(['blijft', 'weg'] as const).map((rol) => (
            <label className="veld" key={rol}>
              <span>{rol === 'blijft' ? 'Deze blijft bestaan' : 'Deze verdwijnt (gaat op in de eerste)'}</span>
              <select value={samenvoegen[rol]} onChange={(e) => setSamenvoegen({ ...samenvoegen, [rol]: e.target.value })}>
                <option value="">Kies…</option>
                {(samenvoegen.soort === 'speler' ? data.spelers : data.tegenstanders).map((x) => <option key={x.id} value={x.id}>{x.naam}</option>)}
              </select>
            </label>
          ))}
          <button
            className="knop primair breed"
            disabled={!samenvoegen.blijft || !samenvoegen.weg || samenvoegen.blijft === samenvoegen.weg}
            onClick={async () => {
              if (samenvoegen.soort === 'speler') await voegSpelersSamen(samenvoegen.blijft, samenvoegen.weg);
              else await voegTegenstandersSamen(samenvoegen.blijft, samenvoegen.weg);
              await herlaad();
              setSamenvoegen(null);
              toast('Samengevoegd');
            }}
          >
            Samenvoegen
          </button>
        </Modal>
      )}

      {hernoem && data && (
        <Modal titel="Tegenstander hernoemen" onSluit={() => setHernoem(null)}>
          <label className="veld"><span>Tegenstander</span>
            <select value={hernoem.id} onChange={(e) => setHernoem({ id: e.target.value, naam: data.tegenstander.get(e.target.value)?.naam ?? '' })}>
              <option value="">Kies…</option>
              {data.tegenstanders.map((t) => <option key={t.id} value={t.id}>{t.naam}</option>)}
            </select>
          </label>
          <label className="veld"><span>Nieuwe naam</span><input type="text" value={hernoem.naam} onChange={(e) => setHernoem({ ...hernoem, naam: e.target.value })} /></label>
          <button
            className="knop primair breed"
            disabled={!hernoem.id || !hernoem.naam.trim()}
            onClick={async () => {
              const t = data.tegenstander.get(hernoem.id)!;
              await bewaarTegenstander({ ...t, naam: hernoem.naam.trim(), aliassen: [...new Set([...t.aliassen, t.naam])] });
              await herlaad();
              setHernoem(null);
              toast('Hernoemd');
            }}
          >
            Opslaan
          </button>
        </Modal>
      )}

      {wissen && (
        <Modal titel="Alles wissen?" onSluit={() => setWissen(false)}>
          <p>Alle spelers, wedstrijden en minuten worden van deze telefoon verwijderd. Maak eerst een back-up als je die nog nodig hebt.</p>
          <div className="knoppen">
            <button className="knop" onClick={() => setWissen(false)}>Annuleren</button>
            <button className="knop gevaar" onClick={async () => { await wisAlles(); await herlaad(); setWissen(false); ga('#/'); }}>Ja, alles wissen</button>
          </div>
        </Modal>
      )}
    </>
  );
}
