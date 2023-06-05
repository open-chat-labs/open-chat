<script lang="ts">
    import HoverIcon from "../../../HoverIcon.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import Pound from "svelte-material-icons/Pound.svelte";
    import FileDocument from "svelte-material-icons/FileDocument.svelte";
    import { _ } from "svelte-i18n";
    import { mobileWidth } from "../../../../stores/screenDimensions";
    import { dummyCommunities } from "../../../../stores/community";
    import { iconSize } from "../../../../stores/iconSize";
    import CommunityCard from "../explore/CommunityCard.svelte";
    import SectionHeader from "../../../SectionHeader.svelte";
    import page from "page";
    import CommunityChannels from "./CommunityChannels.svelte";
    import CommunityDetails from "./CommunityDetails.svelte";
    import { defaultAccessRules } from "openchat-client";

    export let communityId: string;

    let selectedTab: "channels" | "details" = "channels";
    let rules = { ...defaultAccessRules, enabled: true }; // TODO - shouldn't be the default rules
    let canDelete = true; //TODO - needs to be permissions based

    $: community = $dummyCommunities.find((c) => c.id === communityId);

    function close() {
        page("/communities");
    }
</script>

{#if community}
    <div class="wrapper">
        <div class="header">
            {#if $mobileWidth}
                <SectionHeader border flush shadow>
                    <h4>{community.name}</h4>
                    <span title={$_("close")} class="close" on:click={close}>
                        <HoverIcon>
                            <Close size={$iconSize} color={"var(--icon-txt)"} />
                        </HoverIcon>
                    </span>
                </SectionHeader>
            {:else}
                <CommunityCard joining={false} header {community} selected={false} />
            {/if}

            <div class="tabs">
                <div
                    class="tab channels-tab"
                    on:click={() => (selectedTab = "channels")}
                    class:selected={selectedTab === "channels"}>
                    <Pound color={"var(--txt)"} />
                    {$_("communities.channels")}
                </div>
                <div
                    class="tab details-tab"
                    on:click={() => (selectedTab = "details")}
                    class:selected={selectedTab === "details"}>
                    <FileDocument color={"var(--txt)"} />
                    {$_("communities.details")}
                </div>
            </div>
        </div>
        {#if selectedTab === "channels"}
            <CommunityChannels />
        {:else}
            <CommunityDetails {canDelete} {rules} {community} />
        {/if}
    </div>
{/if}

<style lang="scss">
    .wrapper {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: $sp4;
        height: 100%;
        overflow: hidden;

        @include mobile() {
            gap: $sp3;
        }

        .search {
            margin: 0 $sp4;
            @include mobile() {
                margin: 0 $sp3;
            }
        }

        .tabs {
            display: flex;
            align-items: center;
            border-bottom: 1px solid var(--bd);

            .tab {
                @include font(bold, normal, fs-100);
                padding: $sp4 $sp6;
                transition: background ease-in-out 200ms;
                flex: auto;
                display: flex;
                justify-content: center;
                align-items: center;
                cursor: pointer;
                gap: $sp3;
                &.selected {
                    &:hover {
                        background: var(--button-hv);
                    }
                    background: var(--button-bg);
                    color: var(--button-txt);
                }
            }
        }

        .name {
            @include font(bold, normal, fs-130);
            margin-bottom: $sp3;
        }
    }

    h4 {
        flex: 1;
        margin: 0 $sp3;
        @include font-size(fs-120);
    }
    .close {
        flex: 0 0 30px;
    }
</style>
