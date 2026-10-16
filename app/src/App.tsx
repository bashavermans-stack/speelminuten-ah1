import type { ReactNode } from 'react';
import { Foutgrens, ToastHouder } from './componenten/ui';
import { useData } from './data';
import { useRoute } from './router';
import { Duos } from './schermen/Duos';
import { Instellingen } from './schermen/Instellingen';
import { Invoeren } from './schermen/Invoeren';
import { Meer } from './schermen/Meer';
import { Ranglijsten } from './schermen/Ranglijsten';
import { Records } from './schermen/Records';
import { SeizoenDetail, Seizoenen } from './schermen/Seizoenen';
import { SpelerDetail } from './schermen/SpelerDetail';
import { Spelers } from './schermen/Spelers';
import { TegenstanderDetail, Tegenstanders } from './schermen/Tegenstanders';
import { Uitleg } from './schermen/Uitleg';
import { Vergelijk } from './schermen/Vergelijk';
import { WedstrijdDetail } from './schermen/WedstrijdDetail';
import { Wedstrijden } from './schermen/Wedstrijden';
import { Welkom } from './schermen/Welkom';

const TABS = [
  { pad: '', label: 'Ranglijst', icoon: <IcoonBeker /> },
  { pad: 'spelers', label: 'Spelers', icoon: <IcoonSpeler /> },
  { pad: 'wedstrijden', label: 'Wedstrijden', icoon: <IcoonKalender /> },
  { pad: 'invoeren', label: 'Invoeren', icoon: <IcoonPlus /> },
  { pad: 'meer', label: 'Meer', icoon: <IcoonMeer /> },
];

const TAB_VAN: Record<string, string> = {
  speler: 'spelers', wedstrijd: 'wedstrijden', tegenstanders: 'meer', tegenstander: 'meer', seizoenen: 'meer', seizoen: 'meer',
  records: 'meer', duos: 'meer', vergelijk: 'meer', instellingen: 'meer', uitleg: 'meer',
};

export function App() {
  const { data, laden } = useData();
  const pad = useRoute();
  if (laden) return <div className="laden">Laden…</div>;
  if (!data && pad[0] !== 'instellingen') return <><Welkom /><ToastHouder /></>;

  const [p0 = '', p1] = pad;
  let scherm: ReactNode;
  switch (p0) {
    case '': scherm = <Ranglijsten />; break;
    case 'spelers': scherm = <Spelers />; break;
    case 'speler': scherm = <SpelerDetail id={p1} />; break;
    case 'wedstrijden': scherm = <Wedstrijden seizoen={p1} />; break;
    case 'wedstrijd': scherm = <WedstrijdDetail id={p1} />; break;
    case 'invoeren': scherm = <Invoeren key={p1 ?? 'nieuw'} bewerkId={p1} />; break;
    case 'meer': scherm = <Meer />; break;
    case 'tegenstanders': scherm = <Tegenstanders />; break;
    case 'tegenstander': scherm = <TegenstanderDetail id={p1} />; break;
    case 'seizoenen': scherm = <Seizoenen />; break;
    case 'seizoen': scherm = <SeizoenDetail seizoen={p1} />; break;
    case 'records': scherm = <Records />; break;
    case 'duos': scherm = <Duos />; break;
    case 'vergelijk': scherm = <Vergelijk a={p1} b={pad[2]} />; break;
    case 'instellingen': scherm = <Instellingen />; break;
    case 'uitleg': scherm = <Uitleg />; break;
    default: scherm = <p className="leeg">Pagina niet gevonden.</p>;
  }
  const actief = TAB_VAN[p0] ?? p0;
  return (
    <div className="app">
      <main className="inhoud"><Foutgrens key={pad.join('/')}>{scherm}</Foutgrens></main>
      <ToastHouder />
      {data && (
        <nav className="tabbalk" aria-label="Hoofdmenu">
          {TABS.map((t) => (
            <a key={t.pad} href={`#/${t.pad}`} className={actief === t.pad ? 'actief' : ''} aria-current={actief === t.pad ? 'page' : undefined}>
              {t.icoon}
              <span>{t.label}</span>
            </a>
          ))}
        </nav>
      )}
    </div>
  );
}

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}
function IcoonBeker() {
  return <Svg><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" /></Svg>;
}
function IcoonSpeler() {
  return <Svg><circle cx="12" cy="7" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Svg>;
}
function IcoonKalender() {
  return <Svg><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></Svg>;
}
function IcoonPlus() {
  return <Svg><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></Svg>;
}
function IcoonMeer() {
  return <Svg><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></Svg>;
}
