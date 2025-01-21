<script lang="ts">
    import { AvatarSize } from "openchat-client";
    import type { Snippet } from "svelte";
    import { _ } from "svelte-i18n";

    interface Props {
        position: "ne" | "se" | "sw" | "nw";
        size: AvatarSize;
        children?: Snippet;
    }

    let { position, size, children }: Props = $props();
    let offset = $derived.by(() => {
        switch (size) {
            case AvatarSize.Default:
                return 3;
            default:
                return 2;
        }
    });
</script>

<div
    style={`--offset: ${offset}px`}
    class={`mod ${position}`}
    class:tiny={size === AvatarSize.Tiny}
    class:small={size === AvatarSize.Small}
    class:default={size === AvatarSize.Default}
    class:large={size === AvatarSize.Large}>
    {@render children?.()}
</div>

<style lang="scss">
    .mod {
        position: absolute;
        border-radius: 50%;

        &.tiny {
        }

        &.small {
        }

        &.default {
            width: toRem(20);
            height: toRem(20);
        }

        &.large {
        }

        &.ne {
            top: calc(0px - var(--offset));
            right: calc(0px - var(--offset));
        }

        &.se {
            bottom: calc(0px - var(--offset));
            right: calc(0px - var(--offset));
        }

        &.sw {
            bottom: calc(0px - var(--offset));
            left: calc(0px - var(--offset));
        }

        &.nw {
            top: calc(0px - var(--offset));
            left: calc(0px - var(--offset));
        }
    }
</style>
