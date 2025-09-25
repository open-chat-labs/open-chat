<script lang="ts">
    interface Props {
        url: string;
        children?: import("svelte").Snippet;
    }

    let { url, children }: Props = $props();
</script>

<a href={url}>{@render children?.()}</a>

<style lang="scss">
    a {
        color: currentColor;
    }
</style>
