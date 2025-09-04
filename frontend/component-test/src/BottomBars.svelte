<script lang="ts">
    import { BottomBar, Container, H2 } from "component-lib";
    import { fade } from "svelte/transition";

    let selection = $state();

    function onSelect(s: unknown) {
        selection = `${s} area selected`;
        window.setTimeout(() => (selection = undefined), 2000);
    }
</script>

<Container gap={"md"} direction={"vertical"}>
    <H2>Used for main navigation</H2>
    <Container width={{ kind: "fixed", size: "412px" }} gap={"lg"} direction={"vertical"}>
        <BottomBar
            {onSelect}
            indicators={new Set(["chats", "communities"])}
            avatarName={"Mrs. Witch"}
            avatarUrl={"/witch.png"}
            selection={"chats"}></BottomBar>
        <BottomBar
            {onSelect}
            indicators={new Set(["chats", "communities"])}
            avatarUrl={"/witch.png"}
            selection={"communities"}></BottomBar>
        <BottomBar
            {onSelect}
            indicators={new Set(["notification"])}
            avatarUrl={"/witch.png"}
            selection={"notification"}></BottomBar>
        <BottomBar {onSelect} avatarUrl={"/witch.png"} selection={"profile"}></BottomBar>
    </Container>

    {#if selection}
        <pre transition:fade>{selection}</pre>
    {/if}
</Container>
