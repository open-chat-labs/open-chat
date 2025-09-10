<script lang="ts">
    import {
        Body,
        Caption,
        Container,
        H2,
        Label,
        MenuItem,
        MenuTrigger,
        Subtitle,
        Switch,
    } from "component-lib";
    import ChatOutline from "svelte-material-icons/ChatOutline.svelte";
    import CommentQuoteOutline from "svelte-material-icons/CommentQuoteOutline.svelte";
    import Headphones from "svelte-material-icons/Headphones.svelte";
    import Rocket from "svelte-material-icons/RocketLaunch.svelte";
    import DebugEvent from "./DebugEvent.svelte";

    let longpress = $state(false);
</script>

<Container gap={"lg"} direction="vertical">
    <Container gap={"xs"} direction="vertical">
        <H2>Anything can act as a menu trigger</H2>
        <Body>And it can use either click or longpress</Body>
    </Container>
    <Container gap={"md"} crossAxisAlignment={"center"}>
        <Switch bind:checked={longpress}></Switch>
        <Label>Use long press</Label>
    </Container>
    <Caption width={{ kind: "fixed", size: "300px" }}
        >Note this setting makes no difference on desktop and might not work 100% if you're not
        using a real device</Caption>
    <DebugEvent>
        {#snippet children(onAction)}
            <MenuTrigger
                mobileMode={longpress ? "longpress" : "tap"}
                position={"bottom"}
                align={"middle"}>
                <Container
                    width={{ kind: "fixed", size: "200px" }}
                    padding={"xxl"}
                    mainAxisAlignment={"center"}
                    crossAxisAlignment={"center"}
                    borderStyle={"dashed"}
                    borderColour={"cyan"}
                    borderWidth={"thick"}>
                    <Subtitle width={{ kind: "hug" }}>Click or long press</Subtitle>
                </Container>
                {#snippet menuItems()}
                    <MenuItem onclick={() => onAction("Make a call clicked")}>
                        {#snippet icon(color)}
                            <Headphones {color} />
                        {/snippet}
                        Make a call
                    </MenuItem>
                    <MenuItem onclick={() => onAction("Quote clicked")}>
                        {#snippet icon(color)}
                            <CommentQuoteOutline {color} />
                        {/snippet}
                        Quote
                    </MenuItem>
                    <MenuItem onclick={() => onAction("Reply in thread clicked")}>
                        {#snippet icon(color)}
                            <ChatOutline {color} />
                        {/snippet}
                        Reply in thread
                    </MenuItem>
                    <MenuItem danger onclick={() => onAction("Launch clicked")}>
                        {#snippet icon(color)}
                            <Rocket {color} />
                        {/snippet}
                        Launch the missile
                    </MenuItem>
                {/snippet}
            </MenuTrigger>
        {/snippet}
    </DebugEvent>
</Container>
