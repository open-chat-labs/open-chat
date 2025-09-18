<script lang="ts">
    import { Container, H1 } from "component-lib";
    import { anonUserStore, offlineStore } from "openchat-client";
    import BottomBar, { type Selection } from "./bottom_bar/BottomBar.svelte";

    let classStr = $derived(
        `root_container ${$anonUserStore ? "anon" : ""} ${$offlineStore ? "offline" : ""}`,
    );

    let selection = $state<Selection>("chats");
</script>

<Container
    supplementalClass={classStr}
    tag={"main"}
    height={{ kind: "fill" }}
    mainAxisAlignment={"spaceBetween"}
    direction={"vertical"}>
    <H1>{selection}</H1>
    <BottomBar bind:selection />
</Container>

<style lang="scss">
    :global(.root_container.anon) {
        margin-bottom: toRem(50);
    }
    :global(.root_container.offline) {
        margin-bottom: toRem(50);
    }
</style>
