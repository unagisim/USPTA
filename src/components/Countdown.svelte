<script lang="ts">
  import { alert, clock } from '../lib/device';
  import { app } from '../lib/state.svelte';

  // Compte à rebours qui part de `start` (horodatage) ; alertes aux secondes de `alerts`.
  let {
    label,
    start,
    duration,
    alerts = [10, 0],
    endText = 'Time',
    onStop,
  }: {
    label: string;
    start: number;
    duration: number;
    alerts?: number[];
    endText?: string;
    onStop?: () => void;
  } = $props();

  const remaining = $derived(duration * 1000 - (app.now - start));
  const over = $derived(remaining <= 0);

  // Une alerte par seuil franchi, une seule fois ; pas d'alerte pour les seuils déjà dépassés à l'ouverture.
  let fired = new Set<number>();
  let primed = false;
  $effect(() => {
    const left = remaining / 1000;
    for (const a of alerts) {
      if (left <= a && !fired.has(a)) {
        fired.add(a);
        if (primed) alert(app.settings, a === 0);
      }
    }
    primed = true;
  });
</script>

<div class="cd" class:over class:soon={!over && remaining <= 10_000}>
  <span class="label">{label}</span>
  <span class="time">{over ? `+${clock(-remaining)}` : clock(remaining)}</span>
  {#if over}<span class="end">« {endText} »</span>{/if}
  {#if onStop}<button class="ghost stop" onclick={onStop}>Arrêter</button>{/if}
</div>

<style>
  .cd {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 12px;
    border-radius: var(--radius);
    background: var(--surface-2);
    font-variant-numeric: tabular-nums;
  }
  .label {
    flex: 1;
    font-weight: 600;
  }
  .time {
    font-size: 28px;
    font-weight: 700;
  }
  .soon {
    background: var(--warn-bg);
    color: var(--warn);
  }
  .over {
    background: var(--danger-bg);
    color: var(--danger);
  }
  .end {
    font-weight: 700;
  }
  .stop {
    min-height: 40px;
  }
</style>
