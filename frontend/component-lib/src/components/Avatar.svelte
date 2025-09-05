<script lang="ts">
    type AvatarSize = "sm" | "md" | "lg" | "xl";

    interface Props {
        url: string;
        size?: AvatarSize;
        name?: string;
    }

    // TODO - add intersection observer
    let { url, size = "md", name }: Props = $props();
</script>

<img loading="lazy" src={url} alt={name} class={`avatar ${size}`} />

<style lang="scss">
    .avatar {
        border-radius: var(--rad-circle);
        object-fit: cover;

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
