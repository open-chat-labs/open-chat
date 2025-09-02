<script lang="ts">
    import { BigButton, Container } from "component-lib";
    import AccountGroup from "svelte-material-icons/AccountGroup.svelte";
    import AccountGroupOutline from "svelte-material-icons/AccountGroupOutline.svelte";
    import AccountMultiple from "svelte-material-icons/AccountMultiple.svelte";
    import AccountMultiplePlus from "svelte-material-icons/AccountMultiplePlus.svelte";
    import Save from "svelte-material-icons/ContentSaveOutline.svelte";
    import FlagOutline from "svelte-material-icons/FlagOutline.svelte";
    import Wallet from "svelte-material-icons/Wallet.svelte";
    import Waveform from "svelte-material-icons/Waveform.svelte";
    import { fade } from "svelte/transition";

    let filledMouseEvent = $state<MouseEvent>();

    function onFilledClick(e: MouseEvent) {
        filledMouseEvent = e;
        window.setTimeout(() => (filledMouseEvent = undefined), 2000);
    }

    // annoyingly if I set the button to fill - it doesn't mean that all the buttons will be the same size
    // Not sure how to deal with that
</script>

<Container gap={"xl"} direction={"vertical"}>
    <h3>Big button groups</h3>

    <Container
        width={{ kind: "fixed", size: "450px" }}
        height={{ kind: "fixed", size: "85px" }}
        gap={"md"}>
        <BigButton onClick={onFilledClick}>
            {#snippet icon(color)}
                <AccountMultiplePlus {color} />
            {/snippet}
            {#snippet modifier(color)}
                <div class="count">21</div>
            {/snippet}
            Alert!!!
        </BigButton>
        <BigButton onClick={onFilledClick}>
            {#snippet icon(color)}
                <Wallet {color} />
            {/snippet}
            Wallet
        </BigButton>
    </Container>

    <Container
        width={{ kind: "fixed", size: "450px" }}
        height={{ kind: "fixed", size: "85px" }}
        gap={"md"}>
        <BigButton mode={"active"} onClick={onFilledClick}>
            {#snippet icon(color)}
                <Waveform {color} />
            {/snippet}
            Waveform
        </BigButton>
        <BigButton onClick={onFilledClick}>
            {#snippet icon(color)}
                <Save {color} />
            {/snippet}
            {#snippet modifier(color)}
                <div class="count">21</div>
            {/snippet}
            Save content
        </BigButton>
        <BigButton onClick={onFilledClick}>
            {#snippet icon(color)}
                <Wallet {color} />
            {/snippet}
            Do the robot dance
        </BigButton>
    </Container>

    <Container
        width={{ kind: "fixed", size: "500px" }}
        height={{ kind: "fixed", size: "85px" }}
        gap={"md"}>
        <BigButton width={{ kind: "fixed", size: "150px" }} onClick={onFilledClick}>
            {#snippet icon(color)}
                <AccountGroup {color} />
            {/snippet}
            Filled
        </BigButton>
        <BigButton mode="active" width={{ kind: "fixed", size: "150px" }} onClick={onFilledClick}>
            {#snippet icon(color)}
                <AccountGroupOutline {color} />
            {/snippet}
            Outlined
        </BigButton>
        <BigButton mode="pressed" width={{ kind: "fixed", size: "150px" }} onClick={onFilledClick}>
            {#snippet icon(color)}
                <AccountMultiple {color} />
            {/snippet}
            Pressed
        </BigButton>
        <BigButton width={{ kind: "fixed", size: "150px" }} onClick={onFilledClick}>
            {#snippet icon(color)}
                <FlagOutline {color} />
            {/snippet}
            Overflowing
        </BigButton>
    </Container>

    {#if filledMouseEvent}
        <pre transition:fade>{JSON.stringify(filledMouseEvent)}</pre>
    {/if}
</Container>

<style lang="scss">
    .count {
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 12px;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background-color: var(--primary);
        color: var(--text-on-primary);
    }
</style>
