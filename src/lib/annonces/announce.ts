// Texte à prononcer par l'arbitre après chaque événement du match.

import { other, setScoreFor, isDecidingPoint, type LogEntry, type MatchConfig, type Player, type ScoreState, type Side } from '../engine';
import { fr, type Phrases } from './phrases';

export interface AnnounceContext {
  config: MatchConfig;
  players: Record<Side, Player>;
  /** Double : partenaire de chaque joueur de `players`. Absent en simple. */
  partners?: Record<Side, Player>;
  /** Match par équipes : le score s'annonce avec le nom du club. */
  team?: boolean;
  phrases?: Phrases;
}

/** Joueurs d'un côté : un en simple, deux en double. */
export function members(players: Record<Side, Player>, partners: Record<Side, Player> | undefined, s: Side): Player[] {
  return partners ? [players[s], partners[s]] : [players[s]];
}

/** Nom d'un côté dans les annonces du score : « Dupont », ou « Dupont / Mme Martin » en double. */
export function sideCallName(players: Player[], team = false): string {
  const club = players[0].club?.trim();
  if (team && club) return club;
  return players.map((p) => callName(p)).join(' / ');
}

/** Forme du nom à l'écran : « Paul Dupont », « P. Dupont », « Dupont » ou « Paul ». */
export type NameFormat = 'first_last' | 'initial_last' | 'last' | 'first';

export interface NameStyle {
  format: NameFormat;
  /** « M. », « Mme » ou « Mlle » devant le nom. */
  civility: boolean;
}

export const FULL_NAME: NameStyle = { format: 'first_last', civility: true };

/** Nom affiché à l'écran et dans la présentation, selon les réglages. */
export function playerName(p: Player, style: NameStyle | 'short' = FULL_NAME): string {
  const st: NameStyle = style === 'short' ? { format: 'last', civility: true } : style;
  const first = p.firstName.trim();
  const last = p.lastName.trim();
  const body =
    st.format === 'first'
      ? first || last
      : st.format === 'last'
        ? last
        : st.format === 'initial_last'
          ? [first ? `${first[0].toUpperCase()}.` : '', last].filter(Boolean).join(' ')
          : [first, last].filter(Boolean).join(' ');
  return st.civility ? `${p.civility} ${body}` : body;
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
  const name = (side: Side) => sideCallName(members(ctx.players, ctx.partners, side), ctx.team);
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
  const name = (side: Side) => sideCallName(members(ctx.players, ctx.partners, side), ctx.team);
  /** Joueur au service (le bon partenaire en double). */
  const server = (side: Side, idx: 0 | 1) => callName(members(ctx.players, ctx.partners, side)[idx] ?? ctx.players[side], ctx.team);
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
    const losers = members(ctx.players, ctx.partners, e.loser);
    lines.push(
      t.matchEnd(
        losers.map((p) => playerName(p, 'short')).join(' et '),
        losers.every(isFeminine),
        name(w),
        e.type,
        scores,
        losers.length > 1,
      ),
    );
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
    if (A + B === 1) lines.push(t.serving(server(after.server, entry.serverIndexAfter)));
    // Points de pénalité reportés sur le jeu suivant.
    if (after.points.A + after.points.B > 0) lines.push(scoreCall(after, ctx));
  } else if (scoreChanged) {
    lines.push(scoreCall(after, ctx));
  }

  if (o.newBalls) lines.push(t.newBalls);
  return lines.filter(Boolean);
}
