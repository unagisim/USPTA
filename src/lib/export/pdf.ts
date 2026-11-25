// Export PDF de la feuille de match (A4). Chargé à la demande pour ne pas alourdir l'application.

import { jsPDF } from 'jspdf';
import { autoTable, type RowInput } from 'jspdf-autotable';
import { ballsRule } from '../annonces';
import type { StoredMatch } from '../db';
import { clock, hour } from '../device';
import { FORMATS, other, serveStatRows, serveStats, type ReplayResult, type SetScore, type Side } from '../engine';
import { resultText, sheetRows, TOSS_CHOICES, type SheetRow } from '../sheet';

type RGB = [number, number, number];
const INK: RGB = [21, 26, 23];
const GREEN: RGB = [11, 61, 46];
const GREY: RGB = [90, 100, 96];
const LIGHT: RGB = [234, 238, 236];
const LINE: RGB = [205, 212, 209];
const SANCTION: RGB = [251, 228, 228];
const CORRECTION: RGB = [253, 239, 207];

const MARGIN = 15;
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - 2 * MARGIN;

const lastY = (doc: jsPDF) => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

/** Les polices standard du PDF ne couvrent que l'alphabet latin : on remplace le reste. */
const txt = (s: string) =>
  s
    .replace(/→/g, '->')
    .replace(/✓/g, 'v')
    .replace(/[^\u0000-ÿ€…–—‘’“”•œŒ]/g, '');

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed <= PAGE_H - 20) return y;
  doc.addPage();
  return MARGIN + 4;
}

function heading(doc: jsPDF, y: number, text: string): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...GREEN);
  doc.text(txt(text), MARGIN, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...INK);
  return y + 3;
}

const date = (ts: number) => new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

/** Case d'une manche pour un joueur : jeux, et points du jeu décisif perdu entre parenthèses. */
function setCell(set: SetScore, s: Side): string {
  if (set.superTiebreak && set.tiebreak) return String(set.tiebreak[s]);
  const g = String(set.games[s]);
  return set.tiebreak && set.games[s] < set.games[other(s)] ? `${g} (${set.tiebreak[s]})` : g;
}

function logTable(doc: jsPDF, y: number, rows: SheetRow[]): number {
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Heure', 'N°', 'Score avant', 'Saisie']],
    body: rows.map((r) => [hour(r.ts), String(r.id), txt(r.score), txt(r.struck ? `[annulée] ${r.text}` : r.text)]),
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 1.4, valign: 'top', lineColor: LINE, lineWidth: 0.2, textColor: INK },
    headStyles: { fillColor: LIGHT, textColor: INK, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 14 }, 1: { cellWidth: 10, halign: 'right' }, 2: { cellWidth: 46 } },
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      const row = rows[data.row.index];
      if (row.kind === 'sanction') data.cell.styles.fillColor = SANCTION;
      if (row.kind === 'correction') data.cell.styles.fillColor = CORRECTION;
      if (row.struck) data.cell.styles.textColor = GREY;
    },
  });
  return lastY(doc);
}

