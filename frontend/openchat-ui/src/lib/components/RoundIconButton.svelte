<!-- Circular icon control (call controls, mini call, recorder).
     variant: default | on (accent) | off (inverted — e.g. camera off) | danger | overlay (on video). size: sm 34 | md 50 | lg 56. -->
<script lang="ts">
  import { useT } from '../i18n';
  type Variant = 'default' | 'on' | 'off' | 'danger' | 'overlay';
  type Size = 'sm' | 'md' | 'lg';

  interface Props {
    icon: string;
    /** Resource key (or literal text): accessible name and tooltip. */
    label: string;
    variant?: Variant;
    size?: Size;
    pressed?: boolean;
    tooltip?: boolean;
    onPress?: (e: Event) => void;
  }

  let { icon, label, variant = 'default', size = 'sm', pressed, tooltip = true, onPress }: Props = $props();
  const t = useT();

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onPress?.(e);
    }
  }
</script>

<span
  class="round-button {variant} {size}"
  onclick={(e) => onPress?.(e)}
  {onkeydown}
  role="button"
  tabindex="0"
  aria-label={t(label)}
  aria-pressed={pressed == null ? undefined : pressed}
  data-tip={tooltip ? (label ? t(label) : undefined) : undefined}
>
  <span class="glyph" style:mask="var(--icon-{icon}) center/contain no-repeat"></span>
</span>

<style>
  .round-button {
    --px: 34px;
    --icon-px: 14px;
    --button-bg: var(--overlay-2);
    --button-ink: var(--ink);
    flex: none;
    width: var(--px);
    height: var(--px);
    border-radius: 50%;
    background: var(--button-bg);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition:
      background 160ms,
      filter 160ms;
  }

  .round-button:hover {
    filter: brightness(1.15);
  }

  .round-button:focus {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .md {
    --px: 50px;
    --icon-px: 20px;
  }

  .lg {
    --px: 56px;
    --icon-px: 22px;
  }

  .on {
    --button-bg: var(--accent);
    --button-ink: var(--on-accent);
  }

  /* inverted: ink-coloured disc with a surface-coloured glyph, in either mode */
  .off {
    --button-bg: var(--ink);
    --button-ink: var(--surface-1);
  }

  .danger {
    --button-bg: var(--status-danger);
    --button-ink: #fff;
  }

  .overlay {
    --button-bg: rgba(0, 0, 0, 0.4);
    --button-ink: #fff;
  }

  .glyph {
    width: var(--icon-px);
    height: var(--icon-px);
    background: var(--button-ink);
  }
</style>
