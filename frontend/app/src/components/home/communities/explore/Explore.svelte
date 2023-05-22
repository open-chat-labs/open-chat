<script lang="ts">
    import Button from "../../../Button.svelte";
    import page from "page";

    const communities = [
        { name: "Community One", id: 0 },
        { name: "Community Two", id: 1 },
        { name: "Community Three", id: 2 },
        { name: "Community Four", id: 3 },
        { name: "Community Five", id: 4 },
        { name: "Community Six", id: 5 },
        { name: "Community Seven", id: 6 },
        { name: "Community Eight", id: 7 },
        { name: "Community Nine", id: 8 },
        { name: "Community Ten", id: 9 },
        { name: "Community Eleven", id: 10 },
        { name: "Community Twelve", id: 11 },
        { name: "Community Thirteen", id: 12 },
        { name: "Community Fourteen", id: 13 },
    ];
</script>

<div class="explore">
    <div class="header">
        <div class="title">
            <h1>Explore Communities</h1>
        </div>
        <div class="search">
            <p>Search</p>
        </div>
        <div class="create">
            <Button>Create a community</Button>
        </div>
        <div class="tags">
            <p>All, Gaming, Crypto, Metaverse, Sport, Music</p>
        </div>
        <div class="sort">
            <p>Sort</p>
        </div>
    </div>

    <div class="communities">
        {#each communities as community}
            <div on:click={() => page(`/communities/${community.id}`)} class="community">
                {community.name}
            </div>
        {/each}
    </div>
</div>

<style type="text/scss">
    .explore {
        display: flex;
        flex-direction: column;
        gap: $sp4;
        padding: $sp5;

        @include mobile() {
            padding: $sp3;
        }
    }
    .header {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: $sp4;

        div {
            background-color: var(--primary);
        }

        h1 {
            @include font(bold, normal, fs-160);
        }

        .title {
            grid-column: 1 / span 3;
        }

        .search {
            grid-column: 4;
        }

        .create {
            grid-column: 5;
        }

        .tags {
            grid-column: 1 / span 4;
        }

        .sort {
            grid-column: 5;
        }
    }

    .communities {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(250px, 100%), 1fr));
        gap: $sp4;

        .community {
            cursor: pointer;
            background-color: var(--accent);
            height: 300px;
        }
    }
</style>
