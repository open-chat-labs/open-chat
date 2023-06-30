<script lang="ts">
    import Button from "../Button.svelte";
    import { _ } from "svelte-i18n";
    import page from "page";
    import { getContext } from "svelte";
    import type { OpenChat } from "openchat-client";
    import { pushRightPanelHistory } from "../../stores/rightPanel";

    const client = getContext<OpenChat>("client");

    $: chatListScope = client.chatListScope;

    function showChannels() {
        if ($chatListScope.kind === "community") {
            pushRightPanelHistory({
                kind: "community_channels",
            });
        }
    }
</script>

{#if $chatListScope.kind !== "community"}
    <div class="wrapper">
        <h2 class="title">{$_("noChatSelected")}</h2>
        <p class="subtitle">{$_("selectAChat")}</p>
        <Button on:click={() => page("/hotgroups")}>{$_("showHotGroups")}</Button>
    </div>
{:else}
    <div class="wrapper">
        <h2 class="title">{$_("communities.noChannelSelected")}</h2>
        <p class="subtitle">{$_("communities.selectAChannel")}</p>
        <Button on:click={showChannels}>{$_("communities.browseChannels")}</Button>
    </div>
{/if}

<style lang="scss">
    .wrapper {
        display: flex;
        flex-direction: column;
        justify-content: center;
        text-align: center;
        align-items: center;
        height: 100%;
    }

    .subtitle {
        margin-bottom: $sp5;
    }

    .title {
        @include font(bold, normal, fs-180);
        margin-bottom: $sp3;
    }
</style>
