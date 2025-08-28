<script lang="ts">
    import { Button, theme as neon } from "component-lib";
    import Buttons from "./Buttons.svelte";
    import Colours from "./Colours.svelte";

    neon.writeCssVariables();

    type Section = "colours" | "buttons";
    let selected = $state<Section>("colours");
</script>

<div class="sections">
    <Button onClick={() => (selected = "colours")} secondary={selected !== "colours"}
        >Colours</Button>
    <Button onClick={() => (selected = "buttons")} secondary={selected !== "buttons"}
        >Buttons</Button>
</div>

<div class="selected">
    {#if selected === "colours"}
        <Colours></Colours>
    {:else if selected === "buttons"}
        <Buttons></Buttons>
    {/if}
</div>

<style lang="scss">
    .sections {
        display: flex;
        gap: var(--sp-md);
        margin: var(--sp-xl) 0;
    }
</style>
