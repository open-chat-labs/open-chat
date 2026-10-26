<!-- Diamond membership in a dialog: DiamondContent (compare → plans → confirm → pay, or a member's benefits) on the
     shared dialog layer and card. Takes DiamondContent's props; its flow is the dialog's, so closing plays the exit and
     Esc closes (not while paying). -->
<script lang="ts" module>
  export type { DiamondLimits, DiamondPurchase, PlanKey } from './DiamondContent.svelte';
</script>

<script lang="ts">
  import type { ComponentProps } from 'svelte';
  import { onDestroy } from 'svelte';
  import { modal } from '../../lib/behaviours/modal';
  import { DialogFlow } from '../../lib/behaviours/dialog.svelte';
  import DiamondContent from './DiamondContent.svelte';

  // DiamondContent's props but its flow, each membership case kept apart (Omit would merge them)
  type WithoutFlow<T> = T extends unknown ? Omit<T, 'flow'> : never;
  type Props = WithoutFlow<ComponentProps<typeof DiamondContent>>;

  let props: Props = $props();

  const flow = new DialogFlow();
  onDestroy(() => flow.destroy());
</script>

<div class="layer oc-dialog-layer" class:closing={flow.closing} data-screen-label="Diamond" role="dialog" aria-modal="true" use:modal={flow.escape(props.onClose)}>
  <div class="oc-veil" class:closing={flow.closing} onclick={() => flow.dismiss(props.onClose)} aria-hidden="true"></div>

  <div class="card" class:closing={flow.closing}>
    <DiamondContent {...props} {flow} />
  </div>
</div>

<style>
  .layer {
    z-index: 72;
  }

  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 580px;
    height: 770px;
    max-height: 100%;
    box-sizing: border-box;
    border-radius: var(--radius-xl);
    background: var(--surface-1);
    box-shadow:
      inset 0 0 0 1px var(--line-2),
      var(--shadow-modal);
    overflow: hidden;
    animation: oc-dlg-in var(--duration-slow) var(--ease-out) both;
  }

  .card.closing {
    animation: oc-dlg-out 170ms var(--ease-standard) both;
  }
</style>
