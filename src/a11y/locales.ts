/**
 * Ready-made translations of the accessibility layer's fixed UI text — the EU/EAA audience's
 * most common locales. Each pack is a complete {@link FChartStrings}, typed so a missing key is
 * a compile error, and passed whole to `options.strings` (or spread + overridden per key).
 * Author content (series names, labels, formatted numbers) is the integrator's to localize;
 * these cover only the library's own connective prose (WCAG 3.1.2 Language of Parts).
 */
import type { FChartStrings } from './strings.ts';

export const stringsDE: FChartStrings = {
  legendGroup: 'Datenreihen — aktivieren zum Ein- oder Ausblenden',
  shown: 'eingeblendet',
  hidden: 'ausgeblendet',
  keyboardHelp:
    'Pfeil links und rechts wechseln zwischen Datenpunkten; Pfeil auf und ab wechseln die ' +
    'Datenreihe; Pos1 und Ende springen an die Enden; Umschalttaste für feine Schritte. ' +
    'Plus und Minus zoomen; Escape blendet den Cursor aus. ' +
    'Zur Prüfung mit dem Screenreader folgt eine Datentabelle.',
  eventKeysHelp:
    'Eckige Klammern springen zwischen Ereignismarkern; Enter wählt den fokussierten Marker aus.',
  selected: 'ausgewählt',
  chartName: '{name}. {series} Datenreihen mit je {points} Punkten. {help}',
  tableCaption: '{caption} — {series} Datenreihen, {rows} Stichprobenzeilen im sichtbaren Bereich.',
  summaryNoData: '{label}: keine Daten.',
  summaryAllHidden: '{label}: {points} Punkte pro Datenreihe, alle Datenreihen ausgeblendet.',
  summaryLine: '{label}: {points} Punkte pro Datenreihe von {span}. {parts}.',
  summaryPart: '{name} reicht von {min} bis {max}, aktuell {last} ({dir})',
  summaryEvents: '{count} Ereignisse: {labels}',
  summarySpan: '{start} bis {end}',
  zoomRange: 'Zeige {start} bis {end}',
  trendUp: 'plus {pct} %',
  trendDown: 'minus {pct} %',
  trendFlat: 'unverändert',
  pagerPrev: 'Zu früheren Daten schwenken',
  pagerNext: 'Zu späteren Daten schwenken',
  open: 'Eröffnung',
  high: 'Hoch',
  low: 'Tief',
  close: 'Schluss',
  exportCsv: 'Daten herunterladen (CSV)',
};

export const stringsFR: FChartStrings = {
  legendGroup: 'Séries — activer pour afficher ou masquer',
  shown: 'affichée',
  hidden: 'masquée',
  keyboardHelp:
    "Les flèches gauche et droite passent d'un point à l'autre ; haut et bas changent de " +
    'série ; Début et Fin sautent aux extrémités ; maintenez Maj pour un pas fin. ' +
    'Plus et moins zooment ; Échap efface le curseur. ' +
    "Un tableau de données échantillonné suit pour la lecture par lecteur d'écran.",
  eventKeysHelp:
    "Les touches crochets passent d'un marqueur d'événement à l'autre ; Entrée sélectionne le " +
    'marqueur en focus.',
  selected: 'sélectionné',
  chartName: '{name}. {series} séries de {points} points chacune. {help}',
  tableCaption: '{caption} — {series} séries, {rows} lignes échantillonnées sur la plage visible.',
  summaryNoData: '{label} : aucune donnée.',
  summaryAllHidden: '{label} : {points} points par série, toutes les séries masquées.',
  summaryLine: '{label} : {points} points par série de {span}. {parts}.',
  summaryPart: '{name} varie de {min} à {max}, actuellement {last} ({dir})',
  summaryEvents: '{count} événements : {labels}',
  summarySpan: '{start} à {end}',
  zoomRange: 'Affichage de {start} à {end}',
  trendUp: 'en hausse de {pct} %',
  trendDown: 'en baisse de {pct} %',
  trendFlat: 'stable',
  pagerPrev: 'Voir les données précédentes',
  pagerNext: 'Voir les données suivantes',
  open: 'ouverture',
  high: 'plus haut',
  low: 'plus bas',
  close: 'clôture',
  exportCsv: 'Télécharger les données (CSV)',
};

export const stringsES: FChartStrings = {
  legendGroup: 'Series — activar para mostrar u ocultar',
  shown: 'visible',
  hidden: 'oculta',
  keyboardHelp:
    'Las flechas izquierda y derecha se mueven entre muestras; arriba y abajo cambian de ' +
    'serie; Inicio y Fin saltan a los extremos; mantenga Mayús para pasos finos. ' +
    'Más y menos hacen zoom; Escape borra el cursor. ' +
    'A continuación hay una tabla de datos muestreada para revisión con lector de pantalla.',
  eventKeysHelp:
    'Las teclas de corchete saltan entre marcadores de eventos; Intro selecciona el marcador ' +
    'enfocado.',
  selected: 'seleccionado',
  chartName: '{name}. {series} series de {points} puntos cada una. {help}',
  tableCaption: '{caption} — {series} series, {rows} filas muestreadas del rango visible.',
  summaryNoData: '{label}: sin datos.',
  summaryAllHidden: '{label}: {points} puntos por serie, todas las series ocultas.',
  summaryLine: '{label}: {points} puntos por serie de {span}. {parts}.',
  summaryPart: '{name} va de {min} a {max}, ahora {last} ({dir})',
  summaryEvents: '{count} eventos: {labels}',
  summarySpan: '{start} a {end}',
  zoomRange: 'Mostrando {start} a {end}',
  trendUp: 'sube {pct} %',
  trendDown: 'baja {pct} %',
  trendFlat: 'estable',
  pagerPrev: 'Desplazar a datos anteriores',
  pagerNext: 'Desplazar a datos posteriores',
  open: 'apertura',
  high: 'máximo',
  low: 'mínimo',
  close: 'cierre',
  exportCsv: 'Descargar datos (CSV)',
};
