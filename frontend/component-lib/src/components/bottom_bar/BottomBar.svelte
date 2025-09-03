<script lang="ts">
    import Container from "../Container.svelte";
    import BottomBarItem from "./BottomBarItem.svelte";

    type Selection = "chats" | "communities" | "notification" | "profile";

    interface Props {
        selection: Selection;
    }

    let { selection = "chats" }: Props = $props();
</script>

<Container
    padding={"sm"}
    borderWidth={"thick"}
    gap={"xl"}
    borderColour={"var(--background-0)"}
    height={{ kind: "fixed", size: "88px" }}
    borderRadius={["md", "md", "zero", "zero"]}
    backgroundColour={"var(--background-1)"}
    mainAxisAlignment={"spaceAround"}>
    <BottomBarItem selected={selection === "chats"}></BottomBarItem>
    <BottomBarItem selected={selection === "communities"}></BottomBarItem>
    <BottomBarItem selected={selection === "notification"}></BottomBarItem>
    <BottomBarItem selected={selection === "profile"}></BottomBarItem>
</Container>
