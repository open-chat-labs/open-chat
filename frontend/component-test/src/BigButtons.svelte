<script lang="ts">
    import { BigButton, Container, CountBadge, H2 } from "component-lib";
    import AccountGroup from "svelte-material-icons/AccountGroup.svelte";
    import AccountGroupOutline from "svelte-material-icons/AccountGroupOutline.svelte";
    import AccountMultiple from "svelte-material-icons/AccountMultiple.svelte";
    import AccountMultiplePlus from "svelte-material-icons/AccountMultiplePlus.svelte";
    import Save from "svelte-material-icons/ContentSaveOutline.svelte";
    import FlagOutline from "svelte-material-icons/FlagOutline.svelte";
    import Wallet from "svelte-material-icons/Wallet.svelte";
    import Waveform from "svelte-material-icons/Waveform.svelte";
    import DebugEvent from "./DebugEvent.svelte";

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
                <BigButton onClick={onClicked(onAction)}>
                    {#snippet icon(color)}
                        <AccountMultiplePlus {color} />
                    {/snippet}
                    {#snippet modifier(color)}
                        <CountBadge>23</CountBadge>
                    {/snippet}
                    Alert!!!
                </BigButton>
                <BigButton onClick={onClicked(onAction)}>
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
                <BigButton mode={"active"} onClick={onClicked(onAction)}>
                    {#snippet icon(color)}
                        <Waveform {color} />
                    {/snippet}
                    Waveform
                </BigButton>
                <BigButton onClick={onClicked(onAction)}>
                    {#snippet icon(color)}
                        <Save {color} />
                    {/snippet}
                    {#snippet modifier(color)}
                        <CountBadge>23</CountBadge>
                    {/snippet}
                    Save content
                </BigButton>
                <BigButton onClick={onClicked(onAction)}>
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
                <BigButton width={{ kind: "fixed", size: "150px" }} onClick={onClicked(onAction)}>
                    {#snippet icon(color)}
                        <AccountGroup {color} />
                    {/snippet}
                    Filled
                </BigButton>
                <BigButton
                    mode="active"
                    width={{ kind: "fixed", size: "150px" }}
                    onClick={onClicked(onAction)}>
                    {#snippet icon(color)}
                        <AccountGroupOutline {color} />
                    {/snippet}
                    Outlined
                </BigButton>
                <BigButton
                    mode="pressed"
                    width={{ kind: "fixed", size: "150px" }}
                    onClick={onClicked(onAction)}>
                    {#snippet icon(color)}
                        <AccountMultiple {color} />
                    {/snippet}
                    Pressed
                </BigButton>
                <BigButton width={{ kind: "fixed", size: "150px" }} onClick={onClicked(onAction)}>
                    {#snippet icon(color)}
                        <FlagOutline {color} />
                    {/snippet}
                    Overflowing
                </BigButton>
            </Container>
        </Container>
    {/snippet}
</DebugEvent>
