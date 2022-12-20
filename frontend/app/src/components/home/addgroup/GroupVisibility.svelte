<script lang="ts">
    import Checkbox from "../../Checkbox.svelte";
    import type { CandidateGroupChat } from "openchat-client";
    import { _ } from "svelte-i18n";

    export let candidateGroup: CandidateGroupChat;

    function toggleScope() {
        candidateGroup.isPublic = !candidateGroup.isPublic;
        if (candidateGroup.isPublic) {
            candidateGroup.historyVisible = true;
        }
    }
</script>

<div class="section">
    <div class="scope">
        <span
            class="scope-label"
            class:selected={!candidateGroup.isPublic}
            on:click={() => (candidateGroup.isPublic = false)}>{$_("group.private")}</span>

        <Checkbox
            id="is-public"
            toggle
            on:change={toggleScope}
            label={$_("group.public")}
            checked={candidateGroup.isPublic} />

        <span
            class="scope-label"
            class:selected={candidateGroup.isPublic}
            on:click={() => (candidateGroup.isPublic = true)}>{$_("group.public")}</span>
    </div>
    <div class="info">
        {#if candidateGroup.isPublic}
            <p>{$_("publicGroupInfo")}</p>
            <p>{$_("publicGroupUnique")}</p>
        {:else}
            <p>{$_("privateGroupInfo")}</p>
        {/if}
    </div>
</div>
<div class="section">
    <div class="history">
        <Checkbox
            id="history-visible"
            disabled={candidateGroup.isPublic}
            on:change={() => (candidateGroup.historyVisible = !candidateGroup.historyVisible)}
            label={$_("historyVisible")}
            checked={candidateGroup.historyVisible} />
    </div>
    <div class="info">
        {#if candidateGroup.historyVisible}
            <p>{$_("historyOnInfo")}</p>
        {:else}
            <p>{$_("historyOffInfo")}</p>
        {/if}
    </div>
</div>

<style type="text/scss">
    .section {
        padding: $sp4 0;
        margin-bottom: $sp3;
    }

    .scope {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: $sp4;
    }

    .scope-label {
        @include font(book, normal, fs-140);
        cursor: pointer;
        border-bottom: 3px solid transparent;

        &.selected {
            border-bottom: 3px solid var(--button-bg);
        }
    }

    .info {
        @include font(light, normal, fs-90);

        p {
            margin-bottom: $sp4;
            &:last-child {
                margin-bottom: 0;
            }
        }
    }

    .history {
        margin-bottom: $sp4;
    }
</style>
