<script lang="ts">
  // Tirage au sort à pile ou face dans l'application : un joueur annonce, la pièce est lancée,
  // le gagnant est désigné et repris directement pour la suite (choix, présentation, feuille).
  import type { CoinFace, CoinToss } from '../lib/db';
  import { vibrate } from '../lib/device';
  import { app } from '../lib/state.svelte';
  import { other, type Side } from '../lib/engine';

  let {
    names,
    done,
    onResult,
    onReset,
  }: {
    names: Record<Side, string>;
    /** Tirage déjà effectué dans l'application, s'il y en a un. */
    done: CoinToss | null;
    onResult: (winner: Side, coin: CoinToss) => void;
    onReset: () => void;
  } = $props();

  const FACES: [CoinFace, string][] = [
    ['heads', 'Pile'],
    ['tails', 'Face'],
  ];
  const label = (f: CoinFace) => (f === 'heads' ? 'Pile' : 'Face');

  let caller = $state<Side | null>(null);
  let call = $state<CoinFace | null>(null);
  let spinning = $state(false);
  /** Face montrée pendant l'animation. */
  let shown = $state<CoinFace>('heads');

  /** Tirage équitable : un octet aléatoire du système, pair ou impair. */
  function flip(): CoinFace {
    const b = new Uint8Array(1);
    crypto.getRandomValues(b);
    return (b[0] & 1) === 0 ? 'heads' : 'tails';
  }

  async function launch() {
    if (!caller || !call || spinning) return;
    spinning = true;
    const result = flip();
    // Petite animation : la pièce tourne environ 1,5 s avant de montrer le résultat.
    for (let i = 0; i < 12; i++) {
      shown = shown === 'heads' ? 'tails' : 'heads';
      await new Promise((r) => setTimeout(r, 60 + i * 8));
    }
    shown = result;
    spinning = false;
    if (app.settings.vibrate) vibrate(200);
    const winner = result === call ? caller : other(caller);
    onResult(winner, { caller, call, result });
  }
</script>

{#if done}
  <div class="result">
    <div class="coin big" aria-hidden="true">{label(done.result)}</div>
    <div>
      <p>
        {names[done.caller]} a annoncé « {label(done.call)} », la pièce est tombée sur « {label(done.result)} ».
      </p>
      <p class="winner">Gagnant du tirage : {names[done.call === done.result ? done.caller : other(done.caller)]}</p>
    </div>
  </div>
  <button class="ghost small" onclick={onReset}>Refaire le tirage</button>
{:else}
  <div>
    <label for="caller">Qui annonce pile ou face ?</label>
    <div class="seg" id="caller">
      {#each ['A', 'B'] as const as s (s)}
        <button aria-pressed={caller === s} onclick={() => (caller = s)} disabled={spinning}>{names[s]}</button>
      {/each}
    </div>
  </div>
  <div>
    <label for="call">Son annonce</label>
    <div class="seg" id="call">
      {#each FACES as [f, l] (f)}
        <button aria-pressed={call === f} onclick={() => (call = f)} disabled={spinning}>{l}</button>
      {/each}
    </div>
  </div>
  <div class="launch">
    <div class="coin" class:spinning aria-live="polite">{spinning ? label(shown) : '?'}</div>
    <button class="primary" onclick={launch} disabled={!caller || !call || spinning}>
      {spinning ? 'La pièce tourne…' : 'Lancer la pièce'}
    </button>
  </div>
{/if}

<style>
  .launch,
  .result {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .launch button {
    flex: 1;
  }
  .coin {
    flex: none;
    width: 64px;
    height: 64px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 15px;
    color: #4a3b00;
    background: radial-gradient(circle at 35% 30%, #fff6c8, #e2b93b 60%, #b8901e);
    border: 3px solid #a07c16;
    box-shadow: 0 2px 6px rgb(0 0 0 / 0.25);
  }
  .coin.big {
    width: 76px;
    height: 76px;
    font-size: 17px;
  }
  .spinning {
    animation: flip 0.25s linear infinite;
  }
  @keyframes flip {
    to {
      transform: rotateY(360deg);
    }
  }
  .result p {
    margin: 2px 0;
  }
  .winner {
    font-weight: 700;
    font-size: 17px;
  }
  .small {
    align-self: flex-start;
  }
</style>
