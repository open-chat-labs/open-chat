<!-- A broadcast host's requests to speak, one card each: who's asking, Not now and Let them speak.
     The host's call view (CallPanel) and the minimised call (MiniCall) both show them.
     TODO(design): undesigned; the minimal broadcast controls (app GAPS.md, "Calls"). -->
<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';
  import RoundIconButton from '../../lib/components/RoundIconButton.svelte';
  import { useT } from '../../lib/i18n';
  import type { CallSpeakRequest } from './CallPanel.svelte';

  interface Props {
    requests: CallSpeakRequest[];
    onApprove?: (id: string) => void;
    onReject?: (id: string) => void;
  }

  let { requests, onApprove, onReject }: Props = $props();
  const t = useT();

  // pictures that failed to load show the initial instead
  const failed = new SvelteSet<string>();
</script>

<div class="requests" role="list" aria-label={t('ui.callPanel.requests')}>
  {#each requests as r (r.id)}
    <div class="request" role="listitem">
      <span class="avatar" style:background={r.grad}>
        {#if r.avatarUrl && !failed.has(r.avatarUrl)}
          {@const url = r.avatarUrl}
          <img class="image" src={url} alt="" onerror={() => failed.add(url)} />
        {:else}{r.initial}{/if}
      </span>
      <span class="text">{t('ui.callPanel.wantsToSpeak', { name: r.name })}</span>
      <RoundIconButton icon="close" label="ui.callPanel.reject" variant="overlay" size="sm" onPress={() => onReject?.(r.id)} />
      <RoundIconButton icon="check" label="ui.callPanel.approve" variant="on" size="sm" onPress={() => onApprove?.(r.id)} />
    </div>
  {/each}
</div>

<style lang="scss">
  .requests {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .request {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 8px 8px 10px;
    border-radius: 14px;
    background: rgba(14, 14, 18, 0.85);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  }

  .avatar {
    flex: none;
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    font: 600 13px/1 var(--font-sans);
    overflow: hidden;
  }

  .image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .text {
    flex: 1;
    min-width: 0;
    font: 500 13px/1.3 var(--font-sans);
  }
</style>
