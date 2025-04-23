<script lang="ts">
    import {
        app,
        chatListScopeStore as chatListScope,
        isLocked,
        routeForScope,
        type ChatListScope,
        type OpenChat,
    } from "openchat-client";
    import page from "page";
    import { getContext } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Button from "../Button.svelte";
    import Translatable from "../Translatable.svelte";
    import CommunityCard from "./communities/explore/CommunityCard.svelte";
    import PreviewWrapper from "./communities/PreviewWrapper.svelte";

    const client = getContext<OpenChat>("client");

    function cancelPreview() {
        if (app.selectedCommunitySummary) {
            client.removeCommunity(app.selectedCommunitySummary.id);
            page(routeForScope(client.getDefaultScope()));
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
    let previewingCommunity = $derived(
        app.selectedCommunitySummary?.membership.role === "none" ||
            app.selectedCommunitySummary?.membership.lapsed,
    );
    let locked = $derived(isLocked(app.selectedCommunitySummary?.gateConfig?.gate));
    let [title, message] = $derived(getMessageForScope($chatListScope.kind));
</script>

{#if previewingCommunity && app.selectedCommunitySummary !== undefined}
    <div class="wrapper community">
        <PreviewWrapper>
            {#snippet children(joiningCommunity, joinCommunity)}
                {#if app.selectedCommunitySummary !== undefined}
                    <CommunityCard
                        id={app.selectedCommunitySummary.id.communityId}
                        name={app.selectedCommunitySummary.name}
                        description={app.selectedCommunitySummary.description}
                        banner={app.selectedCommunitySummary.banner}
                        memberCount={0}
                        channelCount={0}
                        language={app.selectedCommunitySummary.primaryLanguage}
                        flags={0}
                        header
                        gateConfig={app.selectedCommunitySummary.gateConfig}
                        avatar={app.selectedCommunitySummary.avatar}
                        verified={app.selectedCommunitySummary.verified} />
                    <div class="join">
                        <Button
                            loading={joiningCommunity}
                            disabled={locked || joiningCommunity}
                            onClick={joinCommunity}
                            ><Translatable
                                resourceKey={locked
                                    ? i18nKey("access.lockedGate", undefined, "community", true)
                                    : i18nKey("communities.joinCommunity")} /></Button>
                        <Button secondary small onClick={cancelPreview}>
                            <Translatable resourceKey={i18nKey("leave")} />
                        </Button>
                    </div>
                {/if}
            {/snippet}
        </PreviewWrapper>
    </div>
{:else}
    <div class="wrapper">
        <h2 class="title"><Translatable resourceKey={i18nKey(title)} /></h2>
        <p class="subtitle"><Translatable resourceKey={i18nKey(message)} /></p>
        {#if $chatListScope.kind === "community"}
            <Button><Translatable resourceKey={i18nKey("communities.browseChannels")} /></Button>
        {:else if $chatListScope.kind === "group_chat"}
            <Button onClick={() => page("/groups")}
                ><Translatable resourceKey={i18nKey("discoverMoreGroups")} /></Button>
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
        max-width: 60%;
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
