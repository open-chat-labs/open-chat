<script lang="ts">
    interface Props {
        muted?: boolean;
    }

    let { muted }: Props = $props();
</script>

<div class="outer">
    <div class="inner" class:muted></div>
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
            width: 0.5rem;
            height: 0.5rem;
            background: var(--primary);
            border-radius: var(--rad-xs);
            transform: rotate(45deg);
            transform-origin: 50%;

            &.muted {
                background: var(--disabled-button);
            }
        }
    }
</style>
