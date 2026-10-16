import Dexie, { type Table } from 'dexie';
import type { DataBestand, Deelname, Gebeurtenis, Seizoenstotaal, Speler, Tegenstander, Wedstrijd } from './types';

interface Meta {
  sleutel: string;
  waarde: unknown;
}

class VoetbalDB extends Dexie {
  spelers!: Table<Speler, string>;
  tegenstanders!: Table<Tegenstander, string>;
  wedstrijden!: Table<Wedstrijd, string>;
  deelnames!: Table<Deelname, [string, string]>;
  gebeurtenissen!: Table<Gebeurtenis, string>;
  seizoenstotalen!: Table<Seizoenstotaal, [string, string]>;
  meta!: Table<Meta, string>;

  constructor() {
    super('speelminuten-ah1');
    this.version(1).stores({
      spelers: 'id',
      tegenstanders: 'id',
      wedstrijden: 'id, seizoen, datum',
      deelnames: '[wedstrijdId+spelerId], wedstrijdId, spelerId',
      gebeurtenissen: 'id, wedstrijdId',
      seizoenstotalen: '[seizoen+spelerId], spelerId',
      meta: 'sleutel',
    });
  }
}

export const db = new VoetbalDB();

const DATATABELLEN = () => [db.spelers, db.tegenstanders, db.wedstrijden, db.deelnames, db.gebeurtenissen, db.seizoenstotalen];

export async function leesAlles(): Promise<DataBestand> {
  const [spelers, tegenstanders, wedstrijden, deelnames, gebeurtenissen, seizoenstotalen] = await Promise.all([
    db.spelers.toArray(),
    db.tegenstanders.toArray(),
    db.wedstrijden.toArray(),
    db.deelnames.toArray(),
    db.gebeurtenissen.toArray(),
    db.seizoenstotalen.toArray(),
  ]);
  return { versie: 1, gegenereerd: new Date().toISOString(), bron: 'app', spelers, tegenstanders, wedstrijden, deelnames, gebeurtenissen, seizoenstotalen };
}

export async function vervangAlles(data: DataBestand): Promise<void> {
  await db.transaction('rw', DATATABELLEN(), async () => {
    for (const t of DATATABELLEN()) await t.clear();
    await db.spelers.bulkAdd(data.spelers);
    await db.tegenstanders.bulkAdd(data.tegenstanders);
    await db.wedstrijden.bulkAdd(data.wedstrijden);
    await db.deelnames.bulkAdd(data.deelnames);
    await db.gebeurtenissen.bulkAdd(data.gebeurtenissen);
    await db.seizoenstotalen.bulkAdd(data.seizoenstotalen);
  });
}

export async function wisAlles(): Promise<void> {
  await db.transaction('rw', [...DATATABELLEN(), db.meta], async () => {
    for (const t of [...DATATABELLEN(), db.meta]) await t.clear();
  });
}

export interface WedstrijdOpslag {
  wedstrijd: Wedstrijd;
  deelnames: Deelname[];
  gebeurtenissen: Gebeurtenis[];
  nieuweSpelers: Speler[];
  nieuweTegenstander: Tegenstander | null;
  /** Id van de wedstrijd die bewerkt wordt (kan afwijken als datum/tegenstander wijzigt). */
  vorigId?: string;
}

export async function slaWedstrijdOp(o: WedstrijdOpslag): Promise<void> {
  await db.transaction('rw', [db.spelers, db.tegenstanders, db.wedstrijden, db.deelnames, db.gebeurtenissen, db.meta], async () => {
    if (o.vorigId) await verwijderWedstrijdIntern(o.vorigId);
    if (o.nieuweSpelers.length) await db.spelers.bulkPut(o.nieuweSpelers);
    if (o.nieuweTegenstander) await db.tegenstanders.put(o.nieuweTegenstander);
    await db.wedstrijden.put(o.wedstrijd);
    await db.deelnames.bulkPut(o.deelnames);
    await db.gebeurtenissen.bulkPut(o.gebeurtenissen);
    await telWijziging();
  });
}

async function verwijderWedstrijdIntern(id: string) {
  await db.wedstrijden.delete(id);
  await db.deelnames.where('wedstrijdId').equals(id).delete();
  await db.gebeurtenissen.where('wedstrijdId').equals(id).delete();
}

