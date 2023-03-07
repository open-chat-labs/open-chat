<script lang="ts">
    import OpenInNew from "svelte-material-icons/OpenInNew.svelte";

    export let href: string;
    let viewBox = "0 -3 26 26";
</script>

<a {href} target="_blank" rel="noreferrer">
    <slot />

    <div class="icon">
        <OpenInNew {viewBox} size={"1em"} color={"var(--landing-txt)"} />
    </div>
</a>

<style type="text/scss">
    .icon {
        position: relative;
        top: 3px;
        display: inline;
    }

    a {
        position: relative;
    }
</style>
