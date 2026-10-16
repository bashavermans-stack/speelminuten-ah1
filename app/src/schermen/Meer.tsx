import { Kop, Sectie } from '../componenten/ui';

const ITEMS = [
  { href: '#/seizoenen', titel: 'Seizoenen', tekst: 'Overzicht per seizoen, debutanten, ijzeren man' },
  { href: '#/tegenstanders', titel: 'Tegenstanders', tekst: 'Alle duels en wie het meest speelde tegen wie' },
  { href: '#/records', titel: 'Records & mijlpalen', tekst: 'Langste reeksen, 10.000-minutenclub' },
  { href: '#/duos', titel: "Duo's", tekst: 'Welke spelers stonden het vaakst samen op het veld' },
  { href: '#/vergelijk', titel: 'Vergelijk spelers', tekst: 'Twee spelers naast elkaar' },
  { href: '#/instellingen', titel: 'Back-up & instellingen', tekst: 'Back-up maken/terugzetten, spelers samenvoegen, CSV' },
  { href: '#/uitleg', titel: 'Uitleg', tekst: 'Waar komen de cijfers vandaan, wat betekent ≈' },
];

export function Meer() {
  return (
    <>
      <Kop titel="Meer" />
      <Sectie>
        <div className="kaart">
          <ul className="lijst">
            {ITEMS.map((i) => (
              <li key={i.href}>
                <a className="item" href={i.href}>
                  <div className="hoofd">
                    <div className="naam">{i.titel}</div>
                    <div className="detail">{i.tekst}</div>
                  </div>
                  <span aria-hidden="true">›</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </Sectie>
    </>
  );
}
