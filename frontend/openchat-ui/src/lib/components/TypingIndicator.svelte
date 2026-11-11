<!-- Who is typing: overlapping gradient faces, three bouncing dots and a label ("Priya is typing", "2 people are typing").
     variant "bubble" is a DM's: the three dots alone in a received-style bubble at the end of the messages (34px tall,
     the small corner top-left), fading in as it arrives; the label is its accessible name. Native's has no avatar; with
     showAvatar the web's has the typer's 34px avatar before it, laid out as a received MessageGroup run (its
     --group-gap and --group-ring). -->
<script lang="ts">
  import { useT } from '../i18n';
  import Avatar, { AVATAR_GRADIENTS } from './Avatar.svelte';
  const GRADIENTS: Record<string, string> = {
    // a person's, chat's or community's swatch is Avatar's, as everywhere (one gradient per name)
    ...AVATAR_GRADIENTS,
  };

  interface Props {
    names: string[];
    /** Face colours (Avatar's), cycled over names: violet | blue | teal | amber | plum. */
    colors?: string[];
    /** Ring around each face; match the surface behind. */
    ringColor?: string;
    /** Overrides the generated label. Resource key (or literal text). */
    label?: string;
    /** faces: the faces, dots and label in a row. bubble: a DM's, the dots in a received-style bubble (the label is
        read out, not shown). */
    variant?: 'faces' | 'bubble';
    /** bubble only: the typer's 34px avatar before the bubble, as a received MessageGroup run has it (the web's DMs).
        Native's bubble has none. */
    showAvatar?: boolean;
    /** bubble with showAvatar: the typer's picture over their colour (Avatar's `url`); the colour alone without it. */
    avatarUrl?: string;
    /** bubble with showAvatar: the typer's colour (an Avatar gradient: violet | amber | teal | blue). */
    avatarColor?: 'violet' | 'blue' | 'teal' | 'amber' | 'plum';
  }

  let {
    names,
    colors = ['violet', 'teal'],
    ringColor = 'var(--card)',
    label = '',
    variant = 'faces',
    showAvatar = false,
    avatarUrl,
    avatarColor = 'violet',
  }: Props = $props();
  const t = useT();

  const text = $derived(label ? t(label) : t('ui.typingIndicator.typing', { count: names.length, name: names[0], second: names[1] ?? '' }));
</script>

{#snippet bubble()}
  <div class="bubble" role="status" aria-label={text}>
    <span class="dot"></span>
    <span class="dot"></span>
    <span class="dot"></span>
  </div>
{/snippet}

{#if variant === 'bubble' && showAvatar}
  <div class="run">
    <span class="avatar"><Avatar size={34} color={avatarColor} url={avatarUrl} /></span>
    {@render bubble()}
  </div>
{:else if variant === 'bubble'}
  {@render bubble()}
{:else}
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
{/if}

<style lang="scss">
  @use '../styles/mixins' as *;

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

    & + & {
      margin-inline-start: -9px;
    }
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
    background: var(--ink-3);
    animation: oc-typing 1.2s infinite var(--ease-standard);
  }

  .label {
    font: var(--weight-medium) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-3);
  }

  // a DM's: received style (its background, ring and shadow), 34px tall, the small corner at the start of the top
  .bubble {
    display: flex;
    align-items: center;
    gap: 4px;
    width: max-content;
    height: 34px;
    box-sizing: border-box;
    padding: 0 13px;
    border-radius: 16px;
    border-start-start-radius: 5px;
    background: var(--bubble-recv-bg);
    box-shadow: var(--bubble-ring), var(--bubble-shadow);
    animation: bubble-in var(--duration-base) var(--ease-out);

    .dot {
      width: 6px;
      height: 6px;
      animation-timing-function: ease;

      &:nth-child(2) {
        animation-delay: 0.15s;
      }

      &:nth-child(3) {
        animation-delay: 0.3s;
      }
    }
  }

  // the web's: the avatar and the bubble as a received MessageGroup run lays them out (its gap and ring), arriving together
  .run {
    display: flex;
    align-items: flex-start;
    gap: var(--group-gap, var(--space-10));
    animation: bubble-in var(--duration-base) var(--ease-out);

    .bubble {
      animation: none;
    }
  }

  .avatar {
    flex: none;
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    box-shadow: 0 0 0 4px var(--group-ring, var(--surface-1));
  }

  @keyframes bubble-in {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
  }

  @include reduced-motion {
    .run,
    .bubble,
    .bubble .dot {
      animation: none;
    }
  }
</style>
