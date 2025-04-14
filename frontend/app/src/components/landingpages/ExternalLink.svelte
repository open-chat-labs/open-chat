<script lang="ts">
    import type { Snippet } from "svelte";
    import OpenInNew from "svelte-material-icons/OpenInNew.svelte";

    interface Props {
        href: string;
        iconColor?: string;
        children?: Snippet;
    }

    let { href, iconColor = "var(--landing-txt)", children }: Props = $props();
    let viewBox = "0 -3 26 26";
</script>

<a {href} target="_blank" rel="noreferrer">
    {@render children?.()}

    <div class="icon">
        <OpenInNew {viewBox} size={"1em"} color={iconColor} />
    </div>
</a>

<style lang="scss">
    .icon {
        position: relative;
        top: 3px;
        display: inline;
    }

    a {
        position: relative;
    }
</style>
