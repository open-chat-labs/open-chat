<script lang="ts">
    import AccountGroup from "svelte-material-icons/AccountGroup.svelte";
    import ForumOutline from "svelte-material-icons/ForumOutline.svelte";
    import Lightbulb from "svelte-material-icons/LightbulbVariantOutline.svelte";
    import Avatar from "../Avatar.svelte";
    import Container from "../Container.svelte";
    import BottomBarItem from "./BottomBarItem.svelte";

    type Selection = "chats" | "communities" | "notification" | "profile";

    type Indicators = Set<Selection>;

    interface Props {
        selection: Selection;
        onSelect?: (selection: Selection) => void;
        avatarUrl: string;
        avatarName?: string;
        indicators?: Indicators;
    }

    let {
        selection = "chats",
        onSelect,
        avatarUrl,
        avatarName,
        indicators = new Set(),
    }: Props = $props();

    function itemSelected(s: Selection) {
        selection = s;
        onSelect?.(s);
    }
</script>

<Container
    padding={["sm", "lg"]}
    borderWidth={"thick"}
    gap={"xl"}
    borderColour={"var(--background-0)"}
    height={{ kind: "fixed", size: "88px" }}
    borderRadius={["md", "md", "zero", "zero"]}
    backgroundColour={"var(--background-1)"}
    mainAxisAlignment={"spaceAround"}>
    <BottomBarItem
        indicator={indicators.has("chats")}
        onSelect={() => itemSelected("chats")}
        selected={selection === "chats"}>
        {#snippet icon(color)}
            <ForumOutline {color} />
        {/snippet}
    </BottomBarItem>
    <BottomBarItem
        indicator={indicators.has("communities")}
        onSelect={() => itemSelected("communities")}
        selected={selection === "communities"}>
        {#snippet icon(color)}
            <AccountGroup {color} />
        {/snippet}
    </BottomBarItem>
    <BottomBarItem
        indicator={indicators.has("notification")}
        onSelect={() => itemSelected("notification")}
        selected={selection === "notification"}>
        {#snippet icon(color)}
            <Lightbulb {color} />
        {/snippet}
    </BottomBarItem>
    <BottomBarItem
        indicator={indicators.has("profile")}
        onSelect={() => itemSelected("profile")}
        selected={selection === "profile"}>
        {#snippet icon(color)}
            <Avatar size={"large"} url={avatarUrl} name={avatarName}></Avatar>
        {/snippet}
    </BottomBarItem>
</Container>
