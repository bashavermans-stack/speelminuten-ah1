# Speelminuten AH 1

Een telefoon-app (web-app/PWA) met de speelminuten en statistieken van het 1e elftal van AmstelveenHeemraad, sinds 2010-11. De app werkt offline en **alle gegevens blijven op de telefoon**. Online staat alleen de lege app.

## Wat zit erin

| Map | Inhoud |
|---|---|
| `Data_in_een_programmatje/` | De originele Excelbestanden (worden niet aangepast) |
| `import/` | Python-script dat de Excels omzet naar één gegevensbestand, plus aliaslijsten |
| `data/voetbal-data.json` | Het gegevensbestand dat je in de app importeert (gegenereerd) |
| `app/` | De app zelf (React + TypeScript, Vite) |

## 1. Gegevens uit de Excels halen (eenmalig, al gedaan)

```bash
python import/excel_naar_json.py
```

Dit maakt `data/voetbal-data.json` en `import/controlerapport.md`. Het rapport controleert of de minuten per speler per seizoen precies kloppen met de kolom "totaal" in de Excel (nu: 0 afwijkingen) en toont mogelijke dubbele spelers.

**Even controleren:** in `import/aliassen_spelers.csv` staan spelers die als dezelfde persoon zijn samengevoegd (bijnamen, spelfouten, andere schrijfwijzen; met een toelichting per regel). Dit bestand gaat niet online. In `import/aliassen_tegenstanders.csv` staan de clubnamen (bijv. *B'boys* → *Buitenboys*, *W'burg* → *Wartburgia*). Klopt er iets niet, pas de regel aan en draai het script opnieuw.

## 2. De app op de telefoon zetten

**De app staat online op <https://bashavermans-stack.github.io/speelminuten-ah1/>** (repository: <https://github.com/bashavermans-stack/speelminuten-ah1>). Ga verder bij stap 3 hieronder.

Zo is dat ingericht (gratis via GitHub Pages):

1. Maak een (openbare) repository op GitHub en push deze map. Speler-data, Excels en het rapport worden **niet** meegestuurd (zie `.gitignore`).
2. Zet in de repository bij *Settings → Pages* de bron op **GitHub Actions**. De workflow `.github/workflows/publiceer.yml` bouwt en publiceert de app bij elke push.
3. Open het adres (bijv. `https://<naam>.github.io/<repo>/`) in **Chrome op de Android-telefoon** en kies *⋮ → App installeren* (of *Toevoegen aan startscherm*).
4. Stuur `data/voetbal-data.json` naar de telefoon (WhatsApp naar jezelf, mail of Google Drive), open de app en tik op **Gegevens importeren**.

Anderen kunnen de statistieken ook bekijken: geef ze het webadres en een back-upbestand.

## 3. Wekelijks een wedstrijd invoeren

Tab **Invoeren**, in vijf stappen:

1. **Wedstrijd**: datum (standaard de laatste zaterdag), tegenstander, thuis/uit en uitslag (mag later).
2. **Selectie**: *Zelfde als vorige wedstrijd* of *Iedereen van vorig seizoen*, losse spelers aan/uit tikken, oud-spelers terugzoeken of **+ Nieuwe speler**. Bestaat de naam al (ook met andere schrijfwijze, accent of tikfout), dan krijg je eerst *"Bedoel je …?"*.
3. **Basis**: tik de 11 basisspelers aan.
4. **Verloop**: wissels (minuut, eruit, erin), doelpunten, gele en rode kaarten.
5. **Controle**: de minuten worden automatisch berekend; pas ze aan als iets niet klopt. Opslaan.

Halverwege stoppen kan: het concept wordt bewaard. Een opgeslagen wedstrijd is later te bewerken of te verwijderen.

**Maak regelmatig een back-up** (Meer → Back-up & instellingen). De app herinnert je eraan na 3 wijzigingen. Een back-up is ook een manier om de data naar een andere telefoon over te zetten.

## Goed om te weten

- **≈ betekent geschat.** In de Excels staan alleen minuten, niet wie er in de basis begon. Voor die wedstrijden is basis/invaller geschat (90 minuten = basis; de overige basisplaatsen gaan naar wie de meeste minuten had). Minuten en aantallen wedstrijden zijn exact. Nieuwe wedstrijden worden exact vastgelegd.
- 2011-12 ontbreekt in de Excels; van de eerste helft van 2010-11 zijn alleen totalen bekend (die tellen mee in de totalen).
- Historische rode kaarten komen uit de notities onder de Excel-tabellen en zijn mogelijk niet compleet.
- Dubbel ingevoerde speler of club? *Meer → Back-up & instellingen → samenvoegen*.

## Voor ontwikkelaars

```bash
cd app
npm install
npm run dev      # ontwikkelserver op http://localhost:5173
npm test         # unit tests (incl. controle tegen de echte data als data/voetbal-data.json bestaat)
npm run build    # productieversie in app/dist
```

Opbouw: `src/lib/` (naamcontrole, minutenberekening, back-up), `src/stats/` (alle statistieken als pure functies), `src/schermen/` (de pagina's), `src/db.ts` (IndexedDB via Dexie).
