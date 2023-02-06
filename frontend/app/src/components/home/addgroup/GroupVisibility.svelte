<script lang="ts">
    import Checkbox from "../../Checkbox.svelte";
    import type { CandidateGroupChat, OpenChat } from "openchat-client";
    import { _ } from "svelte-i18n";
    import Radio from "../../Radio.svelte";
    import { createEventDispatcher, getContext } from "svelte";
    import Button from "../../Button.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let candidateGroup: CandidateGroupChat;
    export let originalGroup: CandidateGroupChat;
    export let editing: boolean;

    let diamond = client.currentUserIsDiamond();

    $: canMakePrivate =
        candidateGroup.chatId !== undefined
            ? client.canMakeGroupPrivate(candidateGroup.chatId)
            : true;

    function toggleScope() {
        candidateGroup.isPublic = !candidateGroup.isPublic;
        if (candidateGroup.isPublic) {
            candidateGroup.historyVisible = true;
            candidateGroup.members = [];
        }
    }
</script>

<div class="section">
    <Radio
        on:change={toggleScope}
        checked={!candidateGroup.isPublic}
        id={"private"}
        disabled={!canMakePrivate}
        align={"start"}
        group={"group-visibility"}>
        <div class="section-title">
            <div class={"img private"} />
            <p>{$_("group.privateGroup")}</p>
        </div>
        <div class="info">
            <p>{$_("privateGroupInfo")}</p>
        </div>
    </Radio>
</div>

<div class="section">
    {#if !diamond}
        <div class="upgrade info">
            <p>
                {$_("upgrade.groupMsg")}
            </p>
            <Button on:click={() => dispatch("upgrade")} tiny>{$_("upgrade.button")}</Button>
        </div>
    {:else}
        <Radio
            on:change={toggleScope}
            checked={candidateGroup.isPublic}
            id={"public"}
            align={"start"}
            disabled={editing && !originalGroup.isPublic}
            group={"group-visibility"}>
            <div class="section-title">
                <div class={"img public"} />
                <p>{$_("group.publicGroup")}</p>
            </div>
            <div class="info">
                <p>{$_("publicGroupInfo")}</p>
                <p>{$_("publicGroupUnique")}</p>
            </div>
        </Radio>
    {/if}
</div>

<div class="section">
    <Checkbox
        id="history-visible"
        disabled={candidateGroup.isPublic || editing}
        on:change={() => (candidateGroup.historyVisible = !candidateGroup.historyVisible)}
        label={$_("historyVisible")}
        align={"start"}
        checked={candidateGroup.historyVisible}>
        <div class="section-title">History visible</div>
        <div class="info">
            {#if candidateGroup.historyVisible}
                <p>{$_("historyOnInfo")}</p>
            {:else}
                <p>{$_("historyOffInfo")}</p>
            {/if}
        </div>
    </Checkbox>
</div>

<style type="text/scss">
    .section {
        padding: $sp4 0;
        margin-bottom: $sp3;
    }

    .info {
        @include font(book, normal, fs-80, 28);
        color: var(--txt-light);

        &.upgrade {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            margin-left: 34px;
            gap: $sp3;
            flex-direction: column;
        }
    }

    .section-title {
        display: flex;
        gap: $sp3;
        align-items: center;

        .img {
            background-repeat: no-repeat;
            $size: $sp4;
            flex: 0 0 $size;
            width: $size;
            height: $size;

            &.public {
                background-image: url("../assets/unlocked.svg");
            }

            &.private {
                background-image: url("../assets/locked.svg");
            }
        }
    }
</style>
