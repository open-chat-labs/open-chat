<script lang="ts">
    // import ButtonGroup from "../../../ButtonGroup.svelte";
    import Markdown from "../../Markdown.svelte";
    import Avatar from "../../../Avatar.svelte";
    import { AvatarSize } from "openchat-client";
    import { _ } from "svelte-i18n";
    import Button from "../../../Button.svelte";
    import ButtonGroup from "../../..//ButtonGroup.svelte";
    import Search from "../../../Search.svelte";
    import { mobileWidth } from "../../../../stores/screenDimensions";
    import { dummyCommunityChannels } from "../../../../stores/community";

    let searchTerm = "";
    let searching = false;
</script>

<div class="search">
    <Search fill bind:searchTerm bind:searching placeholder={$_("communities.searchGroups")} />
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
<div class="channels">
    {#each $dummyCommunityChannels as channel}
        <div class="channel">
            <div class="details">
                <div class="avatar">
                    <Avatar
                        url={"../assets/group.svg"}
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
            <ButtonGroup align={"end"}>
                <Button tiny hollow>Preview</Button>
                <Button tiny>Join</Button>
            </ButtonGroup>
        </div>
    {/each}
</div>

<style lang="scss">
    .name {
        @include font(bold, normal, fs-130);
        margin-bottom: $sp3;
    }

    .search,
    .channels {
        margin: 0 $sp4;
        @include mobile() {
            margin: 0 $sp3;
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
</style>
