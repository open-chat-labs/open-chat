<script lang="ts">
    import type { Snippet } from "svelte";

    interface Props {
        hasCustomBackground: boolean;
        children: Snippet;
        userProfileMode: boolean;
    }

    let { hasCustomBackground, children, userProfileMode }: Props = $props();
</script>

<div class="custom_bg_overlay" class:custom={hasCustomBackground} class:userProfileMode>
    {@render children?.()}
</div>

<style lang="scss">
    :global(.custom_bg_overlay.custom *) {
        color: #fff !important;
        text-shadow: 1px 1px 0 #555 !important;
        font-weight: 400;
    }
    .custom_bg_overlay {
        padding: $sp2 $sp5;
        &.custom {
            padding: $sp5 $sp5 $sp3 $sp5;

            background: linear-gradient(
                to top,
                rgba(0, 0, 0, 0.45) 0%,
                rgba(0, 0, 0, 0.1) 90%,
                rgba(0, 0, 0, 0) 100%
            );

            &.userProfileMode {
                border-radius: 0 0 var(--modal-rd) var(--modal-rd);
            }
        }
    }
</style>
