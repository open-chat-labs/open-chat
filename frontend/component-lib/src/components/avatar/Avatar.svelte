<script lang="ts">
    import type { BorderRadiusSize } from "component-lib";

    type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

    interface Props {
        url: string;
        size?: AvatarSize;
        name?: string;
        radius?: BorderRadiusSize;
    }

    // TODO - add intersection observer
    let { url, size = "md", name, radius = "circle" }: Props = $props();
</script>

<img
    loading="lazy"
    src={url}
    alt={name}
    class={`avatar ${size}`}
    style={`border-radius: var(--rad-${radius});`} />

<style lang="scss">
    .avatar {
        object-fit: cover;

        &.xs {
            width: var(--avatar-xs);
            height: var(--avatar-xs);
        }

        &.sm {
            width: var(--avatar-sm);
            height: var(--avatar-sm);
        }

        &.md {
            width: var(--avatar-md);
            height: var(--avatar-md);
        }

        &.lg {
            width: var(--avatar-lg);
            height: var(--avatar-lg);
        }

        &.xl {
            width: var(--avatar-xl);
            height: var(--avatar-xl);
        }
    }
</style>
