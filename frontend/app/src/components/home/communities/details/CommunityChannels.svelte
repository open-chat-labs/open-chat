<script lang="ts">
    import Markdown from "../../Markdown.svelte";
    import Avatar from "../../../Avatar.svelte";
    import { AvatarSize, ChannelMatch, OpenChat, routeForChatIdentifier } from "openchat-client";
    import { _ } from "svelte-i18n";
    import SectionHeader from "../../../SectionHeader.svelte";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import HoverIcon from "../../../HoverIcon.svelte";
    import Search from "../../../Search.svelte";
    import { mobileWidth } from "../../../../stores/screenDimensions";
    import { iconSize } from "../../../../stores/iconSize";
    import { popRightPanelHistory, rightPanelHistory } from "../../../../stores/rightPanel";
    import { getContext, onMount } from "svelte";
    import page from "page";

    const client = getContext<OpenChat>("client");

    $: selectedCommunity = client.selectedCommunity;

    let searchTerm = "";
    let searching = false;
    let pageIndex = 0;
    let pageSize = 20;
    let searchResults: ChannelMatch[] = [];

    function close() {
        popRightPanelHistory();
    }

    function selectChannel(match: ChannelMatch) {
        if ($selectedCommunity === undefined) return;
        page(routeForChatIdentifier(match.id));
    }

    function search() {
        if ($selectedCommunity === undefined) return;
        searching = true;
        client
            .exploreChannels(
                $selectedCommunity.id,
                searchTerm === "" ? undefined : searchTerm,
                pageIndex,
                pageSize
            )
            .then((results) => {
                searchResults = results;
            })
            .finally(() => (searching = false));
    }

    onMount(search);
</script>

<SectionHeader border flush shadow>
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
        on:searchEntered={search}
        fill
        bind:searchTerm
        bind:searching
        placeholder={$_("communities.searchGroups")} />
</div>

<div class="channels">
    {#each searchResults as channel}
        <div class="channel" on:click={() => selectChannel(channel)}>
            <div class="details">
                <div class="avatar">
                    <Avatar
                        url={client.groupAvatarUrl(channel.avatar)}
                        size={$mobileWidth ? AvatarSize.Small : AvatarSize.Default} />
                </div>
                <div>
                    <h3 class="channel-name">
                        {channel.name}
                    </h3>
                    <div class="channel-desc">
                        <Markdown text={channel.description} />
                    </div>
                </div>
            </div>
        </div>
    {/each}
</div>

<style lang="scss">
    .search,
    .channels {
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
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(250px, 100%), 1fr));
        gap: $sp4;
        @include nice-scrollbar();

        @include mobile() {
            gap: $sp3;
        }

        .channel {
            padding: $sp4;
            background-color: var(--accent);
            background-color: var(--recommended-bg);
            cursor: pointer;

            .details {
                display: flex;
                margin-bottom: $sp4;
                gap: $sp4;

                .channel-name {
                    margin-bottom: $sp3;
                }

                .channel-desc {
                    color: var(--txt-light);
                }
            }
        }
    }

    h4 {
        flex: 1;
        margin: 0;
        text-align: center;
        @include font-size(fs-120);
    }
    .back {
        flex: 0 0 30px;
    }
</style>
