<script lang="ts">
    import type { ChannelMatch, OpenChat } from "openchat-client";
    import { _ } from "svelte-i18n";
    import SectionHeader from "../../../SectionHeader.svelte";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import HoverIcon from "../../../HoverIcon.svelte";
    import Button from "../../../Button.svelte";
    import Search from "../../../Search.svelte";
    import { iconSize } from "../../../../stores/iconSize";
    import { popRightPanelHistory, rightPanelHistory } from "../../../../stores/rightPanel";
    import { getContext, onMount } from "svelte";
    import ChannelCard from "./ChannelCard.svelte";
    import { toastStore } from "stores/toast";

    const client = getContext<OpenChat>("client");

    $: selectedCommunity = client.selectedCommunity;

    let saving = false;
    let searchTerm = "";
    let searching = false;
    let pageIndex = 0;
    let pageSize = 20;
    let searchResults: ChannelMatch[] = [];
    let total = 0;
    let addDefault = new Set<string>();
    let removeDefault = new Set<string>();
    $: more = total > searchResults.length;

    function close() {
        popRightPanelHistory();
    }

    function saveChanges() {
        if ($selectedCommunity === undefined) return;
        if (addDefault.size === 0 && removeDefault.size === 0) return;

        saving = true;
        client
            .manageDefaultChannels($selectedCommunity.id, addDefault, removeDefault)
            .then((success) => {
                if (success) {
                    addDefault = new Set<string>();
                    removeDefault = new Set<string>();
                } else {
                    toastStore.showFailureToast("communities.errors.manageDefaultChannels");
                }
            })
            .finally(() => (saving = false));
    }

    function search(reset = false) {
        if ($selectedCommunity === undefined) return;
        searching = true;
        if (reset) {
            pageIndex = 0;
        } else {
            pageIndex += 1;
        }
        client
            .exploreChannels(
                $selectedCommunity.id,
                searchTerm === "" ? undefined : searchTerm,
                pageIndex,
                pageSize
            )
            .then((results) => {
                if (results.kind === "success") {
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

    function toggleDefaultChannel(ev: CustomEvent<ChannelMatch>) {
        if (ev.detail.isDefault) {
            const removed = addDefault.delete(ev.detail.id.channelId);
            if (!removed) {
                removeDefault.add(ev.detail.id.channelId);
            }
        } else {
            const removed = removeDefault.delete(ev.detail.id.channelId);
            if (!removed) {
                addDefault.add(ev.detail.id.channelId);
            }
        }
        addDefault = addDefault;
        removeDefault = removeDefault;
        ev.detail.isDefault = !ev.detail.isDefault;
    }

    onMount(() => search(true));
</script>

<SectionHeader border={false} flush shadow>
    <h4>{$_("communities.channels")}</h4>
    <span title={$_("back")} class="back" on:click={close}>
        <HoverIcon>
            {#if $rightPanelHistory.length > 1}
                <ArrowLeft size={$iconSize} color={"var(--icon-txt)"} />
            {:else}
                <Close size={$iconSize} color={"var(--icon-txt)"} />
            {/if}
        </HoverIcon>
    </span>
</SectionHeader>

<div class="search">
    <Search
        on:searchEntered={() => search(true)}
        fill
        bind:searchTerm
        bind:searching
        placeholder={$_("communities.searchGroups")} />
</div>

<div class="channels">
    {#each searchResults as channel}
        <ChannelCard on:toggleDefaultChannel={toggleDefaultChannel} {channel} />
    {/each}
    {#if more}
        <div class="more">
            <Button disabled={searching} loading={searching} on:click={() => search(false)}
                >{$_("communities.loadMore")}</Button>
        </div>
    {/if}
</div>

<div class="apply">
    {#if addDefault.size > 0 || removeDefault.size > 0}
        <Button fill square disabled={saving} loading={saving} on:click={() => saveChanges()}
            >{$_("communities.saveChanges")}</Button>
    {/if}
</div>

<style lang="scss">
    .search {
        margin: 0 $sp4;
        @include mobile() {
            margin: 0 $sp3;
        }
    }

    .search {
        margin-bottom: $sp4;
        @include mobile() {
            margin-bottom: $sp3;
        }
    }

    .channels {
        @include nice-scrollbar();
        flex: auto;

        @include mobile() {
            gap: $sp3;
        }
    }

    h4 {
        flex: 1;
        margin: 0;
        @include font-size(fs-120);
    }
    .back {
        flex: 0 0 30px;
    }
    .more {
        text-align: center;
    }

    .apply {
        flex: 0 0 toRem(60);
    }
</style>
