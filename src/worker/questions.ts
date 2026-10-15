/**
 * Serverseitiger Fragenkatalog (wird NIE ins Frontend-Bundle importiert).
 * Editierbar ohne Admin-Oberfläche: einfach Einträge in QUESTIONS ändern.
 * Stand: Fragenkatalog V3 (Schwerpunkt Personalfachwirt).
 *
 * match: pairs[i] = {left,right}; rightOrder[k] = Index des Paars, dessen "right" an Anzeigeposition k steht.
 * order: items in KORREKTER Reihenfolge; display[k] = Index in items, der an Anzeigeposition k erscheint.
 * tf: correct=true bedeutet "Fakt".
 */
interface Base {
  id: number
  topic: string
  level: 'KNOW' | 'PROVE'
  difficulty: number // 1–10 (Katalog V3)
  seconds: number
  prompt: string
  explanation: string // max. 25 Wörter
  /** folien = Begriff/Aussage auf Folie 3–24 geprüft; extern = Ergänzung/Beispiel außerhalb der Folien */
  source?: 'folien' | 'extern'
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
  { id: 1, topic: 'Aufbau- und Ablauforganisation', ...K(), difficulty: 3, format: 'match',
    prompt: 'Ordne die Begriffe ihrer Funktion zu.',
    pairs: [
      { left: 'Aufbauorganisation', right: 'Zuständigkeiten und Hierarchien' },
      { left: 'Ablauforganisation', right: 'Reihenfolge von Arbeitsabläufen' },
    ],
    rightOrder: [1, 0],
    explanation: 'Die Aufbauorganisation legt Verantwortlichkeiten fest. Die Ablauforganisation beschreibt, wie Tätigkeiten nacheinander durchgeführt werden.' },
  { id: 2, topic: 'Gegenstromverfahren', ...K(), difficulty: 4, format: 'mc',
    prompt: 'Was kennzeichnet das Gegenstromverfahren?',
    options: [
      'Nur die Geschäftsführung legt alle Pläne fest.',
      'Vorgaben von oben und Rückmeldungen von unten werden abgestimmt.',
      'Jede Abteilung plant völlig unabhängig.',
      'Der Personalplan wird nur rückblickend erstellt.',
    ], correct: 1,
    explanation: 'Top-down-Vorgaben und Bottom-up-Rückmeldungen werden wechselseitig geprüft und zu einem abgestimmten Plan zusammengeführt.' },
  { id: 3, topic: 'Bruttoinlandsprodukt', ...K(), difficulty: 6, format: 'mc',
    prompt: 'Ein Endprodukt enthält bereits zugekaufte Vorleistungen. Wie werden diese beim BIP berücksichtigt?',
    options: [
      'Sie werden zusätzlich vollständig zum Endprodukt addiert.',
      'Nur Vorleistungen aus dem Inland werden doppelt gezählt.',
      'Das Endprodukt wird bei der Berechnung ignoriert.',
      'Sie werden nicht nochmals zum Wert des Endprodukts addiert.',
    ], correct: 3,
    explanation: 'Vorleistungen stecken bereits im Endprodukt. Eine zusätzliche Zählung würde den Wert der Produktion künstlich erhöhen.' },
  { id: 4, topic: 'Personalmarketing', ...K(), difficulty: 5, format: 'match',
    prompt: 'Was gehört zu welchem Bereich des Personalmarketings?',
    pairs: [
      { left: 'Internes Personalmarketing', right: 'Bestehende Mitarbeitende binden' },
      { left: 'Externes Personalmarketing', right: 'Neue Mitarbeitende gewinnen' },
    ],
    rightOrder: [1, 0],
    explanation: 'Internes Personalmarketing stärkt die Bindung. Externes Personalmarketing spricht Menschen außerhalb des Unternehmens an.' },
  { id: 5, topic: 'Operative Personalplanung', ...K(), difficulty: 4, format: 'who',
    prompt: 'Ich kläre kurzfristig, wie viele geeignete Mitarbeitende wann und wo eingesetzt werden. Wer bin ich?',
    options: ['Strategische Personalplanung', 'Operative Personalplanung', 'Konjunkturanalyse', 'Arbeitgeberpositionierung'],
    correct: 1,
    explanation: 'Operative Personalplanung übersetzt den Bedarf in konkrete Personal- und Einsatzentscheidungen für einen überschaubaren Zeitraum.' },
  { id: 6, topic: 'Industrie 4.0 und digitale Personalarbeit', ...K(), difficulty: 6, format: 'tf',
    prompt: 'Eine digitale Personalakte allein erfüllt noch nicht den Kerngedanken von Industrie 4.0.',
    correct: true,
    explanation: 'Eine digitale Personalakte digitalisiert die Verwaltung. Industrie 4.0 steht für intelligent vernetzte Produktionsprozesse und verändert dadurch auch den Qualifikationsbedarf.' },
  { id: 7, topic: 'Konjunkturzyklus', ...K(), difficulty: 5, format: 'order',
    prompt: 'Ordne die Konjunkturphasen, beginnend beim Aufschwung.',
    items: ['Aufschwung', 'Boom', 'Abschwung', 'Tiefphase'], display: [2, 0, 3, 1],
    explanation: 'Aufschwung und Boom stehen vor Abschwung und Tiefphase. Danach kann ein neuer Aufschwung beginnen.' },
  { id: 8, topic: 'Strategische Personalplanung', ...K(), difficulty: 5, format: 'tf',
    prompt: 'Strategische Personalplanung betrachtet langfristig auch benötigte Qualifikationen – nicht nur die Zahl der Beschäftigten.',
    correct: true,
    explanation: 'Für langfristige Unternehmensziele sind sowohl die Anzahl als auch die Kompetenzen zukünftiger Mitarbeitender entscheidend.' },
  { id: 9, topic: 'Friktionelle Arbeitslosigkeit', ...K(), difficulty: 6, format: 'who',
    prompt: 'Passende Stellen existieren, doch der Wechsel dauert wegen Suche und Auswahl einige Wochen. Welche Arbeitslosigkeit ist gemeint?',
    options: ['Konjunkturelle Arbeitslosigkeit', 'Strukturelle Arbeitslosigkeit', 'Friktionelle Arbeitslosigkeit', 'Saisonale Arbeitslosigkeit'],
    correct: 2,
    explanation: 'Friktionelle Arbeitslosigkeit entsteht durch Such- und Übergangszeiten zwischen Beschäftigungen – auch wenn grundsätzlich passende Stellen vorhanden sind.' },
  { id: 10, topic: 'Erweiterter Wirtschaftskreislauf', ...K(), difficulty: 5, format: 'mc',
    prompt: 'Ein Haushalt bekommt eine staatliche Leistung und spart einen Teil bei der Bank. Welche zusätzlichen Akteure zeigt das erweiterte Kreislaufmodell?',
    options: ['Staat und Kapitalsammelstellen', 'Nur Lieferanten und Kunden', 'Nur Arbeitgeber und Gewerkschaften', 'Nur Unternehmen aus dem Ausland'],
    correct: 0,
    explanation: 'Neben Haushalten und Unternehmen werden beispielsweise der Staat sowie Kapitalsammelstellen mit ihren Geldströmen berücksichtigt.' },

