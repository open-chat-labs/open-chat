<script lang="ts">
    import { Container } from "component-lib";
    import { activityFeedShowing, mobileWidth, showLeft, showNav } from "openchat-client";
    import { rtlStore } from "../../stores/rtl";
    import ActivityFeed from "./activity/ActivityFeed.svelte";
    import BottomBar, { type Selection } from "./bottom_bar/BottomBar.svelte";
    import ChatList from "./ChatList.svelte";

    let offset = $derived($showNav && !$mobileWidth);
    let selection = $state<Selection>("chats");
    let sectionClass = $derived.by(() => {
        const c = ["left_panel"];
        if ($showLeft) {
            c.push("visible");
        }
        if (offset) {
            c.push("offset");
        }
        if ($rtlStore) {
            c.push("rtl");
        }
        return c.join(" ");
    });
</script>

<Container
    mainAxisAlignment={"spaceBetween"}
    supplementalClass={sectionClass}
    tag={"section"}
    height={{ kind: "fill" }}
    direction={"vertical"}>
    <Container height={{ kind: "fill" }} width={{ kind: "fill" }} direction={"vertical"}>
        {#if $activityFeedShowing}
            <ActivityFeed />
        {:else}
            <ChatList />
        {/if}
    </Container>
    <BottomBar bind:selection />
</Container>

<style lang="scss">
    :global(.container.left_panel) {
        overflow: auto;
        overflow-x: hidden;
        max-width: toRem(500);
        min-width: toRem(300);
        flex: 7;
        border-right: var(--bw) solid var(--bd);
        background: var(--panel-left-bg);

        @include mobile() {
            width: 100%;
            max-width: unset;
            min-width: unset;
            flex: auto;
            border-right: none;
        }
    }

    :global(.container.left_panel.offset) {
        margin-inline-start: toRem(80);
    }

    :global(.container.left_panel.rtl) {
        border-right: none;
        border-left: var(--bw) solid var(--bd);
    }

    :global(.container.left_panel:not(.visible)) {
        display: none;
    }
</style>
