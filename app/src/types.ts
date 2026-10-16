export type ThuisUit = 'thuis' | 'uit' | null;

export interface Speler {
  id: string;
  voornaam: string;
  achternaam: string;
  naam: string;
  keeper: boolean;
  actief: boolean;
  aliassen: string[];
}

export interface Tegenstander {
  id: string;
  naam: string;
  aliassen: string[];
}

export interface Wedstrijd {
  id: string;
  seizoen: string; // '2025-2026'
  datum: string; // ISO 'YYYY-MM-DD'
  tegenstanderId: string;
  thuisUit: ThuisUit;
  doelpuntenVoor: number | null;
  doelpuntenTegen: number | null;
  bron: 'excel' | 'app';
  /** Selectiespelers die niet in actie kwamen (alleen bij invoer via de app). */
  bank?: string[];
  opmerking?: string;
}

export interface Deelname {
  wedstrijdId: string;
  spelerId: string;
  minuten: number;
  basis: boolean;
  gewisseld: boolean;
  basisBron: 'geschat' | 'exact';
}

export type GebeurtenisType = 'wissel' | 'doelpunt' | 'geel' | 'rood';

export interface Gebeurtenis {
  id: string;
  wedstrijdId: string;
  type: GebeurtenisType;
  minuut: number | null;
  /** Bij een wissel: de speler die eruit gaat. Bij een doelpunt: null = eigen doelpunt tegenstander. */
  spelerId: string | null;
  spelerInId?: string;
  opmerking?: string;
}

export interface Seizoenstotaal {
  seizoen: string;
  spelerId: string;
  minuten: number;
  wedstrijden: number;
  opmerking: string;
}

export interface DataBestand {
  versie: 1;
  gegenereerd: string;
  bron: string;
  spelers: Speler[];
  tegenstanders: Tegenstander[];
  wedstrijden: Wedstrijd[];
  deelnames: Deelname[];
  gebeurtenissen: Gebeurtenis[];
  seizoenstotalen: Seizoenstotaal[];
}
