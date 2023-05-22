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
    import CommunityCard from "./CommunityCard.svelte";
    import { popRightPanelHistory } from "../../../../stores/rightPanel";

    export let communityId: string;

    let searchTerm = "";
    let searching = false;

    $: community = $dummyCommunities.find((c) => c.id === communityId);

    function onClose() {
        popRightPanelHistory();
    }
</script>

{#if community}
    <div class="wrapper">
        <CommunityCard header {community} selected={false} />
        <span title={$_("close")} class="close" on:click={onClose}>
            <HoverIcon>
                <Close size={"1em"} color={"var(--icon-txt)"} />
            </HoverIcon>
        </span>
        <div class="buttons">
            <ButtonGroup align={"fill"}>
                <Button hollow>Preview</Button>
                <Button>Join</Button>
            </ButtonGroup>
        </div>
        <div class="search">
            <Search
                fill
                bind:searchTerm
                bind:searching
                placeholder={$_("communities.searchGroups")} />
        </div>
        <div class="sort">
            <Select margin={false}>
                <option value={""} selected={true} disabled={true}>Sort by</option>
                <option value={""}>{"Newest"}</option>
                <option value={""}>{"Member count: Low to high"}</option>
                <option value={""}>{"Member count: High to low"}</option>
                <option value={""}>{"Alphabetical: A-Z"}</option>
                <option value={""}>{"Alphabetical: Z-A"}</option>
            </Select>
        </div>
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

        .buttons,
        .search,
        .sort {
            margin: 0 $sp4;
        }
    }
    .groups {
        display: grid;
        margin: 0 $sp4;
        grid-template-columns: repeat(auto-fit, minmax(min(250px, 100%), 1fr));
        gap: $sp4;

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

    .close {
        position: absolute;
        top: $sp3;
        right: $sp3;
    }
</style>
