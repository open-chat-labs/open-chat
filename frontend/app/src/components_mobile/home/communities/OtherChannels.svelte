<script lang="ts">
    import { Body, CommonButton, Container, Sheet, Subtitle } from "component-lib";
    import {
        chatListScopeStore,
        chatSummariesStore,
        communityIdentifiersEqual,
        publish,
        routeForChatIdentifier,
        selectedCommunitySummaryStore,
        type ChannelMatch,
        type CommunityIdentifier,
        type CommunitySummary,
        type OpenChat,
    } from "openchat-client";
    import page from "page";
    import { getContext, onMount } from "svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import ChannelCard from "./ChannelCard.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        community: CommunitySummary;
        onClose: () => void;
    }

    let { onClose, community }: Props = $props();

    let selectedCommunityId = $derived(community.id);
    let searching = $state(false);
    let pageIndex = 0;
    let pageSize = 100;
    let searchResults: ChannelMatch[] = $state([]);
    let total = $state(0);
    let matchedCommunityId: CommunityIdentifier | undefined = undefined;
    let more = $derived(total > searchResults.length);
    let filteredResults = $derived(searchResults.filter((c) => !$chatSummariesStore.has(c.id)));

    onMount(() => {
        search(true);
    });

    function search(reset = false) {
        const communityId = selectedCommunityId;
        if (communityId === undefined) return;
        if (!communityIdentifiersEqual(communityId, matchedCommunityId)) {
            searchResults = [];
        }
        matchedCommunityId = communityId;
        searching = true;
        if (reset) {
            pageIndex = 0;
        } else {
            pageIndex += 1;
        }
        client
            .exploreChannels(communityId, undefined, pageIndex, pageSize)
            .then((results) => {
                if (results.kind === "success" && communityId === matchedCommunityId) {
                    if (reset) {
                        searchResults = results.matches;
                    } else {
                        searchResults = [...searchResults, ...results.matches];
                    }
                    total = results.total;
                }
            })
            .finally(() => (searching = false));
    }

    function deleteChannel(channel: ChannelMatch) {
        publish("deleteGroup", {
            kind: "delete",
            chatId: channel.id,
            level: "channel",
            doubleCheck: {
                challenge: i18nKey("typeGroupName", { name: channel.name }),
                response: i18nKey(channel.name),
            },
            after: () => {
                search(true);
            },
        });
    }

    function selectChannel(match: ChannelMatch) {
        if ($selectedCommunitySummaryStore === undefined) return;
        if (!match.public && !match.invited) return;
        client.popRightPanelHistory();
        page(routeForChatIdentifier($chatListScopeStore.kind, match.id));
        onClose();
    }
</script>

<Sheet dismissible {onClose}>
    <Container direction={"vertical"} padding={"lg"} gap={"xl"}>
        <Subtitle fontWeight={"bold"}>
            <Translatable resourceKey={i18nKey("communities.otherChannels")} />
        </Subtitle>

        {#if !searching && filteredResults.length === 0}
            <Body colour={"textSecondary"}>
                <Translatable
                    resourceKey={i18nKey(
                        "There don't seem to be any other channels that you are no already a member of.",
                    )}></Translatable>
            </Body>
        {:else}
            <Container gap={"xl"} direction="vertical">
                {#each filteredResults as channel}
                    <ChannelCard
                        onSelectChannel={() => selectChannel(channel)}
                        onDeleteChannel={() => deleteChannel(channel)}
                        {channel} />
                {/each}
                {#if more}
                    <CommonButton
                        mode={"default"}
                        size={"small_text"}
                        disabled={searching}
                        loading={searching}
                        onClick={() => search(false)}
                        ><Translatable
                            resourceKey={i18nKey("communities.loadMore")} /></CommonButton>
                {/if}
            </Container>
        {/if}
    </Container>
</Sheet>
