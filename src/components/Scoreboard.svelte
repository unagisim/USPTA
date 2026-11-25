<script lang="ts">
  import { formatPoints, other, type ScoreState, type Side } from '../lib/engine';

  // Tableau de score en deux colonnes, dans l'ordre réel des joueurs vus de la chaise.
  let { score, left, names }: { score: ScoreState; left: Side; names: Record<Side, string> } = $props();

  const order = $derived([left, other(left)] as Side[]);
  const pts = $derived(formatPoints(score));
  const live = $derived(!score.winner);
</script>

<div class="board">
  {#each order as s, i (s)}
    <div class="col {i === 0 ? 'l' : 'r'}" class:winner={score.winner === s}>
      <div class="name">
        {#if live && score.server === s}<span class="ball" aria-label="Au service"></span>{/if}
        <span>{names[s]}</span>
      </div>
      <div class="sets">
        {#each score.completedSets as set, k (k)}
          <span class:lost={set.games[s] < set.games[other(s)]}>
            {set.superTiebreak && set.tiebreak ? set.tiebreak[s] : set.games[s]}{#if set.tiebreak && !set.superTiebreak && set.games[s] < set.games[other(s)]}<sup>{set.tiebreak[s]}</sup>{/if}
          </span>
        {/each}
      </div>
      {#if live}
        <div class="games" aria-label="Jeux">{score.isSuperTiebreakSet ? '–' : score.games[s]}</div>
        <div class="pts" aria-label="Points">{pts[s]}</div>
      {/if}
    </div>
  {/each}
</div>
{#if live && score.inTiebreak}
  <p class="tb">{score.isSuperTiebreakSet ? 'Super jeu décisif (10 points)' : 'Jeu décisif (7 points)'}</p>
{/if}

<style>
  .board {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    font-variant-numeric: tabular-nums;
  }
  .col {
    border-radius: var(--radius);
    padding: 8px 10px;
    text-align: center;
    border: 2px solid transparent;
  }
  .l {
    background: var(--l-bg);
    color: var(--l);
    border-color: var(--l-strong);
  }
  .r {
    background: var(--r-bg);
    color: var(--r);
    border-color: var(--r-strong);
  }
  .winner {
    outline: 3px solid var(--accent);
  }
  .name {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-weight: 700;
    min-height: 24px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .ball {
    width: 14px;
    height: 14px;
    flex: none;
    border-radius: 50%;
    background: var(--ball);
    border: 1px solid #556000;
  }
  .sets {
    display: flex;
    justify-content: center;
    gap: 10px;
    min-height: 22px;
    font-size: 18px;
  }
  .lost {
    opacity: 0.6;
  }
  .games {
    font-size: 30px;
    font-weight: 700;
    line-height: 1.1;
  }
  .pts {
    font-size: 40px;
    font-weight: 800;
    line-height: 1.1;
  }
  .tb {
    text-align: center;
    font-weight: 700;
    margin: 6px 0 0;
  }
</style>
