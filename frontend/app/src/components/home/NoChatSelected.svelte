<script lang="ts">
    import Button from "../Button.svelte";
    import page from "page";
    import { getContext } from "svelte";
    import {
        isLocked,
        type ChatListScope,
        type OpenChat,
        chatListScopeStore as chatListScope,
        selectedCommunity,
    } from "openchat-client";
    import CommunityCard from "./communities/explore/CommunityCard.svelte";
    import PreviewWrapper from "./communities/PreviewWrapper.svelte";
    import { routeForScope } from "../../routes";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";

    const client = getContext<OpenChat>("client");

    function cancelPreview() {
        if ($selectedCommunity) {
            client.removeCommunity($selectedCommunity.id);
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
        $selectedCommunity?.membership.role === "none" || $selectedCommunity?.membership.lapsed,
    );
    let locked = $derived(isLocked($selectedCommunity?.gateConfig?.gate));
    let [title, message] = $derived(getMessageForScope($chatListScope.kind));
</script>

{#if previewingCommunity && $selectedCommunity}
    <div class="wrapper community">
        <PreviewWrapper>
            {#snippet children(joiningCommunity, joinCommunity)}
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
                    gateConfig={$selectedCommunity.gateConfig}
                    avatar={$selectedCommunity.avatar}
                    verified={$selectedCommunity.verified} />
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
