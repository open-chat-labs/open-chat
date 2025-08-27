<script lang="ts">
    import AccountMultiplePlus from "svelte-material-icons/AccountMultiplePlus.svelte";
    import { fade } from "svelte/transition";
    import Button from "../src/components/Button.svelte";

    let filledMouseEvent = $state<MouseEvent>();
    let hollowMouseEvent = $state<MouseEvent>();

    function onFilledClick(e: MouseEvent) {
        filledMouseEvent = e;
        window.setTimeout(() => (filledMouseEvent = undefined), 2000);
    }

    function onHollowClick(e: MouseEvent) {
        hollowMouseEvent = e;
        window.setTimeout(() => (hollowMouseEvent = undefined), 2000);
    }
</script>

<div class="section">
    <h3>Filled & Outlined buttons</h3>

    <div class="blocks">
        <div class="filled block">
            <h5>Filled / Primary</h5>
            <Button onClick={onFilledClick}>Button filled</Button>
            <Button>
                {#snippet icon(color)}
                    <AccountMultiplePlus size={"1.4rem"} {color} />
                {/snippet}
                Button with icon
            </Button>
            <Button loading>Loading button</Button>
            <Button disabled>Disabled button</Button>

            {#if filledMouseEvent}
                <pre transition:fade>{JSON.stringify(filledMouseEvent)}</pre>
            {/if}
        </div>
        <div class="outlined block">
            <h5>Outlined / Secondary</h5>
            <Button secondary onClick={onHollowClick}>Button Outlined</Button>
            <Button secondary>
                {#snippet icon(color)}
                    <AccountMultiplePlus size={"1.4rem"} {color} />
                {/snippet}
                Button with icon
            </Button>
            <Button secondary loading>Loading button</Button>
            <Button secondary disabled>Disabled button</Button>

            {#if hollowMouseEvent}
                <pre transition:fade>{JSON.stringify(hollowMouseEvent)}</pre>
            {/if}
        </div>
    </div>
</div>

<style lang="scss">
    h1 {
        margin-bottom: 10px;
    }

    .blocks {
        display: flex;
        gap: 20px;
    }

    .block {
        padding: 20px;
        width: 300px;
        border: 1px dashed #9747ff;
        border-radius: 10px;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
</style>
