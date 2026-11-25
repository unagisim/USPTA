<script lang="ts">
  import Sheet from './Sheet.svelte';
  import { MAX_TOILET_BREAKS, other, type Side, type TimerKind } from '../lib/engine';
  import type { LiveMatch } from '../lib/state.svelte';

  let { live, left, onClose, onDone }: { live: LiveMatch; left: Side; onClose: () => void; onDone: () => void } = $props();

  const sides = $derived([left, other(left)] as Side[]);
  const active = $derived(live.result.activeTimer);

  async function start(timer: TimerKind, player?: Side) {
    if (active) await live.add({ kind: 'timer', timer: active.timer, action: 'stop', ...(active.player ? { player: active.player } : {}) });
    await live.add({ kind: 'timer', timer, action: 'start', ...(player ? { player } : {}) });
    onDone();
  }
</script>

<Sheet title="Temps" {onClose}>
  <h3>Temps mort médical (3 min de soins)</h3>
  <div class="two">
    {#each sides as s (s)}
      <button onclick={() => start('medical', s)}>{live.name(s)}</button>
    {/each}
  </div>

  <h3>Pause toilettes ou tenue</h3>
  <div class="two">
    {#each sides as s (s)}
      {@const used = live.result.toiletBreaks[s]}
      <button onclick={() => start('toilet', s)} class:warn={used >= MAX_TOILET_BREAKS}>
        {live.name(s)}<br /><small>{used} / {MAX_TOILET_BREAKS} utilisées</small>
      </button>
    {/each}
  </div>
  <p class="muted">2 pauses par joueur et par match, échauffement compris, de préférence en fin de set.</p>

  <h3>Interruption</h3>
  <button onclick={() => start('interruption')}>Interrompre le match (pluie, nuit…)</button>
  <p class="muted">Le match est enregistré à chaque point : il peut être repris plus tard depuis l'accueil.</p>
</Sheet>

<style>
  h3 {
    font-size: 16px;
    margin: 12px 0 8px;
  }
  .two {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .two button {
    width: 100%;
    min-height: 64px;
  }
  .warn {
    background: var(--warn-bg);
    color: var(--warn);
  }
</style>
