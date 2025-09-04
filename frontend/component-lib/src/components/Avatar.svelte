<script lang="ts">
    type AvatarSize = "small" | "medium" | "large";

    interface Props {
        url: string;
        size?: AvatarSize;
        name?: string;
    }

    // TODO - add intersection observer
    let { url, size = "medium", name }: Props = $props();
</script>

<img loading="lazy" src={url} alt={name} class={`avatar ${size}`} />

<style lang="scss">
    .avatar {
        border-radius: var(--rad-circle);
        object-fit: cover;

        &.small {
            width: var(--avatar-sm);
            height: var(--avatar-sm);
        }

        &.medium {
            width: var(--avatar-md);
            height: var(--avatar-md);
        }

        &.large {
            width: var(--avatar-lg);
            height: var(--avatar-lg);
        }
    }
</style>
