<script lang="ts">
    import ButtonGroup from "../../../ButtonGroup.svelte";
    import Select from "../../../Select.svelte";
    import HoverIcon from "../../../HoverIcon.svelte";
    import Markdown from "../../Markdown.svelte";
    import Avatar from "../../../Avatar.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { AvatarSize } from "openchat-client";
    import { _ } from "svelte-i18n";
    import Button from "../../../Button.svelte";
    import Search from "../../..//Search.svelte";
    import { mobileWidth } from "../../../../stores/screenDimensions";
    import { dummyCommunityGroups, dummyCommunities } from "../../../../stores/community";
    import { iconSize } from "../../../../stores/iconSize";
    import CommunityCard from "./CommunityCard.svelte";
    import SectionHeader from "../../../SectionHeader.svelte";
    import page from "page";

    export let communityId: string;

    let searchTerm = "";
    let searching = false;

    $: community = $dummyCommunities.find((c) => c.id === communityId);

    function close() {
        page("/communities");
    }
</script>

{#if community}
    <div class="wrapper">
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
            <CommunityCard header {community} selected={false} />
        {/if}
        <div class="search">
            <Search
                fill
                bind:searchTerm
                bind:searching
                placeholder={$_("communities.searchGroups")} />
        </div>
        <!-- <div class="sort">
            <Select margin={false}>
                <option value={""} selected={true} disabled={true}>Sort by</option>
                <option value={""}>{"Newest"}</option>
                <option value={""}>{"Member count: Low to high"}</option>
                <option value={""}>{"Member count: High to low"}</option>
                <option value={""}>{"Alphabetical: A-Z"}</option>
                <option value={""}>{"Alphabetical: Z-A"}</option>
            </Select>
        </div> -->
        <div class="groups">
            {#each $dummyCommunityGroups as group}
                <div class="group">
                    <div class="details">
                        <div class="avatar">
                            <Avatar
                                url={"../assets/group.svg"}
                                size={$mobileWidth ? AvatarSize.Small : AvatarSize.Default} />
                        </div>
                        <div>
                            <h3 class="group-name">
                                {group.name}
                            </h3>
                            <div class="group-desc">
                                <Markdown text={group.description} />
                            </div>
                        </div>
                    </div>
                    <ButtonGroup align={"end"}>
                        <Button tiny hollow>Preview</Button>
                        <Button tiny>Join</Button>
                    </ButtonGroup>
                </div>
            {/each}
        </div>
    </div>
{/if}

<style type="text/scss">
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

        .search,
        .groups,
        .sort {
            margin: 0 $sp4;
            @include mobile() {
                margin: 0 $sp3;
            }
        }

        .name {
            @include font(bold, normal, fs-130);
            margin-bottom: $sp3;
        }

        .groups {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(min(250px, 100%), 1fr));
            gap: $sp4;
            @include nice-scrollbar();

            @include mobile() {
                gap: $sp3;
            }

            .group {
                padding: $sp4;
                background-color: var(--accent);
                background-color: var(--recommended-bg);

                .details {
                    display: flex;
                    margin-bottom: $sp4;
                    gap: $sp4;

                    .group-name {
                        margin-bottom: $sp3;
                    }

                    .group-desc {
                        color: var(--txt-light);
                    }
                }
            }
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
