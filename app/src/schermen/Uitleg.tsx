import { Kop, Sectie } from '../componenten/ui';

export function Uitleg() {
  return (
    <>
      <Kop terugKnop titel="Uitleg" />
      <Sectie titel="Waar komen de cijfers vandaan?">
        <div className="kaart pad">
          <p style={{ marginTop: 0 }}>
            De historie (2010-11 t/m 2025-26) komt uit de Excelbestanden waarin per wedstrijd de speelminuten zijn bijgehouden. Daarin ontbreken 2011-12 en
            de eerste helft van 2010-11 heeft alleen totalen per speler (die tellen wel mee in de totale minuten en wedstrijden). 2019-20 en 2020-21 zijn
            door corona korte seizoenen.
          </p>
          <p style={{ marginBottom: 0 }}>Nieuwe wedstrijden voer je in via <b>Invoeren</b>: die worden exact vastgelegd, inclusief wissels, doelpunten, kaarten en uitslag.</p>
        </div>
      </Sectie>
      <Sectie titel="Wat betekent ≈ ?">
        <div className="kaart pad">
          <p style={{ marginTop: 0 }}>
            In de Excel staan alleen minuten, niet wie er in de basis begon. Voor die wedstrijden is het <b>geschat</b>: wie 90 minuten speelde stond in de
            basis; de overige basisplaatsen gaan naar de spelers met de meeste minuten. De rest telt als invaller. Een basisspeler met minder dan 90 minuten
            telt als <i>gewisseld</i> (behalve bij een bekende rode kaart).
          </p>
          <p style={{ marginBottom: 0 }}>
            Meestal klopt dat, maar niet altijd (bijvoorbeeld een basisspeler die na 20 minuten geblesseerd uitvalt). Cijfers over basisplaatsen, invalbeurten
            en wissels zijn daarom gemarkeerd met ≈. Minuten en wedstrijden zijn wel exact.
          </p>
        </div>
      </Sectie>
      <Sectie titel="Rode kaarten">
        <div className="kaart pad">
          <p style={{ margin: 0 }}>Historische rode kaarten komen uit de notities onder de Excel-tabellen (bijv. "2x geel Castricum") en zijn dus mogelijk niet compleet.</p>
        </div>
      </Sectie>
    </>
  );
}
