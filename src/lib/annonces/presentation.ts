// Annonces d'avant-match : présentation à la fin de l'échauffement et lancement du match.

import { other, type BallChange, type MatchFormat, type Player, type Side } from '../engine';
import { callName, playerName } from './announce';

export type TossChoice = 'serve' | 'receive' | 'side' | 'defer';

export interface PresentationData {
  /** Compétition ou épreuve : « championnat par équipes National 3 ». */
  competition: string;
  /** Tour, poule ou journée : « 2e journée ». */
  round: string;
  players: Record<Side, Player>;
  /** Joueur à gauche de la chaise au premier jeu. */
  left: Side;
  format: MatchFormat;
  toss: { winner: Side; choice: TossChoice } | null;
  nameStyle?: 'full' | 'short';
  /** Match par équipes : chaque joueur est présenté avec son club. */
  team?: boolean;
}

const TOSS_FR: Record<TossChoice, string> = {
  serve: 'a choisi de servir',
  receive: 'a choisi de recevoir',
  side: 'a choisi son côté',
  defer: 'a laissé le choix à son adversaire',
};

/** Règle de jeu en une phrase : « Partie au meilleur des 3 manches avec jeu décisif dans toutes les manches. » */
export function formatRule(f: MatchFormat): string {
  const games = f.gamesPerSet === 6 ? '' : ` de ${f.gamesPerSet} jeux`;
  const tb = `jeu décisif à ${f.tiebreakAt} jeux partout`;
  const parts = f.finalSetSuperTiebreak
    ? [`Partie au meilleur des 3 manches${games}, avec ${tb} dans les deux premières manches`, `la troisième manche se joue en super jeu décisif à ${f.superTiebreakPoints} points`]
    : [`Partie au meilleur des 3 manches${games}, avec ${tb} dans toutes les manches`];
  if (f.decidingPoint) parts.push('point décisif à égalité');
  return `${parts.join(', ')}.`;
}

/** Balles, pour la réunion d'avant-match. */
export function ballsRule(b: BallChange): string {
  if (b.mode === 'regulation') return `Changement de balles après ${b.first} jeux (échauffement compris), puis tous les ${b.every} jeux`;
  if (b.mode === 'final_set') return 'Balles neuves pour la troisième manche';
  return 'Pas de changement de balles';
}

/** Présentation du match, à faire à 40 secondes de la fin de l'échauffement. */
export function presentation(d: PresentationData): string[] {
  const name = (s: Side) => playerName(d.players[s], d.nameStyle);
  const intro = [d.round.trim(), d.competition.trim()].filter(Boolean).join(', ');
  const right = other(d.left);
  const named = (s: Side) => {
    const club = d.players[s].club?.trim();
    return d.team && club ? `${name(s)}, ${club}` : name(s);
  };
  const lines = [
    `${intro || 'Match'}, opposant à droite de la chaise ${named(right)}, à gauche de la chaise ${named(d.left)}.`,
    formatRule(d.format),
    d.toss ? `${name(d.toss.winner)} a gagné le tirage au sort et ${TOSS_FR[d.toss.choice]}.` : '[Tirage au sort à saisir]',
    "Fin de l'échauffement, préparez-vous à jouer.",
  ];
  return lines;
}

/** Annonce juste avant le premier service. */
export function playCall(server: Player, team = false): string {
  return `Première manche, au service ${callName(server, team)}, prêts, jouez !`;
}

export const TWO_MINUTES = '2 minutes';