export async function verwijderWedstrijd(id: string): Promise<void> {
  await db.transaction('rw', [db.wedstrijden, db.deelnames, db.gebeurtenissen, db.meta], async () => {
    await verwijderWedstrijdIntern(id);
    await telWijziging();
  });
}

export async function bewaarSpeler(s: Speler): Promise<void> {
  await db.spelers.put(s);
  await telWijziging();
}

export async function bewaarTegenstander(t: Tegenstander): Promise<void> {
  await db.tegenstanders.put(t);
  await telWijziging();
}

/** Voegt speler 'weg' samen in 'blijft': alle minuten, kaarten en doelpunten gaan over. */
export async function voegSpelersSamen(blijftId: string, wegId: string): Promise<void> {
  await db.transaction('rw', [db.spelers, db.deelnames, db.gebeurtenissen, db.seizoenstotalen, db.wedstrijden, db.meta], async () => {
    const blijft = await db.spelers.get(blijftId);
    const weg = await db.spelers.get(wegId);
    if (!blijft || !weg) throw new Error('Speler niet gevonden');
    for (const d of await db.deelnames.where('spelerId').equals(wegId).toArray()) {
      await db.deelnames.delete([d.wedstrijdId, d.spelerId]);
      const bestaand = await db.deelnames.get([d.wedstrijdId, blijftId]);
      if (bestaand) {
        bestaand.minuten = Math.min(90, bestaand.minuten + d.minuten);
        bestaand.basis = bestaand.basis || d.basis;
        await db.deelnames.put(bestaand);
      } else {
        await db.deelnames.put({ ...d, spelerId: blijftId });
      }
    }
    await db.gebeurtenissen.toCollection().modify((g) => {
      if (g.spelerId === wegId) g.spelerId = blijftId;
      if (g.spelerInId === wegId) g.spelerInId = blijftId;
    });
    await db.wedstrijden.toCollection().modify((w) => {
      if (w.bank?.includes(wegId)) w.bank = [...new Set(w.bank.map((id) => (id === wegId ? blijftId : id)))];
    });
    for (const t of await db.seizoenstotalen.where('spelerId').equals(wegId).toArray()) {
      await db.seizoenstotalen.delete([t.seizoen, t.spelerId]);
      const bestaand = await db.seizoenstotalen.get([t.seizoen, blijftId]);
      await db.seizoenstotalen.put(
        bestaand ? { ...bestaand, minuten: bestaand.minuten + t.minuten, wedstrijden: bestaand.wedstrijden + t.wedstrijden } : { ...t, spelerId: blijftId },
      );
    }
    await db.spelers.put({
      ...blijft,
      keeper: blijft.keeper || weg.keeper,
      actief: blijft.actief || weg.actief,
      aliassen: [...new Set([...blijft.aliassen, ...weg.aliassen, `${weg.voornaam} | ${weg.achternaam}`])],
    });
    await db.spelers.delete(wegId);
    await telWijziging();
  });
}

export async function voegTegenstandersSamen(blijftId: string, wegId: string): Promise<void> {
  await db.transaction('rw', [db.tegenstanders, db.wedstrijden, db.meta], async () => {
    const blijft = await db.tegenstanders.get(blijftId);
    const weg = await db.tegenstanders.get(wegId);
    if (!blijft || !weg) throw new Error('Tegenstander niet gevonden');
    await db.wedstrijden.toCollection().modify((w) => {
      if (w.tegenstanderId === wegId) w.tegenstanderId = blijftId;
    });
    await db.tegenstanders.put({ ...blijft, aliassen: [...new Set([...blijft.aliassen, ...weg.aliassen, weg.naam])] });
    await db.tegenstanders.delete(wegId);
    await telWijziging();
  });
}

// ---------------------------------------------------------------- meta

export async function leesMeta<T>(sleutel: string, standaard: T): Promise<T> {
  const m = await db.meta.get(sleutel);
  return m ? (m.waarde as T) : standaard;
}

export async function schrijfMeta(sleutel: string, waarde: unknown): Promise<void> {
  await db.meta.put({ sleutel, waarde });
}

async function telWijziging() {
  const n = await leesMeta('wijzigingenSindsBackup', 0);
  await schrijfMeta('wijzigingenSindsBackup', n + 1);
}
