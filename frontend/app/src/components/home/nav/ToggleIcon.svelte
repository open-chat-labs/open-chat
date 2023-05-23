<script lang="ts">
    import Arrow from "svelte-material-icons/ArrowExpandRight.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import { navOpen } from "../../../stores/layout";
    import { hideLeftNav } from "../../../stores/settings";
</script>

{#if $hideLeftNav}
    <span on:click={() => navOpen.set(true)} class="menu">
        <HoverIcon>
            <Arrow size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
    </span>
{/if}
