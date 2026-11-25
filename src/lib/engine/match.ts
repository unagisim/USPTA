// Rejoue la liste des événements d'un match : score, barèmes, pauses, balles neuves.
// Annuler ou corriger ajoute un événement ; rien n'est effacé, la feuille garde tout.

import {
  adjustScore,
  awardPoints,
  applyPoint,
  endMatch,
  initialState,
  replayPoint,
  serveFault,
  setServer,
  type ScoreState,
} from './score';
import {
  other,
  type MatchConfig,
  type MatchEvent,
  type Pair,
  type ServeCall,
  type Side,
  type TimerKind,
} from './types';

// ---- Barèmes ----

/** Code de conduite FFT : avertissement, 1 point, 3 points, puis disqualification (juge-arbitre). */
export type ConductLevel = 'warning' | 'point' | 'three_points' | 'disqualification';
/** Dépassement de temps volontaire : avertissement, puis 1 point à chaque fois. */
export type TimeLevel = 'warning' | 'point';

const CONDUCT_SCALE: ConductLevel[] = ['warning', 'point', 'three_points', 'disqualification'];
const CONDUCT_POINTS: Record<ConductLevel, number> = { warning: 0, point: 1, three_points: 3, disqualification: 0 };

/** Niveau de la n-ième infraction au code de conduite (n à partir de 1). */
export const conductLevel = (n: number): ConductLevel => CONDUCT_SCALE[Math.min(n, CONDUCT_SCALE.length) - 1];
/** Niveau du n-ième dépassement de temps (n à partir de 1). */
export const timeLevel = (n: number): TimeLevel => (n <= 1 ? 'warning' : 'point');

export type Sanction =
  | { scale: 'conduct'; player: Side; level: ConductLevel; offence: string; points: number }
  | { scale: 'time'; player: Side; level: TimeLevel; points: number };

// ---- Ce que produit chaque événement ----

/** Pause qui suit l'événement. */
export type Rest = 'none' | 'changeover' | 'set_break';

export interface Outcome {
  /** Annonce au service (faute, filet…). */
  serveCall?: ServeCall | 'double_fault';
  /** Joueur qui a gagné le (dernier) point attribué. */
  pointWinner?: Side;
  rallyLet?: boolean;
  gameWinner?: Side;
  setWinner?: Side;
  matchWinner?: Side;
  tiebreakStarts?: boolean;
  superTiebreakStarts?: boolean;
  changeEnds: boolean;
  rest: Rest;
  newBalls: boolean;
  sanction?: Sanction;
}

export interface LogEntry {
  event: MatchEvent;
  /** L'événement a été remplacé par une correction (overrule…). */
  replaced: boolean;
  before: ScoreState;
  after: ScoreState;
  outcome: Outcome;
}

export interface ActiveTimer {
  timer: TimerKind;
  player?: Side;
  start: number;
}

export interface ReplayResult {
  state: ScoreState;
  log: LogEntry[];
  /** Corrections, dans l'ordre, pour la feuille de match. */
  corrections: MatchEvent[];
  conductCount: Pair;
  timeViolationCount: Pair;
  toiletBreaks: Pair;
  activeTimer: ActiveTimer | null;
  /** Dernière pause automatique (changement de côté ou fin de set) et son heure de début. */
  lastRest: { rest: Exclude<Rest, 'none'>; start: number } | null;
  /** Balles neuves reportées après un jeu décisif. */
  ballsDelayed: boolean;
  start: number | null;
  end: number | null;
}

const SCORING = new Set<MatchEvent['kind']>(['serve', 'point', 'let', 'conduct', 'time_violation', 'set_server', 'adjust', 'end']);

/** Résout les corrections : événements annulés retirés, remplacements appliqués. */
function effectiveEvents(events: readonly MatchEvent[]): { list: { event: MatchEvent; replaced: boolean }[]; corrections: MatchEvent[] } {
  const voided = new Set<number>();
  const replacements = new Map<number, MatchEvent>();
  const corrections: MatchEvent[] = [];
  for (const e of events) {
    if (e.kind === 'undo') {
      voided.add(e.target);
      corrections.push(e);
    } else if (e.kind === 'replace') {
      corrections.push(e);
    } else if (e.kind === 'set_server' || e.kind === 'adjust') {
      corrections.push(e);
    }
  }
  for (const e of events) {
    if (e.kind === 'replace' && !voided.has(e.id)) {
      const target = events.find((t) => t.id === e.target);
      if (target) replacements.set(e.target, { ...e.with, id: target.id, ts: target.ts } as MatchEvent);
    }
  }
  const list = events
    .filter((e) => e.kind !== 'undo' && e.kind !== 'replace' && !voided.has(e.id))
    .map((e) => ({ event: replacements.get(e.id) ?? e, replaced: replacements.has(e.id) }));
  return { list, corrections };
}

/** Dernier événement que le bouton « Annuler » peut retirer, ou null. */
export function lastUndoable(events: readonly MatchEvent[]): MatchEvent | null {
  const { list } = effectiveEvents(events);
  for (let i = list.length - 1; i >= 0; i--) {
    if (SCORING.has(list[i].event.kind)) return events.find((e) => e.id === list[i].event.id) ?? null;
  }
  return null;
}

