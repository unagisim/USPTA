<script lang="ts">
  import type { PlayerColor } from '../lib/colors';
  import { formatPoints, other, type ScoreState, type Side } from '../lib/engine';

  // Tableau de score en lignes, comme un afficheur de court.
  // Le joueur à gauche de la chaise est en haut, celui de droite en bas ; chacun garde la couleur de sa tenue.
  let {
    score,
    left,
    names,
    colors,
  }: { score: ScoreState; left: Side; names: Record<Side, string>; colors: Record<Side, PlayerColor> } = $props();

  const order = $derived([left, other(left)] as Side[]);
  const pts = $derived(formatPoints(score));
  const live = $derived(!score.winner);
  const setNo = $derived(score.completedSets.length + 1);
  const ptsLabel = $derived(score.isSuperTiebreakSet ? 'SJD' : score.inTiebreak ? 'JD' : 'Pts');
</script>

<table class="board">
  <thead>
    <tr>
      <th class="who"></th>
      {#each score.completedSets as _, k (k)}<th>M{k + 1}</th>{/each}
      {#if live}
        {#if !score.isSuperTiebreakSet}<th class="cur">M{setNo}</th>{/if}
        <th class="pts">{ptsLabel}</th>
      {/if}
    </tr>
  </thead>
  <tbody>
    {#each order as s, i (s)}
      <tr class="c-{colors[s]}" class:winner={score.winner === s}>
        <td class="who">
          <span class="srv">{#if live && score.server === s}<span class="ball" aria-label="Au service"></span>{/if}</span>
          <span class="name">{names[s]}</span>
        </td>
        {#each score.completedSets as set, k (k)}
          <td class:lost={set.games[s] < set.games[other(s)]}>
            {set.superTiebreak && set.tiebreak ? set.tiebreak[s] : set.games[s]}{#if set.tiebreak && !set.superTiebreak && set.games[s] < set.games[other(s)]}<sup>{set.tiebreak[s]}</sup>{/if}
          </td>
        {/each}
        {#if live}
          {#if !score.isSuperTiebreakSet}<td class="cur">{score.games[s]}</td>{/if}
          <td class="pts">{pts[s]}</td>
        {/if}
      </tr>
    {/each}
  </tbody>
</table>

<style>
  /* Couleurs fixes d'afficheur : fond sombre, chiffres clairs, lisibles au soleil. */
  .board {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    background: #0d1813;
    color: #f4f7f5;
    border-radius: var(--radius);
    overflow: hidden;
    font-variant-numeric: tabular-nums;
    table-layout: auto;
  }
  th {
    font-size: 12px;
    font-weight: 600;
    color: #9fb3aa;
    padding: 4px 6px 0;
    text-align: center;
    letter-spacing: 0.04em;
  }
  td {
    text-align: center;
    font-size: 24px;
    font-weight: 700;
    padding: 4px 6px;
    width: 2.2em;
  }
  tbody tr:first-child td {
    border-bottom: 1px solid #24342c;
  }
  td.who {
    width: auto;
    text-align: left;
    font-size: 17px;
    padding-left: 0;
    max-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  /* Bande de la couleur du joueur, avec un filet clair pour que le noir reste visible. */
  td.who {
    padding-left: 10px;
    box-shadow:
      inset 8px 0 0 var(--p-swatch),
      inset 9px 0 0 #ffffff59;
  }
  .srv {
    display: inline-flex;
    width: 22px;
    justify-content: center;
    vertical-align: middle;
  }
  .ball {
    width: 13px;
    height: 13px;
    border-radius: 50%;
    background: #c9e21b;
  }
  .name {
    vertical-align: middle;
  }
  .lost {
    color: #8a9a92;
  }
  sup {
    font-size: 12px;
  }
  .cur {
    color: #ffffff;
    background: #1c2c24;
  }
  th.cur {
    color: #ffffff;
  }
  td.pts {
    color: #c9e21b;
    font-size: 30px;
    font-weight: 800;
    width: 2.4em;
  }
  .winner td.who {
    font-weight: 800;
  }
  .winner td.who::after {
    content: ' ✓';
    color: #c9e21b;
  }
</style>
