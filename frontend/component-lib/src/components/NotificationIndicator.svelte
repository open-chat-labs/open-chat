<script lang="ts">
    type BorderType = "primary" | "secondary";

    interface Props {
        muted?: boolean;
        border?: BorderType;
    }

    let { muted, border }: Props = $props();

    const borderClass = border ? `border-${border}` : "";
</script>

<div class="outer">
    <div class={`inner ${borderClass}`} class:muted></div>
</div>

<style lang="scss">
    .outer {
        border-radius: var(--rad-xs);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 0.8rem;
        height: 0.8rem;
        .inner {
            --border-width: 0.25rem;

            width: 0.5rem;
            height: 0.5rem;
            background: var(--primary);
            border-radius: var(--rad-xs);
            transform: rotate(45deg);
            transform-origin: 50%;

            &.border-primary {
                box-shadow: 0 0 0 var(--border-width) var(--background-0);
            }

            &.border-secondary {
                box-shadow: 0 0 0 var(--border-width) var(--background-1);
            }

            &.muted {
                background: var(--disabled-button);
            }
        }
    }
</style>
