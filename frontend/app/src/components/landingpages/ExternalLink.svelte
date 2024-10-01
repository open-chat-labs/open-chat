<script lang="ts">
    import OpenInNew from "svelte-material-icons/OpenInNew.svelte";

    export let href: string;
    export let iconColor: string = "var(--landing-txt)";
    let viewBox = "0 -3 26 26";
</script>

<a {href} target="_blank" rel="noreferrer">
    <slot />

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
