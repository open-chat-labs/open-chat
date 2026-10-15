<!-- Who is typing: overlapping gradient faces, three bouncing dots and a label ("Priya is typing", "2 people are typing"). -->
<script lang="ts">
  import { useT } from '../i18n';
  const GRADIENTS: Record<string, string> = {
    violet: 'linear-gradient(140deg,#8C6BFF,#FF5EAE)',
    amber: 'linear-gradient(140deg,#ffb03d,#ff4d4d)',
    teal: 'linear-gradient(140deg,#2EE6A8,#1FB6FF)',
    blue: 'linear-gradient(140deg,#5FA8FF,#8C6BFF)',
  };

  interface Props {
    names: string[];
    /** Face colours, cycled over names: violet | amber | teal | blue. */
    colors?: string[];
    /** Ring around each face; match the surface behind. */
    ringColor?: string;
    /** Overrides the generated label. Resource key (or literal text). */
    label?: string;
  }

  let { names, colors = ['violet', 'teal'], ringColor = 'var(--card,#0e0e12)', label = '' }: Props = $props();
  const t = useT();

  const text = $derived(label ? t(label) : t('ui.typingIndicator.typing', { count: names.length, name: names[0] }));
</script>

<div class="typing">
  <div class="faces">
    {#each names as _, i}
      <span class="face" style:background={GRADIENTS[colors[i % colors.length]] ?? GRADIENTS.violet} style:box-shadow="0 0 0 2px {ringColor}"></span>
    {/each}
  </div>
  <div class="status">
    <div class="dots">
      <span class="dot"></span>
      <span class="dot" style:animation-delay=".18s"></span>
      <span class="dot" style:animation-delay=".36s"></span>
    </div>
    <span class="label">{text}</span>
  </div>
</div>

<style>
  .typing {
    display: flex;
    align-items: center;
    gap: var(--space-10);
  }

  .faces {
    flex: none;
    display: flex;
  }

  .face {
    width: 24px;
    height: 24px;
    border-radius: var(--radius-pill);
  }

  .face + .face {
    margin-inline-start: -9px;
  }

  .status {
    display: flex;
    align-items: center;
    gap: var(--space-8);
  }

  .dots {
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .dot {
    width: 5px;
    height: 5px;
    border-radius: var(--radius-pill);
    background: var(--ink-3, #8a8a99);
    animation: oc-typing 1.2s infinite var(--ease-standard);
  }

  .label {
    font: var(--weight-medium) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-3, #8a8a99);
  }
</style>
