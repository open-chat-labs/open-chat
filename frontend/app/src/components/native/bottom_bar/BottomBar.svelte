<script module lang="ts">
    export type Selection = "chats" | "communities" | "notification" | "profile";
</script>

<script lang="ts">
    import { Avatar, Container } from "component-lib";
    import { allUsersStore, currentUserIdStore, OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import AccountGroup from "svelte-material-icons/AccountGroup.svelte";
    import ForumOutline from "svelte-material-icons/ForumOutline.svelte";
    import Lightbulb from "svelte-material-icons/LightbulbVariantOutline.svelte";
    import BottomBarItem from "./BottomBarItem.svelte";

    type Indicators = Set<Selection>;

    interface Props {
        selection: Selection;
        onSelect?: (selection: Selection) => void;
        indicators?: Indicators;
    }

    const client = getContext<OpenChat>("client");

    let { selection = $bindable("chats"), onSelect, indicators = new Set() }: Props = $props();

    let user = $derived($allUsersStore.get($currentUserIdStore));
    let avatarUrl = $derived(user ? client.userAvatarUrl(user) : "/assets/unknownUserAvatar.svg");
    let avatarName = $derived(user?.username ?? "unknown user");

    function itemSelected(s: Selection) {
        selection = s;
        onSelect?.(s);
    }
</script>

<Container
    padding={["xl", "lg", "sm", "lg"]}
    borderWidth={"thick"}
    gap={"xl"}
    borderColour={"var(--background-0)"}
    height={{ kind: "fixed", size: "88px" }}
    borderRadius={["md", "md", "zero", "zero"]}
    backgroundColour={"var(--background-1)"}
    mainAxisAlignment={"spaceAround"}>
    <div class={`selection ${selection}`}></div>
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
        {#snippet icon()}
            <Avatar size={"lg"} url={avatarUrl} name={avatarName}></Avatar>
        {/snippet}
    </BottomBarItem>
</Container>

<style lang="scss">
    .selection {
        position: absolute;
        width: calc(25% - 2rem);
        left: 0;
        top: 0.375rem;
        height: var(--sp-xs);
        background: var(--gradient);
        border-radius: var(--rad-sm);
        transition: left ease-in-out 200ms;

        // first and last need to account for the container's padding

        &.chats {
            left: calc(0% + 1rem + 0.25rem);
        }

        &.communities {
            left: calc(25% + 1rem);
        }

        &.notification {
            left: calc(50% + 1rem);
        }

        &.profile {
            left: calc(75% + 1rem - 0.25rem);
        }
    }
</style>
