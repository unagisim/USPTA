// Règles du score : fonctions pures, l'état d'origine n'est jamais modifié.

import { other, type MatchConfig, type Pair, type Side } from './types';

export interface SetScore {
  games: Pair;
  /** Points du jeu décisif ou du super jeu décisif, s'il a été joué. */
  tiebreak?: Pair;
  superTiebreak?: boolean;
}

export type EndReason = 'completed' | 'retirement' | 'disqualification' | 'walkover';

export interface ScoreState {
  completedSets: SetScore[];
  setsWon: Pair;
  /** Jeux du set en cours. */
  games: Pair;
  /** Points du jeu (ou du jeu décisif) en cours. */
  points: Pair;
  inTiebreak: boolean;
  isSuperTiebreakSet: boolean;
  tiebreakTarget: number;
  /** Serveur au début du jeu, ou premier serveur du jeu décisif. */
  gameServer: Side;
  /** Serveur du prochain point. */
  server: Side;
  /** 1re ou 2e balle de service. */
  serveNumber: 1 | 2;
  winner: Side | null;
  endReason: EndReason | null;
  /** Nombre de changements de côté depuis le début du match. */
  endChanges: number;
  /** Jeux joués dans le match ; un jeu décisif compte pour un jeu. */
  gamesPlayed: number;
}

const zero = (): Pair => ({ A: 0, B: 0 });

export function initialState(config: MatchConfig): ScoreState {
  return {
    completedSets: [],
    setsWon: zero(),
    games: zero(),
    points: zero(),
    inTiebreak: false,
    isSuperTiebreakSet: false,
    tiebreakTarget: config.format.tiebreakPoints,
    gameServer: config.firstServer,
    server: config.firstServer,
    serveNumber: 1,
    winner: null,
    endReason: null,
    endChanges: 0,
    gamesPlayed: 0,
  };
}

function clone(s: ScoreState): ScoreState {
  return {
    ...s,
    completedSets: s.completedSets.map((set) => ({
      ...set,
      games: { ...set.games },
      ...(set.tiebreak ? { tiebreak: { ...set.tiebreak } } : {}),
    })),
    setsWon: { ...s.setsWon },
    games: { ...s.games },
    points: { ...s.points },
  };
}

/** Serveur d'un point de jeu décisif : `starter` sert le 1er point, puis 2 points chacun. */
export function tiebreakServer(starter: Side, pointsPlayed: number): Side {
  return Math.floor((pointsPlayed + 1) / 2) % 2 === 0 ? starter : other(starter);
}

function startDecidingSetIfNeeded(n: ScoreState, config: MatchConfig): void {
  const fmt = config.format;
  const decider = fmt.setsToWin - 1;
  if (fmt.finalSetSuperTiebreak && n.setsWon.A === decider && n.setsWon.B === decider) {
    n.inTiebreak = true;
    n.isSuperTiebreakSet = true;
    n.tiebreakTarget = fmt.superTiebreakPoints;
  }
}

function finishSet(n: ScoreState, config: MatchConfig, w: Side, tiebreak?: Pair): void {
  const fmt = config.format;
  const games = n.isSuperTiebreakSet ? { A: w === 'A' ? 1 : 0, B: w === 'B' ? 1 : 0 } : { ...n.games };
  const set: SetScore = { games };
  if (tiebreak) set.tiebreak = tiebreak;
  if (n.isSuperTiebreakSet) set.superTiebreak = true;
  n.completedSets.push(set);
  n.setsWon[w]++;

  n.games = zero();
  n.points = zero();
  n.inTiebreak = false;
  n.isSuperTiebreakSet = false;
  n.tiebreakTarget = fmt.tiebreakPoints;

  if (n.setsWon[w] >= fmt.setsToWin) {
    n.winner = w;
    n.endReason = 'completed';
    return;
  }
  // Changement de côté en fin de set si le nombre de jeux du set est impair ;
  // sinon il aura lieu après le 1er jeu du set suivant.
  if ((games.A + games.B) % 2 === 1) n.endChanges++;
  // Le service continue d'alterner : après un jeu décisif, celui qui l'a commencé reçoit.
  n.gameServer = other(n.gameServer);
  n.server = n.gameServer;
  startDecidingSetIfNeeded(n, config);
}

