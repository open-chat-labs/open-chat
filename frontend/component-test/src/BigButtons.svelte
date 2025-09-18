<script lang="ts">
    import { BigButton, Container, H2, Label } from "component-lib";
    import AccountGroup from "svelte-material-icons/AccountGroup.svelte";
    import AccountGroupOutline from "svelte-material-icons/AccountGroupOutline.svelte";
    import AccountMultiple from "svelte-material-icons/AccountMultiple.svelte";
    import AccountMultiplePlus from "svelte-material-icons/AccountMultiplePlus.svelte";
    import Save from "svelte-material-icons/ContentSaveOutline.svelte";
    import FlagOutline from "svelte-material-icons/FlagOutline.svelte";
    import Wallet from "svelte-material-icons/Wallet.svelte";
    import Waveform from "svelte-material-icons/Waveform.svelte";
    import DebugEvent from "./DebugEvent.svelte";

    let selected1 = $state(1);
    let selected2 = $state(0);

    function onClicked(onAction: (action: string) => void) {
        return () => onAction("Button clicked");
    }
</script>

<DebugEvent>
    {#snippet children(onAction)}
        <Container gap={"xl"} direction={"vertical"}>
            <H2>Big button groups</H2>

            <Container
                width={{ kind: "fixed", size: "450px" }}
                height={{ kind: "fixed", size: "85px" }}
                gap={"md"}>
                <BigButton countBadge={23} mode={"active"} onClick={onClicked(onAction)}>
                    {#snippet icon(color)}
                        <AccountMultiplePlus {color} />
                    {/snippet}
                    Alert!!!
                </BigButton>
                <BigButton countBadge={23} onClick={onClicked(onAction)}>
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
                <BigButton
                    mode={selected1 === 0 ? "active" : "default"}
                    onClick={() => (selected1 = 0)}>
                    {#snippet icon(color)}
                        <Waveform {color} />
                    {/snippet}
                    Waveform
                </BigButton>
                <BigButton
                    countBadge={23}
                    mode={selected1 === 1 ? "active" : "default"}
                    onClick={() => (selected1 = 1)}>
                    {#snippet icon(color)}
                        <Save {color} />
                    {/snippet}
                    Save content
                </BigButton>
                <BigButton
                    mode={selected1 === 2 ? "active" : "default"}
                    onClick={() => (selected1 = 2)}>
                    {#snippet icon(color)}
                        <Wallet {color} />
                    {/snippet}
                    Do the robot dance
                </BigButton>
            </Container>

            <Label>Overflowing group</Label>
            <Container
                borderColour={"cyan"}
                borderStyle={"dashed"}
                borderWidth={"thick"}
                borderRadius={"xl"}
                padding={"xl"}
                width={{ kind: "fixed", size: "500px" }}
                height={{ kind: "fixed", size: "150px" }}
                gap={"md"}>
                <BigButton
                    mode={selected2 === 0 ? "active" : "default"}
                    width={{ kind: "fixed", size: "150px" }}
                    onClick={() => (selected2 = 0)}>
                    {#snippet icon(color)}
                        <AccountGroup {color} />
                    {/snippet}
                    Button One
                </BigButton>
                <BigButton
                    mode={selected2 === 1 ? "active" : "default"}
                    width={{ kind: "fixed", size: "150px" }}
                    onClick={() => (selected2 = 1)}>
                    {#snippet icon(color)}
                        <AccountGroupOutline {color} />
                    {/snippet}
                    Button Two
                </BigButton>
                <BigButton
                    mode={selected2 === 2 ? "active" : "default"}
                    width={{ kind: "fixed", size: "150px" }}
                    onClick={() => (selected2 = 2)}>
                    {#snippet icon(color)}
                        <AccountMultiple {color} />
                    {/snippet}
                    Button Three
                </BigButton>
                <BigButton
                    mode={selected2 === 3 ? "active" : "default"}
                    width={{ kind: "fixed", size: "150px" }}
                    onClick={() => (selected2 = 3)}>
                    {#snippet icon(color)}
                        <FlagOutline {color} />
                    {/snippet}
                    Button Four
                </BigButton>
            </Container>
        </Container>
    {/snippet}
</DebugEvent>