function describe(before: ScoreState, after: ScoreState): Outcome {
  const o: Outcome = { changeEnds: false, rest: 'none', newBalls: false };
  for (const side of ['A', 'B'] as const) {
    const setWon = after.setsWon[side] > before.setsWon[side];
    if (setWon) o.setWinner = side;
    if (setWon || after.games[side] > before.games[side]) o.gameWinner = side;
  }
  if (after.winner && !before.winner) o.matchWinner = after.winner;
  if (after.inTiebreak && !before.inTiebreak) {
    if (after.isSuperTiebreakSet) o.superTiebreakStarts = true;
    else o.tiebreakStarts = true;
  }
  o.changeEnds = (after.endChanges - before.endChanges) % 2 === 1;
  if (o.setWinner && !o.matchWinner) {
    o.rest = 'set_break';
  } else if (o.changeEnds && o.gameWinner && !o.matchWinner) {
    // Pas de pause après le 1er jeu d'un set.
    o.rest = after.games.A + after.games.B === 1 ? 'none' : 'changeover';
  }
  return o;
}

export function replay(config: MatchConfig, events: readonly MatchEvent[]): ReplayResult {
  const { list, corrections } = effectiveEvents(events);
  let s = initialState(config);
  const log: LogEntry[] = [];
  const conductCount: Pair = { A: 0, B: 0 };
  const timeViolationCount: Pair = { A: 0, B: 0 };
  const toiletBreaks: Pair = { A: 0, B: 0 };
  let activeTimer: ActiveTimer | null = null;
  let lastRest: ReplayResult['lastRest'] = null;
  let ballsDelayed = false;
  let start: number | null = null;
  let end: number | null = null;

  const balls = config.balls;

  /** Balles neuves après ce jeu ? Reportées au 2e jeu du set suivant si un jeu décisif commence. */
  const checkBalls = (before: ScoreState, after: ScoreState, o: Outcome) => {
    if (after.winner) return;
    if (balls.mode === 'final_set') {
      if (o.setWinner && after.completedSets.length === config.format.setsToWin * 2 - 2) o.newBalls = true;
      return;
    }
    if (balls.mode !== 'regulation') return;
    if (ballsDelayed && o.gameWinner && after.games.A + after.games.B === 1) {
      ballsDelayed = false;
      o.newBalls = true;
      return;
    }
    for (let g = before.gamesPlayed + 1; g <= after.gamesPlayed; g++) {
      const counted = g + balls.warmupGames;
      const due = counted === balls.first || (counted > balls.first && (counted - balls.first) % balls.every === 0);
      if (!due) continue;
      if (after.inTiebreak) ballsDelayed = true;
      else o.newBalls = true;
    }
  };

  for (const { event: e, replaced } of list) {
    const before = s;
    let sanction: Sanction | undefined;
    let serveCall: Outcome['serveCall'];
    let rallyLet = false;

    if (e.kind === 'start') {
      start ??= e.ts;
      continue;
    }
    if (e.kind === 'note') continue;
    if (e.kind === 'timer') {
      if (e.action === 'start') {
        if (e.timer === 'toilet' && e.player) toiletBreaks[e.player]++;
        activeTimer = { timer: e.timer, start: e.ts, ...(e.player ? { player: e.player } : {}) };
      } else if (activeTimer?.timer === e.timer) {
        activeTimer = null;
      }
      continue;
    }
    if (s.winner) continue;

    switch (e.kind) {
      case 'serve':
        if (e.call === 'fault' || e.call === 'net_fault') {
          serveCall = s.serveNumber === 2 ? 'double_fault' : e.call;
          s = serveFault(s, config);
        } else if (e.call === 'ace') {
          serveCall = 'ace';
          s = applyPoint(s, config, s.server);
        } else {
          serveCall = 'net';
        }
        break;
      case 'point':
        s = applyPoint(s, config, e.winner);
        break;
      case 'let':
        rallyLet = true;
        s = replayPoint(s);
        break;
      case 'conduct': {
        const level = conductLevel(++conductCount[e.player]);
        const points = CONDUCT_POINTS[level];
        sanction = { scale: 'conduct', player: e.player, level, offence: e.offence, points };
        s = awardPoints(s, config, other(e.player), points);
        break;
      }
      case 'time_violation': {
        const level = timeLevel(++timeViolationCount[e.player]);
        const points = level === 'point' ? 1 : 0;
        sanction = { scale: 'time', player: e.player, level, points };
        s = awardPoints(s, config, other(e.player), points);
        break;
      }
      case 'set_server':
        s = setServer(s, e.server);
        break;
      case 'adjust':
        s = adjustScore(s, config, e);
        break;
      case 'end':
        s = endMatch(s, e.loser, e.type);
        break;
    }

    start ??= e.ts;
    const outcome = describe(before, s);
    if (serveCall) outcome.serveCall = serveCall;
    if (rallyLet) outcome.rallyLet = true;
    if (sanction) outcome.sanction = sanction;
    if (s.points.A + s.points.B !== before.points.A + before.points.B || outcome.gameWinner) {
      // Vainqueur du dernier point attribué.
      if (e.kind === 'point') outcome.pointWinner = e.winner;
      else if (serveCall === 'ace') outcome.pointWinner = before.server;
      else if (serveCall === 'double_fault') outcome.pointWinner = other(before.server);
      else if (sanction && sanction.points > 0) outcome.pointWinner = other(sanction.player);
    }
    if (e.kind !== 'adjust') checkBalls(before, s, outcome);
    if (outcome.rest !== 'none') lastRest = { rest: outcome.rest, start: e.ts };
    else if (outcome.pointWinner || serveCall) lastRest = null;
    if (s.winner && !before.winner) end = e.ts;
    log.push({ event: e, replaced, before, after: s, outcome });
  }

  return {
    state: s,
    log,
    corrections,
    conductCount,
    timeViolationCount,
    toiletBreaks,
    activeTimer,
    lastRest,
    ballsDelayed,
    start,
    end,
  };
}
