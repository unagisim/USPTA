<script lang="ts">
  import type { Snippet } from 'svelte';

  // Panneau qui monte du bas de l'écran (sanctions, temps, corrections…).
  let { title, onClose, children }: { title: string; onClose: () => void; children: Snippet } = $props();
</script>

<div class="backdrop" role="presentation" onclick={onClose}></div>
<div class="sheet" role="dialog" aria-modal="true" aria-label={title}>
  <div class="head">
    <h2>{title}</h2>
    <button class="ghost" onclick={onClose} aria-label="Fermer">✕</button>
  </div>
  <div class="body">
    {@render children()}
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 0.45);
    z-index: 10;
  }
  .sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    max-height: 88vh;
    max-width: 640px;
    margin: 0 auto;
    overflow-y: auto;
    background: var(--bg);
    border-radius: 16px 16px 0 0;
    z-index: 11;
    padding: 8px 16px calc(16px + env(safe-area-inset-bottom));
  }
  .head {
    display: flex;
    align-items: center;
    position: sticky;
    top: -8px;
    background: var(--bg);
    padding-top: 8px;
  }
  .head h2 {
    flex: 1;
    margin: 0;
  }
  .body :global(button) {
    width: 100%;
    margin-bottom: 8px;
  }
  .body :global(.seg button),
  .body :global(.row button) {
    width: auto;
    margin-bottom: 0;
  }
</style>
