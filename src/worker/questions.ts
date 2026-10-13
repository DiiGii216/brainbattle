/**
 * Serverseitiger Fragenkatalog (wird NIE ins Frontend-Bundle importiert).
 * Editierbar ohne Admin-Oberfläche: einfach Einträge in QUESTIONS ändern.
 * Quellenabgleich mit Folien 3–24 der PDF steht noch aus (PDF lag nicht vor), siehe CLAUDE.md.
 *
 * match: pairs[i] = {left,right}; rightOrder[k] = Index des Paars, dessen "right" an Anzeigeposition k steht.
 * order: items in KORREKTER Reihenfolge; display[k] = Index in items, der an Anzeigeposition k erscheint.
 * tf: correct=true bedeutet "Fakt".
 */
interface Base {
  id: number
  topic: string
  level: 'KNOW' | 'PROVE'
  difficulty: 1 | 2 | 3
  seconds: number
  prompt: string
  explanation: string // max. 25 Wörter
  source?: 'folien-entwurf' | 'extern'
}
export type Question = Base &
  (
    | { format: 'mc' | 'who'; options: [string, string, string, string]; correct: number }
    | { format: 'tf'; correct: boolean }
    | { format: 'match'; pairs: { left: string; right: string }[]; rightOrder: number[] }
    | { format: 'order'; items: string[]; display: number[] }
  )

const K = (seconds = 16) => ({ level: 'KNOW' as const, seconds })
const P = (seconds = 24) => ({ level: 'PROVE' as const, seconds })

