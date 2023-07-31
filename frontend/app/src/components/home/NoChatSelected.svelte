<script lang="ts">
    import Button from "../Button.svelte";
    import { _ } from "svelte-i18n";
    import page from "page";
    import { getContext } from "svelte";
    import type { ChatListScope, OpenChat } from "openchat-client";
    import { pushRightPanelHistory } from "../../stores/rightPanel";
    import CommunityCard from "./communities/explore/CommunityCard.svelte";
    import PreviewWrapper from "./communities/PreviewWrapper.svelte";
    import { routeForScope } from "../../routes";

    const client = getContext<OpenChat>("client");

    $: chatListScope = client.chatListScope;
    $: selectedCommunity = client.selectedCommunity;
    $: previewingCommunity = $selectedCommunity?.membership.role === "none";

    $: [title, message] = getMessageForScope($chatListScope.kind);

    function cancelPreview() {
        if ($selectedCommunity) {
            client.removeCommunity($selectedCommunity.id);
            page(routeForScope(client.getDefaultScope()));
        }
    }

    function showChannels() {
        if ($chatListScope.kind === "community") {
            pushRightPanelHistory({
                kind: "community_channels",
            });
        }
    }

    function getMessageForScope(scope: ChatListScope["kind"]): [string, string] {
        switch (scope) {
            case "community":
                return ["noChannelSelected", "selectAChannel"];
            case "direct_chat":
                return ["noUserSelected", "selectAUser"];
            case "favourite":
                return ["noChatSelected", "selectAFavourite"];
            case "group_chat":
                return ["noChatSelected", "selectAGroupChat"];
            default:
                return ["noChatSelected", "selectAChat"];
        }
    }
</script>

{#if previewingCommunity && $selectedCommunity}
    <div class="wrapper community">
        <PreviewWrapper let:joinCommunity let:joiningCommunity>
            <CommunityCard
                id={$selectedCommunity.id.communityId}
                name={$selectedCommunity.name}
                description={$selectedCommunity.description}
                banner={$selectedCommunity.banner}
                memberCount={0}
                channelCount={0}
                language={$selectedCommunity.primaryLanguage}
                flags={0}
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
{:else}
    <div class="wrapper">
        <h2 class="title">{$_(title)}</h2>
        <p class="subtitle">{$_(message)}</p>
        {#if $chatListScope.kind === "community"}
            <Button on:click={showChannels}>{$_("communities.browseChannels")}</Button>
        {:else if $chatListScope.kind === "group_chat"}
            <Button on:click={() => page("/groups")}>{$_("discoverMoreGroups")}</Button>
        {/if}
    </div>
{/if}

<style lang="scss">
    :global(.wrapper.community .card) {
        min-width: toRem(280);
        max-width: 50%;
    }
    .wrapper {
        display: flex;
        flex-direction: column;
        justify-content: center;
        text-align: center;
        align-items: center;
        height: 100%;
        max-width: 50%;
        margin: auto;

        &.community {
            text-align: start;
        }
    }

    .subtitle {
        margin-bottom: $sp5;
        text-wrap: balance;
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