  { id: 11, topic: 'Demografischer Wandel und Beschäftigungssicherung', ...P(), difficulty: 8, format: 'mc',
    prompt: 'Viele erfahrene Beschäftigte stehen vor dem Rentenalter. Einige möchten länger arbeiten. Welche Personalstrategie ist am sinnvollsten?',
    options: [
      'Frei werdende Stellen ausschließlich anhand der bisherigen Stellenprofile extern nachbesetzen.',
      'Altersstruktur und Belastungen prüfen sowie flexible Beschäftigung und Wissenstransfer planen.',
      'Weiterbeschäftigungswünsche erfassen, aber Qualifikations- und Belastungsanalysen auf spätere Jahre verschieben.',
      'Ausschließlich neue Rekrutierungskanäle nutzen und den internen Wissenstransfer unverändert lassen.',
    ], correct: 1,
    explanation: 'Demografiegerechte Personalplanung verbindet Altersstrukturanalyse, geeignete Arbeitsbedingungen, Wissenstransfer und Weiterbeschäftigungsmöglichkeiten.' },
  { id: 12, topic: 'Dimensionen der Personalbedarfsplanung', ...P(), difficulty: 7, format: 'match',
    prompt: 'Ordne die Situationen der richtigen Dimension der Personalbedarfsplanung zu.',
    pairs: [
      { left: 'Für eine neue Schicht werden fünf zusätzliche Kräfte benötigt.', right: 'Quantitativer Personalbedarf' },
      { left: 'Eine neue Software erfordert besondere IT-Kenntnisse.', right: 'Qualitativer Personalbedarf' },
      { left: 'Zusätzliche Mitarbeitende werden ab November benötigt.', right: 'Zeitlicher Personalbedarf' },
    ],
    rightOrder: [2, 0, 1],
    explanation: 'Personalbedarfsplanung beantwortet drei Fragen: Wie viele Mitarbeitende werden benötigt? Welche Qualifikationen brauchen sie? Wann werden sie gebraucht?' },
  { id: 13, topic: 'Beschäftigungspolitik und Arbeitsförderung', ...P(32), difficulty: 9, format: 'match',
    prompt: 'Welche personal- oder beschäftigungspolitische Maßnahme passt am besten zur Situation?',
    pairs: [
      { left: 'Vorübergehender, unvermeidbarer Auftragsausfall; Arbeitsplätze sollen erhalten bleiben.', right: 'Kurzarbeit unter gesetzlichen Voraussetzungen prüfen' },
      { left: 'Eine neue Produktionssoftware erfordert zusätzliche Kenntnisse.', right: 'Gezielte Weiterbildung organisieren' },
      { left: 'Eine arbeitsuchende Person benötigt wegen erwarteter Minderleistung eine längere Einarbeitung.', right: 'Eingliederungszuschuss als mögliche Förderung prüfen' },
    ],
    rightOrder: [1, 2, 0],
    explanation: 'Kurzarbeit kann Beschäftigung sichern. Weiterbildung schließt Kompetenzlücken. Bei erschwerter Vermittlung kommen unter bestimmten Voraussetzungen Fördermöglichkeiten infrage.' },
  { id: 14, topic: 'Externes Personalmarketing', ...P(), difficulty: 7, format: 'tf',
    prompt: 'Eine Stellenkampagne bringt doppelt so viele Bewerbungen wie zuvor, aber nicht mehr geeignete Kandidaten. Der Rekrutierungserfolg hat sich damit nachweislich verbessert.',
    correct: false,
    explanation: 'Für die erfolgreiche Stellenbesetzung zählt nicht nur die Bewerbungsmenge, sondern insbesondere die Anzahl fachlich geeigneter Kandidaten.' },
  { id: 15, topic: 'Personalplanung und Beschäftigungsvolumen', ...P(), difficulty: 9, format: 'tf',
    prompt: 'Ein Betrieb ersetzt acht Vollzeitstellen mit je 40 Wochenstunden durch zehn Teilzeitstellen mit je 30 Wochenstunden. Dadurch steigt die insgesamt vereinbarte Wochenarbeitszeit.',
    correct: false,
    explanation: 'Vorher: 8 × 40 = 320 Stunden. Nachher: 10 × 30 = 300 Stunden. Die Kopfzahl steigt, das Arbeitsvolumen sinkt um 20 Stunden.' },
  { id: 16, topic: 'Operative Personalplanung', ...P(32), difficulty: 8, format: 'match',
    prompt: 'Welche kurzfristige Personalmaßnahme passt am besten?',
    pairs: [
      { left: 'Zwei Beschäftigte fallen für morgen aus.', right: 'Geeignete Vertretung einplanen' },
      { left: 'Für nächsten Monat wird eine Auftragsspitze erwartet.', right: 'Zeitlich begrenzte Zusatzkapazität planen' },
      { left: 'Im Dienstplan fehlen Fachkräfte für eine Schicht.', right: 'Qualifikationsgerechte Einsätze umplanen' },
    ],
    rightOrder: [2, 0, 1],
    explanation: 'Operative Planung deckt konkrete Kapazitäts- und Qualifikationsbedarfe innerhalb eines kurzen Planungszeitraums.' },
  { id: 17, topic: 'Friktionelle Arbeitslosigkeit und Personalgewinnung', ...P(), difficulty: 8, format: 'mc',
    prompt: 'Eine Fachkraft ist derzeit arbeitslos. Es gibt mehrere passende offene Stellen, doch Bewerbungen und Auswahlgespräche dauern sechs Wochen. Was erklärt diese Übergangszeit am besten?',
    options: ['Ein dauerhafter Qualifikationsmismatch', 'Eine saisonale Beschäftigungslücke', 'Ein allgemeiner Nachfrageeinbruch', 'Such- und Vermittlungszeiten'],
    correct: 3,
    explanation: 'Friktionelle Arbeitslosigkeit entsteht durch Such- und Vermittlungsprozesse. Auch bei vorhandenen passenden Stellen kann dadurch vorübergehend Arbeitslosigkeit entstehen.' },
  { id: 18, topic: 'Strategische Personalplanung und Demografie', ...P(), difficulty: 9, format: 'mc',
    prompt: 'In vier Jahren gehen viele Fachkräfte in Rente; gleichzeitig kommt neue Technik. Welche Strategie passt am besten?',
    options: [
      'Erst die aktuellen Stellen nachbesetzen; neue Kompetenzen später prüfen.',
      'Ausschließlich externe Einstellungen nach heutigen Stellenprofilen planen.',
      'Altersstruktur und künftige Kompetenzen analysieren sowie Nachfolge und Qualifizierung planen.',
      'Die Belegschaft allgemein schulen, ohne zukünftige Qualifikationslücken zu analysieren.',
    ], correct: 2,
    explanation: 'Strategische Personalplanung verbindet absehbare Personalabgänge mit künftig benötigten Kompetenzen und leitet frühzeitig Maßnahmen ab.' },
  { id: 19, topic: 'Konjunktur und Beschäftigungsplanung', ...P(), difficulty: 7, format: 'mc',
    prompt: 'Nach einem Boom sinken Aufträge und Investitionen. Welche Kombination ist für die Personalplanung am plausibelsten?',
    options: [
      'Abschwung – Personalbedarf neu prognostizieren und flexible Lösungen prüfen.',
      'Tiefphase – Personalbedarf ohne weitere Analyse auf ein Minimum setzen.',
      'Aufschwung – den langfristigen Personalbedarf deutlich erhöhen.',
      'Boom – geplante Kapazitätserweiterungen unverändert fortsetzen.',
    ], correct: 0,
    explanation: 'Rückläufige Nachfrage deutet auf Abschwung. Die Personalplanung muss den geringeren Bedarf berücksichtigen, ohne automatisch Personalabbau vorzuschreiben.' },
  { id: 20, topic: 'Gegenstromverfahren in der Personalplanung', ...P(), difficulty: 8, format: 'mc',
    prompt: 'Die Geschäftsleitung plant 15 zusätzliche Fachkräfte. Die Abteilungen melden nach einer Bedarfsprüfung abweichende Zahlen. Wann entsteht daraus ein Gegenstromverfahren?',
    options: [
      'Die Geschäftsleitung nimmt die Rückmeldungen zur Kenntnis, hält aber ohne Prüfung am ursprünglichen Plan fest.',
      'Geschäftsleitung und Fachabteilungen prüfen ihre Annahmen und stimmen einen angepassten Personalplan ab.',
      'Jede Abteilung beschließt unabhängig von den Unternehmenszielen ihre eigene Personalplanung.',
      'Die Personalabteilung dokumentiert die Planabweichungen erst am Jahresende.',
    ], correct: 1,
    explanation: 'Im Gegenstromverfahren werden Vorgaben und Rückmeldungen über Hierarchieebenen hinweg abgestimmt. Der Personalplan kann dabei angepasst werden.' },
]
