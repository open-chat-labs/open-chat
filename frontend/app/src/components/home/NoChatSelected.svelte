<script lang="ts">
    import Button from "../Button.svelte";
    import { _ } from "svelte-i18n";
    import page from "page";
    import { getContext } from "svelte";
    import type { OpenChat } from "openchat-client";
    import { pushRightPanelHistory } from "../../stores/rightPanel";
    import CommunityCard from "./communities/explore/CommunityCard.svelte";
    import PreviewWrapper from "./communities/PreviewWrapper.svelte";

    const client = getContext<OpenChat>("client");

    $: chatListScope = client.chatListScope;
    $: selectedCommunity = client.selectedCommunity;
    $: previewingCommunity = $selectedCommunity?.membership.role === "none";

    function cancelPreview() {
        if ($selectedCommunity) {
            client.removeCommunity($selectedCommunity.id);
            page("/favourite");
        }
    }

    function showChannels() {
        if ($chatListScope.kind === "community") {
            pushRightPanelHistory({
                kind: "community_channels",
            });
        }
    }
</script>

{#if previewingCommunity && $selectedCommunity}
    <div class="wrapper">
        <PreviewWrapper let:joinCommunity let:joiningCommunity>
            <CommunityCard
                name={$selectedCommunity.name}
                description={$selectedCommunity.description}
                banner={$selectedCommunity.banner}
                memberCount={0}
                channelCount={0}
                header
                gate={$selectedCommunity.gate}
                avatar={$selectedCommunity.avatar} />
            <div class="join">
                <Button
                    loading={joiningCommunity}
                    disabled={joiningCommunity}
                    on:click={() => joinCommunity(false)}>{$_("communities.joinCommunity")}</Button>
                <Button secondary={true} small={true} on:click={cancelPreview}>
                    {$_("leave")}
                </Button>
            </div>
        </PreviewWrapper>
    </div>
{:else if $chatListScope.kind !== "community"}
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

    .join {
        display: flex;
        flex-direction: column;
        gap: $sp4;
        margin-top: $sp5;
    }

    .title {
        @include font(bold, normal, fs-180);
        margin-bottom: $sp3;
    }
</style>