function finishGame(n: ScoreState, config: MatchConfig, w: Side): void {
  const fmt = config.format;
  n.games[w]++;
  n.gamesPlayed++;
  n.points = zero();
  const g = n.games[w];
  const og = n.games[other(w)];
  if (g >= fmt.gamesPerSet && g - og >= 2) {
    finishSet(n, config, w);
    return;
  }
  if ((n.games.A + n.games.B) % 2 === 1) n.endChanges++;
  n.gameServer = other(n.gameServer);
  n.server = n.gameServer;
  if (n.games.A === fmt.tiebreakAt && n.games.B === fmt.tiebreakAt) {
    n.inTiebreak = true;
    n.tiebreakTarget = fmt.tiebreakPoints;
  }
}

function finishTiebreak(n: ScoreState, config: MatchConfig, w: Side): void {
  const tb = { ...n.points };
  if (!n.isSuperTiebreakSet) n.games[w]++;
  n.gamesPlayed++;
  finishSet(n, config, w, tb);
}

/** Point gagné par `w`. Le point suivant se joue sur 1re balle. */
export function applyPoint(s: ScoreState, config: MatchConfig, w: Side): ScoreState {
  if (s.winner) return s;
  const n = clone(s);
  n.serveNumber = 1;
  n.points[w]++;
  const p = n.points[w];
  const o = n.points[other(w)];

  if (n.inTiebreak) {
    if (p >= n.tiebreakTarget && p - o >= 2) {
      finishTiebreak(n, config, w);
    } else {
      const played = p + o;
      if (played % 6 === 0) n.endChanges++;
      n.server = tiebreakServer(n.gameServer, played);
    }
    return n;
  }

  const won = p >= 4 && (p - o >= 2 || (config.format.decidingPoint && p - o >= 1));
  if (won) finishGame(n, config, w);
  return n;
}

/** Plusieurs points attribués à `w` (pénalités). Ils se reportent sur le jeu suivant si besoin. */
export function awardPoints(s: ScoreState, config: MatchConfig, w: Side, count: number): ScoreState {
  let n = s;
  for (let i = 0; i < count && !n.winner; i++) n = applyPoint(n, config, w);
  return n;
}

/** Faute au service : 2e balle, ou double faute (point au relanceur). */
export function serveFault(s: ScoreState, config: MatchConfig): ScoreState {
  if (s.winner) return s;
  if (s.serveNumber === 1) return { ...clone(s), serveNumber: 2 };
  return applyPoint(s, config, other(s.server));
}

/** Point à rejouer (let pendant l'échange) : retour à la 1re balle. */
export function replayPoint(s: ScoreState): ScoreState {
  if (s.winner || s.serveNumber === 1) return s;
  return { ...clone(s), serveNumber: 1 };
}

/** Erreur de serveur découverte : le bon joueur sert la suite, les points restent acquis. */
export function setServer(s: ScoreState, server: Side): ScoreState {
  if (s.winner || s.server === server) return s;
  const n = clone(s);
  n.server = server;
  if (n.inTiebreak) {
    const played = n.points.A + n.points.B;
    if (tiebreakServer(n.gameServer, played) !== server) n.gameServer = other(n.gameServer);
  } else {
    n.gameServer = server;
  }
  return n;
}

export interface ScoreAdjustment {
  sets: Pair[];
  games: Pair;
  points: Pair;
  server: Side;
}

