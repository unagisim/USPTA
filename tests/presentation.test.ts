import { describe, expect, it } from 'vitest';
import { ballsRule, formatRule, playCall, presentation } from '../src/lib/annonces';
import { FORMATS } from '../src/lib/engine';

const players = {
  A: { civility: 'M.' as const, firstName: 'Paul', lastName: 'Dupont' },
  B: { civility: 'Mme' as const, firstName: 'Julie', lastName: 'Martin' },
};

describe("annonces d'avant-match", () => {
  it('présentation complète', () => {
    expect(
      presentation({
        competition: 'championnat par équipes National 3',
        round: '2e journée',
        players,
        left: 'B',
        format: FORMATS.F1,
        toss: { winner: 'A', choice: 'serve' },
      }),
    ).toEqual([
      '2e journée, championnat par équipes National 3, opposant à droite de la chaise M. Paul Dupont, à gauche de la chaise Mme Julie Martin.',
      'Partie au meilleur des 3 manches, avec jeu décisif à 6 jeux partout dans toutes les manches.',
      'M. Paul Dupont a gagné le tirage au sort et a choisi de servir.',
      "Fin de l'échauffement, préparez-vous à jouer.",
    ]);
  });

  it('sans compétition ni tirage saisis', () => {
    const lines = presentation({ competition: '', round: '', players, left: 'A', format: FORMATS.F2, toss: null });
    expect(lines[0]).toBe('Match, opposant à droite de la chaise Mme Julie Martin, à gauche de la chaise M. Paul Dupont.');
    expect(lines[2]).toBe('[Tirage au sort à saisir]');
  });

  it('match par équipes : clubs dans la présentation', () => {
    const withClubs = {
      A: { ...players.A, club: 'TC Blagnac' },
      B: { ...players.B, club: 'ASPTT Toulouse' },
    };
    const lines = presentation({ competition: 'championnat National 3', round: '2e journée', players: withClubs, left: 'A', format: FORMATS.F1, toss: null, team: true });
    expect(lines[0]).toBe(
      '2e journée, championnat National 3, opposant à droite de la chaise Mme Julie Martin, ASPTT Toulouse, à gauche de la chaise M. Paul Dupont, TC Blagnac.',
    );
  });

  it('tirage gagné, choix pas encore fait', () => {
    const lines = presentation({ competition: '', round: '', players, left: 'A', format: FORMATS.F1, toss: { winner: 'B', choice: null } });
    expect(lines[2]).toBe('Mme Julie Martin a gagné le tirage au sort et [choix à saisir].');
  });

  it('règles des formats courts', () => {
    expect(formatRule(FORMATS.F6)).toBe(
      'Partie au meilleur des 3 manches de 4 jeux, avec jeu décisif à 3 jeux partout dans les deux premières manches, la troisième manche se joue en super jeu décisif à 10 points, point décisif à égalité.',
    );
  });

  it('balles et lancement du match', () => {
    expect(ballsRule({ mode: 'regulation', first: 7, every: 9, warmupGames: 2 })).toBe(
      'Changement de balles après 7 jeux (échauffement compris), puis tous les 9 jeux',
    );
    expect(playCall(players.B)).toBe('Première manche, au service Mme Martin, prêts, jouez !');
  });
});
