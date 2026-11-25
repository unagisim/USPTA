import { describe, expect, it } from 'vitest';
import { announce, type AnnounceContext } from '../src/lib/annonces';
import { Rec } from './helpers';

const ctx = (r: Rec): AnnounceContext => ({
  config: r.config,
  players: {
    A: { civility: 'M.', firstName: 'Paul', lastName: 'Dupont' },
    B: { civility: 'Mme', firstName: 'Julie', lastName: 'Martin' },
  },
});
const say = (r: Rec) => announce(r.last, ctx(r));

describe('annonces du score', () => {
  it('score dans le jeu, serveur en premier ; 40 A puis égalité', () => {
    const r = new Rec('F1').point('A');
    expect(say(r)).toEqual(['15-0']);
    r.point('B');
    expect(say(r)).toEqual(['15 partout']);
    r.point('B');
    expect(say(r)).toEqual(['15-30']);
    r.point('A').point('A').point('B');
    expect(say(r)).toEqual(['40 A']);
    r.point('B');
    expect(say(r)).toEqual(['Avantage Mme Martin']);
    r.point('A');
    expect(say(r)).toEqual(['Égalité']);
    r.point('A');
    expect(say(r)).toEqual(['Avantage Dupont']);
  });

  it('point décisif', () => {
    const r = new Rec('F4').point('A', 3).point('B', 3);
    expect(say(r)).toEqual(['40 A, point décisif, choix au relanceur']);
  });

  it('fin de jeu, puis serveur annoncé après le premier jeu', () => {
    const r = new Rec('F1').games('A');
    expect(say(r)).toEqual(['Jeu Dupont, premier jeu.', 'Au service Mme Martin']);
    r.games('B');
    expect(say(r)).toEqual(['Jeu Mme Martin, 1 partout.']);
    r.games('B');
    expect(say(r)).toEqual(['Jeu Mme Martin, Mme Martin mène 2 jeux à 1.']);
  });

  it('premier jeu des manches suivantes', () => {
    const r = new Rec('F1').games('A', 6).games('B');
    expect(say(r)[0]).toBe('Jeu Mme Martin, premier jeu, deuxième manche.');
    r.games('B', 5); // 6-0 0-6
    expect(r.s.completedSets.length).toBe(2);
    r.games('A');
    expect(say(r)[0]).toBe('Jeu Dupont, premier jeu, dernière manche.');
  });

  it('entrée dans le jeu décisif et score du jeu décisif', () => {
    const r = new Rec('F1').alternate(12);
    expect(say(r)).toEqual(['Jeu Mme Martin, 6 jeux partout première manche, jeu décisif.']);
    r.point('B');
    expect(say(r)).toEqual(['1-0 Mme Martin']);
    r.point('A');
    expect(say(r)).toEqual(['1-1']);
    r.point('A');
    expect(say(r)).toEqual(['2-1 Dupont']);
  });

  it('fin de manche, super jeu décisif et fin de match', () => {
    const r = new Rec('F2').alternate(8).games('A', 2);
    expect(say(r)).toEqual(['Jeu et première manche Dupont, 6 jeux à 4.']);
    r.alternate(6, 'A').games('B', 3); // 3-6
    expect(say(r)).toEqual(['Jeu et deuxième manche Mme Martin, 6 jeux à 3, une manche partout, super jeu décisif.']);
    r.point('A', 7).point('B', 7).point('A', 3); // 10-7
    expect(say(r)).toEqual(['Jeu, set et match Dupont 2 manches à 1, 6/4-3/6-10/7']);
  });

  it('victoire en deux manches', () => {
    const r = new Rec('F1').games('A', 6).games('A', 6);
    expect(say(r)).toEqual(['Jeu, set et match Dupont 2 manches à 0, 6/0-6/0']);
  });

  it('match par équipes : nom du club', () => {
    const r = new Rec('F1').point('B', 3).point('A', 3).point('B');
    const team: AnnounceContext = {
      ...ctx(r),
      team: true,
      players: {
        A: { civility: 'M.', firstName: 'Paul', lastName: 'Dupont', club: 'TC Blagnac' },
        B: { civility: 'Mme', firstName: 'Julie', lastName: 'Martin', club: 'ASPTT Toulouse' },
      },
    };
    expect(announce(r.last, team)).toEqual(['Avantage ASPTT Toulouse']);
  });
});

describe('annonces au service et sanctions', () => {
  it('faute, filet, double faute', () => {
    const r = new Rec('F1');
    r.add({ kind: 'serve', call: 'net' });
    expect(say(r)).toEqual(['Filet, premier service']);
    r.add({ kind: 'serve', call: 'fault' });
    expect(say(r)).toEqual(['Faute']);
    r.add({ kind: 'serve', call: 'net' });
    expect(say(r)).toEqual(['Filet, deuxième service']);
    r.add({ kind: 'serve', call: 'net_fault' });
    expect(say(r)).toEqual(['Filet, faute', '0-15']);
  });

  it('let pendant l\'échange', () => {
    const r = new Rec('F1');
    r.add({ kind: 'let' });
    expect(say(r)).toEqual(['Let']);
  });

  it('code de conduite et dépassement de temps', () => {
    const r = new Rec('F1');
    r.add({ kind: 'conduct', player: 'B', offence: 'abus de balle' });
    expect(say(r)).toEqual(['Violation du code de conduite, abus de balle, avertissement, Mme Martin']);
    r.add({ kind: 'conduct', player: 'B', offence: 'abus de balle' });
    expect(say(r)).toEqual(['Violation du code de conduite, abus de balle, point de pénalité, Mme Martin', '15-0']);
    r.add({ kind: 'conduct', player: 'B', offence: 'Insulte' });
    expect(say(r)).toEqual(['Violation du code de conduite, insulte, trois points de pénalité, Mme Martin', 'Jeu Dupont, premier jeu.', 'Au service Mme Martin']);
    r.add({ kind: 'conduct', player: 'B', offence: 'Jet de raquette' });
    expect(say(r)).toEqual(['Violation du code de conduite, jet de raquette, Mme Martin', 'Le Juge-Arbitre a été appelé sur le court']);
    r.add({ kind: 'time_violation', player: 'A' });
    expect(say(r)).toEqual(['Dépassement de temps, avertissement, Dupont']);
  });

  it('abandon', () => {
    const r = new Rec('F1');
    r.add({ kind: 'end', type: 'retirement', loser: 'B' });
    expect(say(r)).toEqual(["Mesdames, messieurs, Mme Martin est contrainte d'abandonner, jeu set et match Dupont."]);
  });

  it('abandon en cours de match, avec le score', () => {
    const r = new Rec('F1').alternate(8).games('A', 2).games('B').point('A');
    r.add({ kind: 'end', type: 'retirement', loser: 'A' });
    expect(say(r)).toEqual(["Mesdames, messieurs, M. Dupont est contraint d'abandonner, jeu set et match Mme Martin 4/6 1/0."]);
  });

  it('balles neuves annoncées après le jeu', () => {
    const r = new Rec('F1', { balls: { mode: 'regulation', first: 7, every: 9, warmupGames: 2 } }).alternate(5);
    expect(say(r)).toContain('Balles neuves');
  });
});