/** Score fixé à la main. Les changements de côté déjà comptés sont conservés. */
export function adjustScore(s: ScoreState, config: MatchConfig, adj: ScoreAdjustment): ScoreState {
  const fmt = config.format;
  const n = clone(s);
  const decidingIndex = fmt.setsToWin * 2 - 2;
  n.completedSets = adj.sets.map((g, i) =>
    fmt.finalSetSuperTiebreak && i === decidingIndex && g.A + g.B === 1
      ? { games: { ...g }, superTiebreak: true }
      : { games: { ...g } },
  );
  n.setsWon = zero();
  for (const set of n.completedSets) n.setsWon[set.games.A > set.games.B ? 'A' : 'B']++;
  n.games = { ...adj.games };
  n.points = { ...adj.points };
  n.serveNumber = 1;
  n.inTiebreak = false;
  n.isSuperTiebreakSet = false;
  n.tiebreakTarget = fmt.tiebreakPoints;
  n.winner = null;
  n.endReason = null;
  n.gamesPlayed = n.completedSets.reduce((t, set) => t + set.games.A + set.games.B, 0) + n.games.A + n.games.B;

  const leader = n.setsWon.A >= fmt.setsToWin ? 'A' : n.setsWon.B >= fmt.setsToWin ? 'B' : null;
  if (leader) {
    n.winner = leader;
    n.endReason = 'completed';
    n.games = zero();
    n.points = zero();
    return n;
  }
  startDecidingSetIfNeeded(n, config);
  if (n.isSuperTiebreakSet) n.games = zero();
  else if (n.games.A === fmt.tiebreakAt && n.games.B === fmt.tiebreakAt) n.inTiebreak = true;

  n.server = adj.server;
  n.gameServer = adj.server;
  if (n.inTiebreak) {
    const played = n.points.A + n.points.B;
    if (tiebreakServer(n.gameServer, played) !== adj.server) n.gameServer = other(n.gameServer);
  }
  return n;
}

export function endMatch(s: ScoreState, loser: Side, reason: EndReason): ScoreState {
  if (s.winner) return s;
  const n = clone(s);
  n.winner = other(loser);
  n.endReason = reason;
  return n;
}

// ---- Lecture de l'état ----

/** Joueur actuellement à gauche de la chaise. */
export function leftPlayer(s: ScoreState, config: MatchConfig): Side {
  return s.endChanges % 2 === 0 ? config.leftAtStart : other(config.leftAtStart);
}

export const isDecidingPoint = (s: ScoreState, config: MatchConfig): boolean =>
  config.format.decidingPoint && !s.inTiebreak && s.points.A === 3 && s.points.B === 3;

/** Côté du service pour le prochain point : à droite, à gauche, ou au choix du relanceur. */
export function serveCourt(s: ScoreState, config: MatchConfig): 'right' | 'left' | 'receiver_choice' {
  if (isDecidingPoint(s, config)) return 'receiver_choice';
  return (s.points.A + s.points.B) % 2 === 0 ? 'right' : 'left';
}

export interface PointSituation {
  breakPoint: boolean;
  setPoint: Side | null;
  matchPoint: Side | null;
  decidingPoint: boolean;
}

/** Enjeux du prochain point, pour les rappels à l'arbitre. */
export function pointSituation(s: ScoreState, config: MatchConfig): PointSituation {
  const result: PointSituation = { breakPoint: false, setPoint: null, matchPoint: null, decidingPoint: false };
  if (s.winner) return result;
  for (const side of ['A', 'B'] as const) {
    const after = applyPoint(s, config, side);
    if (after.winner === side) result.matchPoint = side;
    else if (after.setsWon[side] > s.setsWon[side]) result.setPoint = side;
    const gameWon = after.setsWon[side] > s.setsWon[side] || after.games[side] > s.games[side];
    if (!s.inTiebreak && side !== s.server && gameWon) result.breakPoint = true;
  }
  result.decidingPoint = isDecidingPoint(s, config);
  return result;
}

const LABELS = ['0', '15', '30', '40'];

/** Score du jeu en cours : 0, 15, 30, 40, AV, ou chiffres en jeu décisif. */
export function formatPoints(s: ScoreState): { A: string; B: string } {
  const { A, B } = s.points;
  if (s.inTiebreak) return { A: String(A), B: String(B) };
  if (A >= 3 && B >= 3) {
    if (A === B) return { A: '40', B: '40' };
    return A > B ? { A: 'AV', B: '40' } : { A: '40', B: 'AV' };
  }
  return { A: LABELS[A], B: LABELS[B] };
}

/** Score d'un set vu par `side` : "6-4", "7-6", "10-7" pour un super jeu décisif. */
export function setScoreFor(set: SetScore, side: Side): string {
  const o = other(side);
  if (set.superTiebreak && set.tiebreak) return `${set.tiebreak[side]}-${set.tiebreak[o]}`;
  return `${set.games[side]}-${set.games[o]}`;
}
