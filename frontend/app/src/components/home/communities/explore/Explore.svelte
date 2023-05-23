<script lang="ts">
    import { dummyCommunities } from "../../../../stores/community";
    import { _ } from "svelte-i18n";
    import Button from "../../../Button.svelte";
    import Select from "../../../Select.svelte";
    import page from "page";
    import CommunityCard from "./CommunityCard.svelte";
    import Search from "../../..//Search.svelte";
    import { pathParams } from "../../../../routes";
    import ToggleIcon from "../../nav/ToggleIcon.svelte";

    let searchTerm = "";
    let searching = false;

    $: selectedCommunityId =
        $pathParams.kind === "communities_route" ? $pathParams.communityId : undefined;
</script>

<div class="explore">
    <div class="header">
        <ToggleIcon />
        <div class="title">{$_("communities.explore")}</div>
        <div class="search">
            <Search bind:searchTerm bind:searching placeholder={$_("communities.search")} />
        </div>
        <div class="create">
            <Button>Create a community</Button>
        </div>
        <div class="tags">
            <p>All, Gaming, Crypto, Metaverse, Sport, Music</p>
        </div>
        <div class="sort">
            <Select>
                <option value={""} selected={true} disabled={true}>Sort by</option>
                <option value={""}>{"Newest"}</option>
                <option value={""}>{"Member count: Low to high"}</option>
                <option value={""}>{"Member count: High to low"}</option>
                <option value={""}>{"Alphabetical: A-Z"}</option>
                <option value={""}>{"Alphabetical: Z-A"}</option>
            </Select>
        </div>
    </div>

    <div class="communities">
        {#each $dummyCommunities as community}
            <CommunityCard
                selected={selectedCommunityId === community.id}
                {community}
                on:click={() => page(`/communities/${community.id}`)}>
                {community.name}
            </CommunityCard>
        {/each}
    </div>
</div>

<style type="text/scss">
    .explore {
        display: flex;
        flex-direction: column;
        gap: $sp5;
        padding: $sp5;

        @include mobile() {
            padding: $sp3;
        }
    }
    .header {
        display: grid;
        grid-template-columns: toRem(40) repeat(5, 1fr);
        gap: $sp4;
        border-bottom: 1px solid var(--bd);
        margin-bottom: $sp3;

        .title {
            @include font(bold, normal, fs-160, 38);
            grid-column: 2 / span 2;
        }

        .search {
            grid-column: span 2;
        }

        .create {
            justify-self: self-end;
            grid-column: 6;
        }

        .tags {
            grid-column: 1 / span 5;
        }

        .sort {
            grid-column: 6;
        }
    }

    .communities {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr));
        gap: $sp5;
    }
</style>
