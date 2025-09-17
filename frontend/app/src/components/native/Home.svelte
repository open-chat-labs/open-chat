<script lang="ts">
    import { Container, H1 } from "component-lib";
    import { anonUserStore, offlineStore } from "openchat-client";
    import BottomBar, { type Selection } from "./bottom_bar/BottomBar.svelte";

    let selection = $state<Selection>("chats");

    // do we need new routes? That's awkward because we still need routes from the
    // existing system to work. But tricky because direct & groups have been merged
    function onSelect(_: Selection) {
        console.log("Change selection", selection);
    }

    let classStr = $derived(
        `root_container ${$anonUserStore ? "anon" : ""} ${$offlineStore ? "offline" : ""}`,
    );
</script>

<Container height={{ kind: "fill" }} mainAxisAlignment={"spaceBetween"} direction={"vertical"}>
    <H1>{selection}</H1>
    <BottomBar {onSelect} indicators={new Set(["chats", "communities"])} bind:selection></BottomBar>
</Container>

<!-- <main class:anon={$anonUserStore} class:offline={$offlineStore}></main> -->

<style lang="scss">
    :global(.root_container.anon) {
        margin-bottom: toRem(50);
    }
    :global(.root_container.offline) {
        margin-bottom: toRem(50);
    }
</style>