export const QUESTIONS: Question[] = [
  { id: 1, topic: 'Aufbau- und Ablauforganisation', ...K(), difficulty: 1, format: 'match',
    prompt: 'Ordne zu: Worum geht es bei …?',
    pairs: [
      { left: 'Aufbauorganisation', right: 'Zuständigkeiten und Hierarchien' },
      { left: 'Ablauforganisation', right: 'Arbeitsabläufe und Prozessreihenfolge' },
    ],
    rightOrder: [1, 0],
    explanation: 'Aufbau regelt, wer wofür zuständig ist. Ablauf regelt, in welcher Reihenfolge Arbeit geschieht.' },
  { id: 2, topic: 'Gegenstromverfahren', ...K(), difficulty: 2, format: 'mc',
    prompt: 'Was charakterisiert das Gegenstromverfahren?',
    options: [
      'Planung ausschließlich von der Geschäftsführung nach unten',
      'Abstimmung von Zielvorgaben und Rückmeldungen verschiedener Hierarchieebenen',
      'Planung ausschließlich durch die Mitarbeitenden von unten nach oben',
      'Auslagerung der gesamten Planung an externe Beratungen',
    ], correct: 1,
    explanation: 'Vorgaben von oben und Rückmeldungen von unten werden abgestimmt – Top-down und Bottom-up gemeinsam.' },
  { id: 3, topic: 'Strategische Personalplanung', ...K(), difficulty: 1, format: 'tf',
    prompt: 'Strategische Personalplanung richtet sich an langfristigen Unternehmenszielen aus.',
    correct: true,
    explanation: 'Sie leitet den langfristigen Personalbedarf aus der Unternehmensstrategie ab, oft über mehrere Jahre.' },
  { id: 4, topic: 'Operative Personalplanung', ...K(), difficulty: 1, format: 'who',
    prompt: 'Ich plane konkret, wann, wo und mit welcher Qualifikation Mitarbeitende kurzfristig benötigt werden. Wer bin ich?',
    options: ['Strategische Personalplanung', 'Personalcontrolling', 'Operative Personalplanung', 'Gegenstromverfahren'],
    correct: 2,
    explanation: 'Operative Personalplanung ist kurzfristig und konkret: Einsatz, Zeit, Ort und Qualifikation.' },
  { id: 5, topic: 'Personalmarketing', ...K(), difficulty: 1, format: 'match',
    prompt: 'Ordne zu: Was ist das Ziel?',
    pairs: [
      { left: 'Internes Personalmarketing', right: 'Bestehende Mitarbeitende binden' },
      { left: 'Externes Personalmarketing', right: 'Potenzielle Mitarbeitende gewinnen' },
    ],
    rightOrder: [1, 0],
    explanation: 'Intern: vorhandenes Personal halten und motivieren. Extern: neue Talente auf das Unternehmen aufmerksam machen.' },
  { id: 6, topic: 'Erweiterter Wirtschaftskreislauf', ...K(), difficulty: 2, format: 'mc',
    prompt: 'Welche zusätzlichen Akteure betrachtet der erweiterte Wirtschaftskreislauf gegenüber dem einfachen Modell?',
    options: [
      'Nur weitere Unternehmen und Haushalte im Inland',
      'Gewerkschaften und Arbeitgeberverbände',
      'Insbesondere Staat und Kapitalsammelstellen',
      'Ausschließlich Lieferanten und Kunden eines Betriebs',
    ], correct: 2,
    source: 'folien-entwurf',
    explanation: 'Das einfache Modell kennt Haushalte und Unternehmen. Erweitert kommen Staat und Kapitalsammelstellen (z. B. Banken) hinzu.' },
  { id: 7, topic: 'Bruttoinlandsprodukt', ...K(), difficulty: 2, format: 'mc',
    prompt: 'Was misst das Bruttoinlandsprodukt (BIP)?',
    options: [
      'Den Wert der im Inland produzierten Endgüter und Dienstleistungen in einem Zeitraum, ohne Doppelzählung von Vorleistungen',
      'Die Summe aller Löhne und Gehälter eines Landes vor Steuern',
      'Den Gesamtwert aller Exporte abzüglich der Importe',
      'Den Wert aller Umsätze inklusive aller Vorleistungen, die mehrfach gezählt werden',
    ], correct: 0,
    explanation: 'Das BIP zählt nur Endprodukte, die im Inland in einem Zeitraum entstehen. Vorleistungen werden nicht doppelt gezählt.' },
  { id: 8, topic: 'Konjunkturzyklus', ...K(), difficulty: 2, format: 'order',
    prompt: 'Bringe die Konjunkturphasen in die richtige Reihenfolge – beginne beim Aufschwung.',
    items: ['Aufschwung', 'Boom', 'Abschwung', 'Tiefphase'], display: [2, 0, 3, 1],
    explanation: 'Der Zyklus läuft: Aufschwung, Boom (Höhepunkt), Abschwung, Tiefphase – und beginnt danach wieder von vorn.' },
  { id: 9, topic: 'Industrie 4.0', ...K(), difficulty: 1, format: 'tf',
    prompt: 'Industrie 4.0 dreht sich ausschließlich um neue Maschinen. Digitale Vernetzung spielt keine Rolle.',
    correct: false,
    explanation: 'Im Kern steht die digitale Vernetzung von Maschinen, Daten und Prozessen – nicht nur neue Hardware.' },
  { id: 10, topic: 'Friktionelle Arbeitslosigkeit', ...K(), difficulty: 1, format: 'who',
    prompt: 'Ich entstehe oft zwischen zwei Jobs und bin meistens nur von kurzer Dauer. Wer bin ich?',
    options: ['Friktionelle Arbeitslosigkeit', 'Strukturelle Arbeitslosigkeit', 'Saisonale Arbeitslosigkeit', 'Konjunkturelle Arbeitslosigkeit'],
    correct: 0,
    explanation: 'Friktionelle Arbeitslosigkeit entsteht beim Stellenwechsel durch Suchzeit und ist meist kurz.' },

  { id: 11, topic: 'Aufbau- und Ablauforganisation', ...P(), difficulty: 2, format: 'match',
    prompt: 'Ordne die Beispiele dem Schwerpunkt zu.',
    pairs: [
      { left: 'Unklare Genehmigungsberechtigung', right: 'Entscheidungszuständigkeit / Aufbau' },
      { left: 'Reihenfolge eines Onboarding-Prozesses', right: 'Prozessgestaltung / Ablauf' },
      { left: 'Berichtslinie eines Teams', right: 'Hierarchie / Aufbau' },
    ],
    rightOrder: [2, 0, 1],
    explanation: 'Zuständigkeit und Berichtslinie gehören zum Aufbau. Die Reihenfolge von Arbeitsschritten gehört zum Ablauf.' },
  { id: 12, topic: 'Gegenstromverfahren', ...P(), difficulty: 2, format: 'mc',
    prompt: 'Die Geschäftsführung nennt einen Personalbedarf. Fachabteilungen prüfen die Umsetzbarkeit und melden Anpassungsvorschläge zurück. Gemeinsam wird der Plan überarbeitet. Welches Verfahren ist das?',
    options: ['Reines Top-down-Verfahren', 'Reines Bottom-up-Verfahren', 'Delphi-Methode', 'Gegenstromverfahren'],
    correct: 3,
    explanation: 'Vorgabe von oben, Rückmeldung von unten, gemeinsame Überarbeitung: das ist typisch für das Gegenstromverfahren.' },
  { id: 13, topic: 'Strategische Personalplanung', ...P(), difficulty: 2, format: 'mc',
    prompt: 'Ein Betrieb will in fünf Jahren große Produktionsbereiche automatisieren. Welche Personalmaßnahme passt?',
    options: [
      'Sofort den Dienstplan der nächsten Woche überarbeiten',
      'Langfristig den Qualifikationsbedarf untersuchen und Personalentwicklungsmaßnahmen planen',
      'Abwarten und erst bei der Umstellung reagieren',
      'Nur eine kurzfristige Stellenanzeige für Aushilfen schalten',
    ], correct: 1,
    explanation: 'Ein Fünf-Jahres-Horizont verlangt strategische Planung: künftigen Qualifikationsbedarf klären und Entwicklung rechtzeitig starten.' },
  { id: 14, topic: 'Operative Personalplanung', ...P(32), difficulty: 3, format: 'match',
    prompt: 'Ordne jeder Situation die passende operative Maßnahme zu.',
    pairs: [
      { left: 'Kurzfristiger krankheitsbedingter Ausfall', right: 'Vertretung organisieren' },
      { left: 'Auftragsspitze im nächsten Monat', right: 'Temporäre Personalkapazität planen' },
      { left: 'Ungedeckte Schicht im Dienstplan', right: 'Personaleinsatzplan anpassen' },
    ],
    rightOrder: [1, 2, 0],
    explanation: 'Operative Planung reagiert konkret und kurzfristig: Vertretung, zeitlich begrenzte Kapazität, angepasster Einsatzplan.' },
  { id: 15, topic: 'Personalmarketing', ...P(), difficulty: 2, format: 'tf',
    prompt: 'Wenn ein Unternehmen viele Bewerbungen erhält, spielt eine schlechte Kommunikation mit Bewerbenden keine Rolle mehr.',
    correct: false,
    explanation: 'Der Umgang mit Bewerbenden prägt das Arbeitgeberimage – auch bei vielen Bewerbungen. Schlechte Kommunikation schadet langfristig.' },
  { id: 16, topic: 'Erweiterter Wirtschaftskreislauf', ...P(32), difficulty: 3, format: 'match',
    prompt: 'Wer ist jeweils der Empfänger des Geldstroms?',
    pairs: [
      { left: 'Private Haushalte zahlen Einkommensteuer', right: 'Staat' },
      { left: 'Staat zahlt Sozialleistung', right: 'Private Haushalte' },
      { left: 'Private Haushalte legen Geld bei einer Bank an', right: 'Kapitalsammelstelle' },
    ],
    rightOrder: [2, 0, 1],
    explanation: 'Steuern gehen an den Staat, Sozialleistungen an Haushalte, Spareinlagen an Kapitalsammelstellen wie Banken.' },
  { id: 17, topic: 'Bruttoinlandsprodukt', ...P(), difficulty: 3, format: 'tf',
    prompt: 'Ein Unternehmen mit französischem Firmensitz produziert Waren in Deutschland. Diese Produktion zählt grundsätzlich ausschließlich zum französischen BIP.',
    correct: false,
    explanation: 'Das BIP folgt dem Inlandskonzept: Entscheidend ist grundsätzlich der Produktionsort, hier Deutschland – nicht der Firmensitz.' },
  { id: 18, topic: 'Konjunkturzyklus', ...P(), difficulty: 2, format: 'mc',
    prompt: 'Nach dem Höhepunkt gehen die Aufträge zurück, Unternehmen reduzieren Investitionen und planen vorsichtiger mit Personal. Welche Phase ist das?',
    options: ['Aufschwung', 'Boom', 'Abschwung', 'Tiefphase'],
    correct: 2,
    explanation: 'Sinkende Aufträge und zurückhaltende Investitionen nach dem Höhepunkt kennzeichnen den Abschwung.' },
  { id: 19, topic: 'Industrie 4.0', ...P(), difficulty: 2, format: 'mc',
    prompt: 'Vernetzte Maschinensensoren erkennen einen drohenden Defekt, bevor die Maschine ausfällt. Was beschreibt das?',
    options: [
      'Vernetzte Datenanalyse und vorausschauende Wartung im Sinne von Industrie 4.0',
      'Klassische Wartung nach festem Kalenderintervall',
      'Reparatur erst nach dem Ausfall (reaktive Instandhaltung)',
      'Manuelle Sichtkontrolle durch die Schichtleitung',
    ], correct: 0,
    explanation: 'Sensordaten werden vernetzt ausgewertet, um Wartung vorausschauend zu planen (Predictive Maintenance).' },
  { id: 20, topic: 'Friktionelle Arbeitslosigkeit', ...P(), difficulty: 2, format: 'mc',
    prompt: 'Eine Beschäftigte beendet ihre bisherige Tätigkeit und sucht einige Wochen nach einer passenden neuen Stelle. Welche Form der Arbeitslosigkeit liegt vor?',
    options: ['Strukturelle Arbeitslosigkeit', 'Konjunkturelle Arbeitslosigkeit', 'Saisonale Arbeitslosigkeit', 'Friktionelle Arbeitslosigkeit'],
    correct: 3,
    explanation: 'Kurze Suchphase zwischen zwei Stellen: typisch friktionelle Arbeitslosigkeit.' },
]
