import { leesAlles, schrijfMeta } from '../db';
import type { Dataset } from '../stats/dataset';
import type { DataBestand } from '../types';
import { vandaagIso } from './seizoen';

export function valideerBestand(json: unknown): DataBestand {
  const d = json as Partial<DataBestand>;
  if (!d || typeof d !== 'object') throw new Error('Dit is geen geldig gegevensbestand.');
  if (d.versie !== 1) throw new Error(`Onbekende versie van het gegevensbestand (${String(d.versie)}).`);
  for (const veld of ['spelers', 'tegenstanders', 'wedstrijden', 'deelnames', 'gebeurtenissen', 'seizoenstotalen'] as const) {
    if (!Array.isArray(d[veld])) throw new Error(`Het bestand mist het onderdeel "${veld}".`);
  }
  return d as DataBestand;
}

export async function leesBestand(file: File): Promise<DataBestand> {
  const tekst = await file.text();
  let json: unknown;
  try {
    json = JSON.parse(tekst);
  } catch {
    throw new Error('Het bestand kon niet gelezen worden (geen geldige JSON).');
  }
  return valideerBestand(json);
}

/** Deelt het bestand via het Android-deelmenu, of downloadt het als delen niet kan. */
async function deelOfDownload(bestand: File): Promise<'gedeeld' | 'gedownload'> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [bestand] })) {
    try {
      await nav.share({ files: [bestand], title: bestand.name });
      return 'gedeeld';
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') throw e;
    }
  }
  const url = URL.createObjectURL(bestand);
  const a = document.createElement('a');
  a.href = url;
  a.download = bestand.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'gedownload';
}

export async function maakBackup(): Promise<'gedeeld' | 'gedownload'> {
  const data = await leesAlles();
  data.bron = 'app-backup';
  const bestand = new File([JSON.stringify(data)], `speelminuten-backup-${vandaagIso()}.json`, { type: 'application/json' });
  const r = await deelOfDownload(bestand);
  await schrijfMeta('laatsteBackup', new Date().toISOString());
  await schrijfMeta('wijzigingenSindsBackup', 0);
  return r;
}

/** Seizoensoverzicht zoals de Excel: spelers × wedstrijden met minuten. */
export async function exporteerSeizoenCsv(data: Dataset, seizoen: string): Promise<'gedeeld' | 'gedownload'> {
  const wedstrijden = data.wedstrijden.filter((w) => w.seizoen === seizoen);
  const spelers = new Map<string, Map<string, number>>();
  for (const w of wedstrijden)
    for (const d of data.deelnamesPerWedstrijd.get(w.id) ?? []) {
      if (!spelers.has(d.spelerId)) spelers.set(d.spelerId, new Map());
      spelers.get(d.spelerId)!.set(w.id, d.minuten);
    }
  const cel = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;
  const kop = ['Speler', 'Wedstrijden', 'Minuten', ...wedstrijden.map((w) => `${w.datum} ${data.tegenstander.get(w.tegenstanderId)?.naam ?? ''}`)];
  const rijen = [...spelers.entries()]
    .map(([id, m]) => ({ id, m, totaal: [...m.values()].reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.totaal - a.totaal)
    .map(({ id, m, totaal }) => [data.speler.get(id)?.naam ?? id, m.size, totaal, ...wedstrijden.map((w) => m.get(w.id) ?? '')]);
  const csv = '﻿' + [kop, ...rijen].map((r) => r.map(cel).join(';')).join('\r\n');
  return deelOfDownload(new File([csv], `speelminuten-${seizoen}.csv`, { type: 'text/csv' }));
}
