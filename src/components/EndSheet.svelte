<script lang="ts">
  import Sheet from './Sheet.svelte';
  import { other, type EndType, type Side } from '../lib/engine';
  import type { LiveMatch } from '../lib/state.svelte';

  let { live, left, onClose, onDone }: { live: LiveMatch; left: Side; onClose: () => void; onDone: () => void } = $props();

  let type = $state<EndType>('retirement');
  let loser = $state<Side | null>(null);
  let note = $state('');

  const TYPES: [EndType, string][] = [
    ['retirement', 'Abandon'],
    ['disqualification', 'Disqualification'],
    ['walkover', 'Forfait'],
  ];

  async function confirmEnd() {
    if (!loser) return;
    await live.add({ kind: 'end', type, loser, ...(note.trim() ? { note: note.trim() } : {}) });
    onDone();
  }
</script>

<Sheet title="Fin de match anticipée" {onClose}>
  <div class="seg">
    {#each TYPES as [t, label] (t)}
      <button aria-pressed={type === t} onclick={() => (type = t)}>{label}</button>
    {/each}
  </div>
  <p class="muted">Joueur qui {type === 'retirement' ? 'abandonne' : type === 'walkover' ? 'déclare forfait' : 'est disqualifié'} :</p>
  <div class="two">
    {#each [left, other(left)] as s (s)}
      <button aria-pressed={loser === s} onclick={() => (loser = s)}>{live.name(s)}</button>
    {/each}
  </div>
  <label for="en">Motif</label>
  <input id="en" bind:value={note} />
  <button class="danger confirm" disabled={!loser} onclick={confirmEnd}>Terminer le match</button>
  <p class="muted">Le score est figé. « Annuler » permet de revenir en arrière en cas d'erreur.</p>
</Sheet>

<style>
  .two {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 12px;
  }
  .two button {
    width: 100%;
  }
  .two button[aria-pressed='true'] {
    background: var(--accent);
    color: var(--accent-fg);
  }
  .confirm {
    margin-top: 12px;
  }
</style>
