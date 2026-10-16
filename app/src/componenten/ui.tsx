import { Component, useEffect, useState, type ReactNode } from 'react';
import { terug } from '../router';

export function Kop({ titel, sub, terugKnop, acties }: { titel: ReactNode; sub?: ReactNode; terugKnop?: boolean; acties?: ReactNode }) {
  return (
    <header className="kop">
      {terugKnop && (
        <button className="icoon" onClick={() => terug()} aria-label="Terug">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </button>
      )}
      <h1>
        {titel}
        {sub && <span className="sub">{sub}</span>}
      </h1>
      {acties && <div className="acties">{acties}</div>}
    </header>
  );
}

export function Sectie({ titel, children, actie }: { titel?: ReactNode; children: ReactNode; actie?: ReactNode }) {
  return (
    <section className="sectie">
      {titel && (
        <div className="rij-tussen">
          <h2>{titel}</h2>
          {actie}
        </div>
      )}
      {children}
    </section>
  );
}

export function Tegel({ getal, label, geschat }: { getal: ReactNode; label: ReactNode; geschat?: boolean }) {
  return (
    <div className="tegel">
      <div className="getal">
        {getal}
        {geschat && <Geschat />}
      </div>
      <div className="label">{label}</div>
    </div>
  );
}

export function Geschat() {
  return (
    <span className="geschat" title="Deels geschat: in de Excel staan alleen minuten (zie Meer → Uitleg)">
      ≈
    </span>
  );
}

export function Balk({ waarde, max }: { waarde: number; max: number }) {
  return (
    <div className="balk">
      <span style={{ width: `${max ? Math.max(2, (100 * waarde) / max) : 0}%` }} />
    </div>
  );
}

export function Modal({ titel, onSluit, children }: { titel: ReactNode; onSluit: () => void; children: ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onSluit();
    window.addEventListener('keydown', esc);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', esc);
      document.body.style.overflow = '';
    };
  }, [onSluit]);
  return (
    <div className="modal-achter" onClick={onSluit}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-kop">
          <h2>{titel}</h2>
          <button onClick={onSluit} aria-label="Sluiten">×</button>
        </div>
        <div className="modal-inhoud">{children}</div>
      </div>
    </div>
  );
}

let toonToastExtern: ((t: string) => void) | null = null;

export function toast(tekst: string) {
  toonToastExtern?.(tekst);
}

export function ToastHouder() {
  const [tekst, setTekst] = useState<string | null>(null);
  useEffect(() => {
    let timer: number | undefined;
    toonToastExtern = (t) => {
      setTekst(t);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setTekst(null), 2600);
    };
    return () => {
      toonToastExtern = null;
      window.clearTimeout(timer);
    };
  }, []);
  return tekst ? <div className="toast" role="status">{tekst}</div> : null;
}

export function Segment<T extends string>({ waarde, opties, onChange }: { waarde: T; opties: { waarde: T; label: string }[]; onChange: (w: T) => void }) {
  return (
    <div className="segment" role="radiogroup">
      {opties.map((o) => (
        <button key={o.waarde} type="button" role="radio" aria-checked={waarde === o.waarde} className={waarde === o.waarde ? 'aan' : ''} onClick={() => onChange(o.waarde)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** '1 wedstrijd', '3 wedstrijden' */
export function aantal(n: number, enkel: string, meer: string): string {
  return `${getal(n)} ${n === 1 ? enkel : meer}`;
}

export function getal(n: number): string {
  return n.toLocaleString('nl-NL');
}

export function Positie({ n }: { n: number }) {
  return <span className={`positie p${n}`}>{n}</span>;
}

/** Toont een nette foutmelding in plaats van een wit scherm. */
export class Foutgrens extends Component<{ children: ReactNode }, { fout: Error | null }> {
  state = { fout: null as Error | null };
  static getDerivedStateFromError(fout: Error) {
    return { fout };
  }
  render() {
    if (!this.state.fout) return this.props.children;
    return (
      <div className="welkom">
        <h1>Er ging iets mis</h1>
        <p>Je gegevens zijn veilig. Probeer het opnieuw.</p>
        <p className="klein">{this.state.fout.message}</p>
        <button className="knop primair" onClick={() => { this.setState({ fout: null }); window.location.hash = '#/'; }}>Naar het begin</button>
      </div>
    );
  }
}
