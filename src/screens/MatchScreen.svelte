<script lang="ts">
  import { onMount } from 'svelte';
  import { db } from '../lib/db';
  import { keepAwake } from '../lib/device';
  import { LiveMatch } from '../lib/state.svelte';
  import PreMatch from './PreMatch.svelte';
  import Umpire from './Umpire.svelte';
  import MatchSheet from './MatchSheet.svelte';

  let { id, onExit }: { id: string; onExit: () => void } = $props();

  let live = $state<LiveMatch | null>(null);
  let missing = $state(false);
  let showSheet = $state(false);

  onMount(() => {
    void db.matches.get(id).then((m) => {
      if (m) live = new LiveMatch(m);
      else missing = true;
    });
    return keepAwake();
  });
</script>

{#if missing}
  <div class="page">
    <p>Ce match est introuvable.</p>
    <button onclick={onExit}>Retour</button>
  </div>
{:else if live}
  {#if showSheet}
    <MatchSheet {live} onBack={() => (showSheet = false)} />
  {:else if live.m.phase === 'prematch'}
    <PreMatch {live} {onExit} />
  {:else}
    <Umpire {live} {onExit} onSheet={() => (showSheet = true)} />
  {/if}
{/if}
