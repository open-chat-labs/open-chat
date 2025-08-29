<script lang="ts">
    import { Button, Container } from "component-lib";
    import AccountMultiplePlus from "svelte-material-icons/AccountMultiplePlus.svelte";
    import { fade } from "svelte/transition";
    import Section from "./Section.svelte";

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

<Container direction={"vertical"}>
    <h3>Filled & Outlined buttons</h3>

    <Container gap={"lg"}>
        <Section>
            <div class="block">
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
        </Section>
        <Section>
            <div class="block">
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
        </Section>
    </Container>
</Container>

<style lang="scss">
    .block {
        width: 300px;
        display: flex;
        flex-direction: column;
        gap: var(--sp-md);
    }
</style>