export function buildSheetPdf(m: StoredMatch, r: ReplayResult, names: Record<Side, string>): { blob: Blob; fileName: string } {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const format = FORMATS[m.formatId];
  const s = r.state;
  const day = date(r.start || m.createdAt);
  const title = `Feuille de match · ${names.A} – ${names.B}`;
  doc.setProperties({ title: txt(title), creator: 'USPTA' });

  // ---- En-tête ----
  let y = MARGIN + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(...INK);
  doc.text('Feuille de match', MARGIN, y);
  y += 6.5;
  doc.setFontSize(11);
  doc.text(txt(m.info.tournament || 'Compétition non renseignée'), MARGIN, y, { maxWidth: CONTENT_W });
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...GREY);
  const sub = [m.info.round, m.info.court ? `Court ${m.info.court}` : '', day, m.info.team ? 'Match par équipes' : ''].filter(Boolean).join('  ·  ');
  doc.text(txt(sub), MARGIN, y);
  y += 5;

  // ---- Officiels et format ----
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    body: [
      ['Juge-arbitre', txt(m.info.referee || '—'), 'Arbitre', txt(`${m.info.umpire || '—'}${m.info.umpireLicence ? ` (licence ${m.info.umpireLicence})` : ''}`)],
      ['Format', txt(`${format.label} : ${format.description}`), 'Balles', txt(ballsRule(m.balls))],
    ],
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 1.2, textColor: INK, valign: 'top' },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 24 }, 2: { fontStyle: 'bold', cellWidth: 16 } },
  });
  y = lastY(doc) + 6;

  // ---- Joueurs ----
  y = heading(doc, y, 'Joueurs');
  const tossWinner = m.toss?.winner;
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['', 'Joueur', 'Club', 'Classement', 'Au départ']],
    body: (['A', 'B'] as const).map((p, i) => {
      const pl = m.players[p];
      const start = [
        m.leftAtStart === p ? 'à gauche de la chaise' : 'à droite de la chaise',
        m.firstServer === p ? '1er serveur' : '',
        tossWinner === p ? `tirage gagné (${TOSS_CHOICES[m.toss!.choice]})` : '',
      ].filter(Boolean);
      return [String(i + 1), txt(names[p]), txt(pl.club || ''), txt(pl.ranking || ''), txt(start.join(', '))];
    }),
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 1.6, lineColor: LINE, lineWidth: 0.2, textColor: INK },
    headStyles: { fillColor: LIGHT, textColor: INK, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 7, halign: 'center' }, 1: { fontStyle: 'bold' }, 3: { cellWidth: 22 } },
  });
  y = lastY(doc) + 8;

  // ---- Résultat ----
  y = heading(doc, y, 'Résultat');
  const sets = [...s.completedSets];
  const inProgress = !s.winner && (s.games.A + s.games.B > 0 || s.points.A + s.points.B > 0);
  const setCount = Math.max(sets.length + (inProgress ? 1 : 0), 1);
  const head = ['Joueur', ...Array.from({ length: setCount }, (_, k) => `Manche ${k + 1}`)];
  const body: RowInput[] = (['A', 'B'] as const).map((p) => {
    const cells = sets.map((set) => setCell(set, p));
    if (inProgress) cells.push(s.isSuperTiebreakSet ? `${s.points[p]}` : `${s.games[p]}`);
    while (cells.length < setCount) cells.push('');
    return [{ content: txt(`${names[p]}${s.winner === p ? '  (vainqueur)' : ''}`), styles: { fontStyle: s.winner === p ? 'bold' : 'normal' } }, ...cells];
  });
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [head],
    body,
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 1.8, lineColor: LINE, lineWidth: 0.2, textColor: INK, halign: 'center' },
    headStyles: { fillColor: LIGHT, textColor: INK, fontStyle: 'bold' },
    columnStyles: { 0: { halign: 'left', cellWidth: 80 } },
  });
  y = lastY(doc) + 5;
  doc.setFontSize(10);
  const result = resultText(r, names) ?? 'Match non terminé';
  doc.setFont('helvetica', 'bold');
  doc.text(txt(result), MARGIN, y);
  doc.setFont('helvetica', 'normal');
  y += 5;
  const times = [
    `Début : ${r.start ? hour(r.start) : '—'}`,
    `Fin : ${r.end ? hour(r.end) : '—'}`,
    r.start && r.end ? `Durée : ${clock(r.end - r.start)}` : '',
  ].filter(Boolean);
  doc.setFontSize(9.5);
  doc.text(txt(times.join('  ·  ')), MARGIN, y);
  y += 8;

  // ---- Sanctions et pauses ----
  y = ensureSpace(doc, y, 30);
  y = heading(doc, y, 'Code de conduite, temps et pauses');
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Joueur', 'Code de conduite', 'Dépassements de temps', 'Pauses toilettes']],
    body: (['A', 'B'] as const).map((p) => [txt(names[p]), String(r.conductCount[p]), String(r.timeViolationCount[p]), `${r.toiletBreaks[p]} / 2`]),
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 1.6, lineColor: LINE, lineWidth: 0.2, textColor: INK, halign: 'center' },
    headStyles: { fillColor: LIGHT, textColor: INK, fontStyle: 'bold' },
    columnStyles: { 0: { halign: 'left', cellWidth: 70 } },
  });
  y = lastY(doc) + 8;

  // ---- Statistiques au service ----
  const statSets = s.completedSets.length + (s.winner ? 0 : 1);
  const statHead = ['', ...(['A', 'B'] as const).map((p) => txt(m.players[p].lastName))];
  const statBody: RowInput[] = [];
  const sections: [string, number | undefined][] = [['Match', undefined]];
  if (statSets > 1) for (let k = 1; k <= statSets; k++) sections.push([`Manche ${k}`, k]);
  for (const [label, k] of sections) {
    if (sections.length > 1) statBody.push([{ content: label, colSpan: 3, styles: { fillColor: LIGHT, fontStyle: 'bold' } }]);
    for (const [l, a, b] of serveStatRows(serveStats(r.log, k))) statBody.push([txt(l), a, b]);
  }
  y = ensureSpace(doc, y, 50);
  y = heading(doc, y, 'Statistiques au service');
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [statHead],
    body: statBody,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 1.3, lineColor: LINE, lineWidth: 0.2, textColor: INK, halign: 'right' },
    headStyles: { fillColor: [255, 255, 255], textColor: INK, fontStyle: 'bold' },
    columnStyles: { 0: { halign: 'left', cellWidth: 70 } },
  });
  y = lastY(doc) + 8;

  // ---- Incidents ----
  const rows = sheetRows(m, r, names);
  const incidents = rows.filter((x) => x.kind !== 'play');
  y = ensureSpace(doc, y, 30);
  y = heading(doc, y, `Incidents, pauses et corrections (${incidents.length})`);
  if (incidents.length) y = logTable(doc, y, incidents) + 8;
  else {
    doc.setFontSize(9.5);
    doc.text('Aucun.', MARGIN, y + 3);
    y += 10;
  }

  // ---- Signatures ----
  y = ensureSpace(doc, y, 32);
  y = heading(doc, y, 'Signatures');
  const boxW = (CONTENT_W - 8) / 2;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.setFontSize(9);
  doc.setTextColor(...GREY);
  for (const [i, label] of [`Arbitre : ${m.info.umpire || ''}`, `Juge-arbitre : ${m.info.referee || ''}`].entries()) {
    const x = MARGIN + i * (boxW + 8);
    doc.rect(x, y + 1, boxW, 22);
    doc.text(txt(label), x + 2, y + 5.5);
  }
  y += 30;

  // ---- Annexe : chronologie complète ----
  doc.addPage();
  y = heading(doc, MARGIN + 4, `Annexe : chronologie complète (${rows.length} saisies)`);
  doc.setFontSize(8.5);
  doc.setTextColor(...GREY);
  doc.text('Fond rouge : code de conduite et temps. Fond jaune : corrections. [annulée] : saisie retirée par une correction.', MARGIN, y + 2);
  doc.setTextColor(...INK);
  logTable(doc, y + 5, rows);

  // ---- Pied de page ----
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...GREY);
    doc.text(txt(`USPTA · ${names.A} – ${names.B} · généré le ${date(Date.now())} à ${hour(Date.now())}`), MARGIN, PAGE_H - 8);
    doc.text(`${i}/${pages}`, PAGE_W - MARGIN, PAGE_H - 8, { align: 'right' });
  }

  const d = new Date(r.start || m.createdAt).toISOString().slice(0, 10);
  const fileName = `feuille-${d}-${slug(m.players.A.lastName)}-${slug(m.players.B.lastName)}.pdf`;
  return { blob: doc.output('blob'), fileName };
}
