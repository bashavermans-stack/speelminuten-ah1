import { useRef, useState } from 'react';
import { schrijfMeta, vervangAlles } from '../db';
import { useData } from '../data';
import { leesBestand } from '../lib/backup';
import { ga } from '../router';

export function Welkom() {
  const { herlaad } = useData();
  const invoer = useRef<HTMLInputElement>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  async function importeer(file: File) {
    setFout(null);
    setBezig(true);
    try {
      const data = await leesBestand(file);
      await vervangAlles(data);
      await schrijfMeta('gestart', true);
      await schrijfMeta('wijzigingenSindsBackup', 0);
      await navigator.storage?.persist?.();
      await herlaad();
      ga('#/');
    } catch (e) {
      setFout((e as Error).message);
    } finally {
      setBezig(false);
    }
  }

  async function leegBeginnen() {
    await schrijfMeta('gestart', true);
    await navigator.storage?.persist?.();
    await herlaad();
    ga('#/invoeren');
  }

  return (
    <div className="welkom">
      <img src="icon-192.png" alt="" />
      <h1>Speelminuten AH 1</h1>
      <p>Statistieken van het 1e elftal van AmstelveenHeemraad. Alle gegevens blijven op deze telefoon.</p>
      <div className="kaart pad" style={{ textAlign: 'left', marginTop: 24 }}>
        <h2 style={{ fontSize: '1rem', marginBottom: 6 }}>Eerste keer?</h2>
        <p className="klein" style={{ margin: '0 0 14px' }}>
          Kies het bestand <b>voetbal-data.json</b> (of een eerder gemaakte back-up) dat je via WhatsApp, mail of Drive op je telefoon hebt gezet.
        </p>
        <input ref={invoer} type="file" accept=".json,application/json" hidden onChange={(e) => e.target.files?.[0] && importeer(e.target.files[0])} />
        <button className="knop primair breed" disabled={bezig} onClick={() => invoer.current?.click()}>
          {bezig ? 'Bezig met importeren…' : 'Gegevens importeren'}
        </button>
        {fout && <p className="melding fout" style={{ marginTop: 12 }}>{fout}</p>}
        <button className="knop breed" style={{ marginTop: 10 }} onClick={leegBeginnen}>Leeg beginnen</button>
      </div>
    </div>
  );
}
