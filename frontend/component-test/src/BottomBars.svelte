<script lang="ts">
    import { BottomBar, Container, H2 } from "component-lib";
    import DebugEvent from "./DebugEvent.svelte";

    function onSelect(onAction: (action: string) => void) {
        return (s: unknown) => onAction(`${s} area selected`);
    }
</script>

<DebugEvent>
    {#snippet children(onAction)}
        <Container gap={"md"} direction={"vertical"}>
            <H2>Used for main navigation</H2>
            <Container width={{ kind: "fixed", size: "412px" }} gap={"lg"} direction={"vertical"}>
                <BottomBar
                    onSelect={onSelect(onAction)}
                    indicators={new Set(["chats", "communities"])}
                    avatarName={"Mrs. Witch"}
                    avatarUrl={"/witch.png"}
                    selection={"chats"}></BottomBar>
                <BottomBar
                    onSelect={onSelect(onAction)}
                    indicators={new Set(["chats", "communities"])}
                    avatarUrl={"/witch.png"}
                    selection={"communities"}></BottomBar>
                <BottomBar
                    onSelect={onSelect(onAction)}
                    indicators={new Set(["notification"])}
                    avatarUrl={"/witch.png"}
                    selection={"notification"}></BottomBar>
                <BottomBar
                    onSelect={onSelect(onAction)}
                    avatarUrl={"/witch.png"}
                    selection={"profile"}></BottomBar>
            </Container>
        </Container>
    {/snippet}
</DebugEvent>
