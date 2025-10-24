<script lang="ts">
    import { CommonButton, Container, Sheet, Subtitle } from "component-lib";
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
    import { browseChannels } from "../../../stores/settings";
    import Translatable from "../../Translatable.svelte";
    import ChannelCard from "./ChannelCard.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        community: CommunitySummary;
        onClose: () => void;
    }

    let { onClose, community }: Props = $props();

    let searchTerm = $state<string>("");
    let selectedCommunityId = $derived(community.id);
    let searching = $state(false);
    let pageIndex = 0;
    let pageSize = 100;
    let searchResults: ChannelMatch[] = $state([]);
    let total = $state(0);
    let autoOpen = $state(false);
    let matchedCommunityId: CommunityIdentifier | undefined = undefined;
    let more = $derived(total > searchResults.length);
    let filteredResults = $derived(searchResults.filter((c) => !$chatSummariesStore.has(c.id)));

    onMount(() => {
        search("", true);
    });

    function search(term: string, reset = false) {
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
            .exploreChannels(communityId, term === "" ? undefined : term, pageIndex, pageSize)
            .then((results) => {
                if (results.kind === "success" && communityId === matchedCommunityId) {
                    if (reset) {
                        searchResults = results.matches;
                    } else {
                        searchResults = [...searchResults, ...results.matches];
                    }
                    total = results.total;
                    if (searchTerm !== "" && filteredResults.length > 0 && !$browseChannels) {
                        autoOpen = true;
                    }
                    if (searchTerm === "" && autoOpen && !$browseChannels) {
                        autoOpen = false;
                    }
                }
            })
            .finally(() => (searching = false));
    }

    $effect(() => {
        if (selectedCommunityId !== undefined) {
            search(searchTerm, true);
        } else {
            searchResults = [];
        }
    });

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
                search(searchTerm, true);
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

<Sheet {onClose}>
    {#snippet sheet()}
        <Container direction={"vertical"} padding={"lg"} gap={"xl"}>
            <Subtitle fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("communities.otherChannels")} />
            </Subtitle>

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
                        onClick={() => search(searchTerm, false)}
                        ><Translatable
                            resourceKey={i18nKey("communities.loadMore")} /></CommonButton>
                {/if}
            </Container>
        </Container>
    {/snippet}
</Sheet>

<!-- {#if filteredResults.length > 0}
    <div class="channels-section">
        <CollapsibleCard
            first
            fill
            onToggle={browseChannels.toggle}
            open={$browseChannels || autoOpen}
            headerText={i18nKey("communities.otherChannels")}>
            {#snippet titleSlot()}
                <div class="browse-channels">
                    <div class="disc">#</div>
                    <div class="label">
                        <Translatable resourceKey={i18nKey("communities.otherChannels")} />
                    </div>
                </div>
            {/snippet}

            <div class="channels">
                {#each filteredResults as channel}
                    <ChannelCard onDeleteChannel={() => deleteChannel(channel)} {channel} />
                {/each}
                {#if more}
                    <div class="more">
                        <Button
                            disabled={searching}
                            loading={searching}
                            onClick={() => search(searchTerm, false)}
                            ><Translatable resourceKey={i18nKey("communities.loadMore")} /></Button>
                    </div>
                {/if}
            </div>
        </CollapsibleCard>
    </div>
{/if} -->
