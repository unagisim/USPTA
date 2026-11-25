// Texte à prononcer par l'arbitre après chaque événement du match.

import { other, setScoreFor, isDecidingPoint, type LogEntry, type MatchConfig, type Player, type ScoreState, type Side } from '../engine';
import { fr, type Phrases } from './phrases';

export interface AnnounceContext {
  config: MatchConfig;
  players: Record<Side, Player>;
  /** Match par équipes : le score s'annonce avec le nom du club. */
  team?: boolean;
  phrases?: Phrases;
}

/** Nom affiché à l'écran : civilité, prénom et nom, ou civilité et nom. */
export function playerName(p: Player, style: 'full' | 'short' = 'full'): string {
  return style === 'short' ? `${p.civility} ${p.lastName}` : `${p.civility} ${p.firstName} ${p.lastName}`;
}

export const isFeminine = (p: Player) => p.civility !== 'M.';

/**
 * Nom dans les annonces du score, selon l'usage FFT : « Mme Kerber », « Mlle Osaka »,
 * mais « Tsonga » sans « M. ». En match par équipes, le nom du club.
 */
export function callName(p: Player, team = false): string {
  if (team && p.club?.trim()) return p.club.trim();
  return isFeminine(p) ? `${p.civility} ${p.lastName}` : p.lastName;
}

const LABELS = ['0', '15', '30', '40'];

/** Score du jeu en cours, à annoncer avant le prochain point. */
export function scoreCall(s: ScoreState, ctx: AnnounceContext): string {
  const t = ctx.phrases ?? fr;
  const name = (side: Side) => callName(ctx.players[side], ctx.team);
  const { A, B } = s.points;
  // Début de jeu : rien à annoncer.
  if (A === 0 && B === 0) return '';
  if (s.inTiebreak) {
    if (A === B) return t.tiebreakAll(A);
    const lead: Side = A > B ? 'A' : 'B';
    return t.tiebreakLead(Math.max(A, B), Math.min(A, B), name(lead));
  }
  const srv = s.server;
  const ps = s.points[srv];
  const pr = s.points[other(srv)];
  if (ps >= 3 && pr >= 3) {
    // « 40 A » à la première égalité du jeu, « Égalité » ensuite.
    if (ps === pr) return isDecidingPoint(s, ctx.config) ? t.decidingPoint : ps === 3 ? t.fortyAll : t.deuce;
    return t.advantage(name(ps > pr ? srv : other(srv)));
  }
  if (ps === pr) return t.pointsAll(LABELS[ps]);
  return t.pointScore(LABELS[ps], LABELS[pr]);
}

/** Lignes d'annonce pour une entrée du journal du match. */
export function announce(entry: LogEntry, ctx: AnnounceContext): string[] {
  const t = ctx.phrases ?? fr;
  const name = (side: Side) => callName(ctx.players[side], ctx.team);
  const { event: e, before, after, outcome: o } = entry;
  const lines: string[] = [];

  // Annonce au service ou pendant l'échange.
  if (e.kind === 'serve') {
    if (e.call === 'fault') lines.push(t.fault);
    else if (e.call === 'net_fault') lines.push(t.netFault);
    else if (e.call === 'net') lines.push(before.serveNumber === 1 ? t.netFirst : t.netSecond);
  }
  if (o.rallyLet) lines.push(t.rallyLet);

  // Sanctions.
  if (o.sanction) {
    const sc = o.sanction;
    if (sc.scale === 'conduct') {
      lines.push(t.conduct(sc.offence, sc.level, name(sc.player)));
      if (sc.level === 'disqualification') lines.push(t.callReferee);
    } else {
      lines.push(t.timeViolation(sc.level, name(sc.player)));
    }
  }

  // Fin de match anticipée.
  if (e.kind === 'end' && after.winner && !before.winner) {
    const w = after.winner;
    const scores = before.completedSets.map((set) => setScoreFor(set, w).replace('-', '/'));
    const g = before.games;
    if (before.isSuperTiebreakSet) {
      if (before.points.A + before.points.B > 0) scores.push(`${before.points[w]}/${before.points[other(w)]}`);
    } else if (g.A + g.B > 0) scores.push(`${g[w]}/${g[other(w)]}`);
    lines.push(t.matchEnd(playerName(ctx.players[e.loser], 'short'), isFeminine(ctx.players[e.loser]), name(w), e.type, scores));
    return lines;
  }

  // Score.
  const scoreChanged = o.pointWinner !== undefined || o.gameWinner !== undefined;
  const maxSets = ctx.config.format.setsToWin * 2 - 1;
  const setName = (n: number) => t.setName(n, n === maxSets);
  if (o.matchWinner) {
    const w = o.matchWinner;
    const scores = after.completedSets.map((set) => setScoreFor(set, w).replace('-', '/'));
    lines.push(t.matchWon(name(w), after.setsWon[w], after.setsWon[other(w)], scores));
  } else if (o.setWinner) {
    const w = o.setWinner;
    const n = after.completedSets.length;
    const set = after.completedSets[n - 1];
    const setsAll = after.setsWon.A === after.setsWon.B;
    lines.push(t.setWon(t.setName(n, false), name(w), set.games[w], set.games[other(w)], setsAll, !!o.superTiebreakStarts));
  } else if (o.gameWinner) {
    const w = o.gameWinner;
    const { A, B } = after.games;
    const n = after.completedSets.length + 1;
    let score: string;
    if (A + B === 1) score = t.firstGame(n === 1 ? '' : setName(n));
    else if (A === B) score = o.tiebreakStarts ? t.gamesAllTiebreak(A, setName(n)) : t.gamesAll(A);
    else {
      const lead: Side = A > B ? 'A' : 'B';
      score = t.gamesLead(name(lead), Math.max(A, B), Math.min(A, B));
    }
    lines.push(t.game(name(w), score));
    // Après le premier jeu d'une manche, les joueurs changent de côté puis l'arbitre annonce le serveur.
    if (A + B === 1) lines.push(t.serving(name(after.server)));
    // Points de pénalité reportés sur le jeu suivant.
    if (after.points.A + after.points.B > 0) lines.push(scoreCall(after, ctx));
  } else if (scoreChanged) {
    lines.push(scoreCall(after, ctx));
  }

  if (o.newBalls) lines.push(t.newBalls);
  return lines.filter(Boolean);
}
