<script lang="ts">
    const groups = [
        "Group One",
        "Group Two",
        "Group Three",
        "Group Four",
        "Group Five",
        "Group Six",
        "Group Seven",
        "Group Eight",
        "Group Nine",
        "Group Ten",
        "Group Eleven",
        "Group Twelve",
        "Group Thirteen",
        "Group Fourteen",
    ];
</script>

<div class="explore">
    <div class="header">
        <div class="hero">
            <h1>Community Summary</h1>
        </div>
        <div class="details">
            <h1>Details</h1>
        </div>
        <div class="search">
            <p>Search</p>
        </div>
        <div class="sort">
            <p>Sort</p>
        </div>
    </div>

    <div class="groups">
        {#each groups as group}
            <div class="group">
                {group}
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

        .hero,
        .details {
            grid-column: 1 / span 5;
        }

        .search {
            grid-column: 1 / span 4;
        }

        .sort {
            grid-column: 5;
        }

        .hero {
            height: 300px;
        }

        .details {
            height: 200px;
        }
    }

    .groups {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(250px, 100%), 1fr));
        gap: $sp4;

        .group {
            background-color: var(--accent);
            height: 300px;
        }
    }
</style>
