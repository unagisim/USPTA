// Description courte d'une saisie, pour la feuille de match et les corrections.

import { formatPoints, type LogEntry, type MatchEvent, type Side } from './engine';

export function describeEntry(entry: LogEntry, names: Record<Side, string>): string {
  const { event: e, before, outcome: o } = entry;
  switch (e.kind) {
    case 'serve':
      if (e.call === 'ace') return `Ace ${names[before.server]} (${ball(before.serveNumber)})`;
      if (e.call === 'net') return `Filet, ${before.serveNumber === 1 ? '1re' : '2e'} balle`;
      if (o.serveCall === 'double_fault') return `Double faute ${names[before.server]}${e.call === 'net_fault' ? ' (filet)' : ''}`;
      return e.call === 'net_fault' ? 'Filet, faute (1re balle)' : 'Faute (1re balle)';
    case 'point':
      return `Point ${names[e.winner]} (service ${names[before.server]}, ${ball(before.serveNumber)})`;
    case 'let':
      return 'Let, point à rejouer';
    case 'conduct':
      return `Code de conduite ${names[e.player]} : ${e.offence}`;
    case 'time_violation':
      return `Dépassement de temps ${names[e.player]}`;
    case 'set_server':
      return `Correction : ${names[e.server]} au service`;
    case 'adjust':
      return 'Correction : score fixé à la main';
    case 'end':
      return `${e.type === 'retirement' ? 'Abandon' : e.type === 'disqualification' ? 'Disqualification' : 'Forfait'} ${names[e.loser]}`;
    default:
      return e.kind;
  }
}

const ball = (n: 1 | 2) => (n === 1 ? '1re balle' : '2e balle');

/** Description d'un événement annulé (absent du journal rejoué). */
export function describeRaw(e: MatchEvent, names: Record<Side, string>): string {
  switch (e.kind) {
    case 'serve':
      return { fault: 'Faute', net_fault: 'Filet, faute', net: 'Filet', ace: 'Ace' }[e.call];
    case 'point':
      return `Point ${names[e.winner]}`;
    case 'let':
      return 'Let, point à rejouer';
    case 'conduct':
      return `Code de conduite ${names[e.player]} : ${e.offence}`;
    case 'time_violation':
      return `Dépassement de temps ${names[e.player]}`;
    case 'set_server':
      return `Correction : ${names[e.server]} au service`;
    case 'adjust':
      return 'Correction : score fixé à la main';
    case 'end':
      return `${e.type === 'retirement' ? 'Abandon' : e.type === 'disqualification' ? 'Disqualification' : 'Forfait'} ${names[e.loser]}`;
    default:
      return e.kind;
  }
}

/** Score avant une saisie : « Manche 1 · 3-2 · 30-15 ». */
export function scoreBefore(entry: LogEntry): string {
  const b = entry.before;
  const pts = formatPoints(b);
  const set = b.completedSets.length + 1;
  const games = b.isSuperTiebreakSet ? 'super jeu décisif' : `${b.games.A}-${b.games.B}`;
  return `Manche ${set} · ${games} · ${pts.A}-${pts.B}`;
}

const TIMERS = { warmup: 'Échauffement', medical: 'Temps mort médical', toilet: 'Pause toilettes', interruption: 'Interruption' };

export function describeTimer(e: Extract<MatchEvent, { kind: 'timer' }>, names: Record<Side, string>): string {
  const who = e.player ? ` ${names[e.player]}` : '';
  return `${TIMERS[e.timer]}${who} : ${e.action === 'start' ? 'début' : 'fin'}`;
}
