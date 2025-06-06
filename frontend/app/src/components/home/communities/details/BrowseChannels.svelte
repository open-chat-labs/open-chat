<script lang="ts">
    import {
        chatSummariesStore,
        publish,
        selectedCommunitySummaryStore,
        type ChannelMatch,
        type OpenChat,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { i18nKey } from "../../../../i18n/i18n";
    import { browseChannels } from "../../../../stores/settings";
    import Button from "../../../Button.svelte";
    import CollapsibleCard from "../../../CollapsibleCard.svelte";
    import Translatable from "../../../Translatable.svelte";
    import ChannelCard from "./ChannelCard.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        searchTerm: string;
    }

    let { searchTerm }: Props = $props();

    let selectedCommunityId = $derived($selectedCommunitySummaryStore?.id.communityId);
    let searching = $state(false);
    let pageIndex = 0;
    let pageSize = 100;
    let searchResults: ChannelMatch[] = $state([]);
    let total = $state(0);
    let autoOpen = $state(false);
    let matchedCommunityId: string | undefined = undefined;
    let more = $derived(total > searchResults.length);
    let filteredResults = $derived(searchResults.filter((c) => !$chatSummariesStore.has(c.id)));

    function search(term: string, reset = false) {
        const communityId = selectedCommunityId;
        if (communityId === undefined) return;
        if (communityId !== matchedCommunityId) {
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
            .exploreChannels(
                { kind: "community", communityId },
                term === "" ? undefined : term,
                pageIndex,
                pageSize,
            )
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
</script>

{#if filteredResults.length > 0}
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
{/if}

<style lang="scss">
    :global(.channels-section .card.open) {
        border-bottom: none;
    }

    :global(.channels-section .card .header) {
        @include mobile() {
            padding-left: toRem(10);
            padding-right: toRem(10);
        }
    }

    .channels {
        @include nice-scrollbar();
        flex: auto;

        @include mobile() {
            gap: $sp3;
        }
    }

    .more {
        text-align: center;
    }

    .browse-channels {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: toRem(12);

        .label {
            flex: auto;
        }

        .disc {
            display: flex;
            align-items: center;
            justify-content: center;
            align-content: center;
            text-align: center;
            height: toRem(48);
            width: toRem(48);
            background-color: var(--icon-hv);
            border-radius: 50%;
            @include font-size(fs-120);
        }
    }
</style>
