// Texte à prononcer par l'arbitre après chaque événement du match.

import { other, setScoreFor, isDecidingPoint, type LogEntry, type MatchConfig, type Player, type ScoreState, type Side } from '../engine';
import { fr, type Phrases } from './phrases';

export interface AnnounceContext {
  config: MatchConfig;
  players: Record<Side, Player>;
  /** Forme des noms : civilité, prénom et nom (par défaut), ou civilité et nom. */
  nameStyle?: 'full' | 'short';
  phrases?: Phrases;
}

export function playerName(p: Player, style: 'full' | 'short' = 'full'): string {
  return style === 'short' ? `${p.civility} ${p.lastName}` : `${p.civility} ${p.firstName} ${p.lastName}`;
}

const LABELS = ['0', '15', '30', '40'];

/** Score du jeu en cours, à annoncer avant le prochain point. */
export function scoreCall(s: ScoreState, ctx: AnnounceContext): string {
  const t = ctx.phrases ?? fr;
  const name = (side: Side) => playerName(ctx.players[side], ctx.nameStyle);
  const { A, B } = s.points;
  if (s.inTiebreak) {
    if (A === B) return t.tiebreakAll(A);
    const lead: Side = A > B ? 'A' : 'B';
    return t.tiebreakLead(Math.max(A, B), Math.min(A, B), name(lead));
  }
  const srv = s.server;
  const ps = s.points[srv];
  const pr = s.points[other(srv)];
  if (ps >= 3 && pr >= 3) {
    if (ps === pr) return isDecidingPoint(s, ctx.config) ? t.decidingPoint : t.deuce;
    return t.advantage(name(ps > pr ? srv : other(srv)));
  }
  if (ps === pr) return t.pointsAll(LABELS[ps]);
  return t.pointScore(LABELS[ps], LABELS[pr]);
}

/** Lignes d'annonce pour une entrée du journal du match. */
export function announce(entry: LogEntry, ctx: AnnounceContext): string[] {
  const t = ctx.phrases ?? fr;
  const name = (side: Side) => playerName(ctx.players[side], ctx.nameStyle);
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
    lines.push(t.matchEnd(name(after.winner), e.type));
    return lines;
  }

  // Score.
  const scoreChanged = o.pointWinner !== undefined || o.gameWinner !== undefined;
  if (o.matchWinner) {
    const w = o.matchWinner;
    lines.push(t.matchWon(name(w), after.completedSets.map((set) => setScoreFor(set, w))));
  } else if (o.setWinner) {
    const w = o.setWinner;
    const set = after.completedSets[after.completedSets.length - 1];
    lines.push(t.setWon(t.ordinal(after.completedSets.length), name(w), set.games[w], set.games[other(w)]));
    if (o.superTiebreakStarts) lines.push(t.setsAllSuperTiebreak);
  } else if (o.gameWinner) {
    const w = o.gameWinner;
    lines.push(t.game(name(w)));
    const { A, B } = after.games;
    const ord = t.ordinal(after.completedSets.length + 1);
    if (A === B) lines.push(o.tiebreakStarts ? t.gamesAllTiebreak(A) : t.gamesAll(A, ord));
    else {
      const lead: Side = A > B ? 'A' : 'B';
      lines.push(t.gamesLead(name(lead), Math.max(A, B), Math.min(A, B), ord));
    }
    // Points de pénalité reportés sur le jeu suivant.
    if (after.points.A + after.points.B > 0) lines.push(scoreCall(after, ctx));
  } else if (scoreChanged) {
    lines.push(scoreCall(after, ctx));
  }

  if (o.newBalls) lines.push(t.newBalls);
  return lines;
}
