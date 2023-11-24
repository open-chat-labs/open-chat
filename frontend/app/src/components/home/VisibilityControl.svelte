<script lang="ts">
    import { interpolateLevel } from "../../utils/i18n";
    import Checkbox from "../Checkbox.svelte";
    import { type OpenChat, type CandidateGroupChat, type CommunitySummary } from "openchat-client";
    import { _ } from "svelte-i18n";
    import Radio from "../Radio.svelte";
    import { createEventDispatcher, getContext } from "svelte";
    import Button from "../Button.svelte";
    import DisappearingMessages from "./DisappearingMessages.svelte";
    import AccessGateControl from "./AccessGateControl.svelte";

    type T = $$Generic;

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let candidate: CandidateGroupChat | CommunitySummary;
    export let original: CandidateGroupChat | CommunitySummary;
    export let editing: boolean;
    export let history: boolean;
    export let canEditDisappearingMessages: boolean;
    export let valid: boolean;

    let disappearingMessages =
        candidate.kind === "candidate_group_chat" && candidate.eventsTTL !== undefined;

    $: isDiamond = client.isDiamond;
    $: requiresUpgrade = !editing && !$isDiamond && candidate.level !== "channel";
    $: canChangeVisibility = !editing ? client.canChangeVisibility(candidate) : true;

    function toggleScope() {
        candidate.public = !candidate.public;
        if (candidate.public) {
            candidate.historyVisible = true;
        }
    }

    function toggleDisappearingMessages() {
        if (candidate.kind === "community") return;
        disappearingMessages = !disappearingMessages;
        candidate.eventsTTL = disappearingMessages ? BigInt(1000 * 60 * 60) : undefined;
    }
</script>

<div class="section">
    <Radio
        on:change={toggleScope}
        checked={!candidate.public}
        id={"private"}
        disabled={!canChangeVisibility}
        align={"start"}
        group={"visibility"}>
        <div class="section-title">
            <div class={"img private"} />
            <p>{interpolateLevel("group.privateGroup", candidate.level, true)}</p>
        </div>
        <div class="info">
            <p>{interpolateLevel("privateGroupInfo", candidate.level, true)}</p>
        </div>
    </Radio>
</div>

<div class="section">
    <Radio
        on:change={toggleScope}
        checked={candidate.public}
        id={"public"}
        disabled={!canChangeVisibility || requiresUpgrade}
        align={"start"}
        group={"visibility"}>
        <div class="section-title">
            <div class={"img public"} />
            <p>{interpolateLevel("group.publicGroup", candidate.level, true)}</p>
        </div>
        <div class="info">
            <p>{interpolateLevel("publicGroupUnique", candidate.level, true)}</p>
            <p>
                {candidate.level === "channel"
                    ? $_("publicChannelInfo")
                    : interpolateLevel("publicGroupInfo", candidate.level, true)}
            </p>
        </div>
    </Radio>
</div>

{#if history}
    <div class="section">
        <Checkbox
            id="history-visible"
            disabled={candidate.public || editing}
            on:change={() => (candidate.historyVisible = !candidate.historyVisible)}
            label={$_("historyVisible")}
            align={"start"}
            checked={candidate.historyVisible}>
            <div class="section-title">{$_("historyVisible")}</div>
            <div class="info">
                {#if candidate.historyVisible}
                    <p>{$_("historyOnInfo")}</p>
                {:else}
                    <p>{$_("historyOffInfo")}</p>
                {/if}
            </div>
        </Checkbox>
    </div>
{/if}

{#if candidate.kind === "candidate_group_chat"}
    <div class="section">
        <Checkbox
            id="disappearing-messages"
            disabled={!canEditDisappearingMessages}
            on:change={toggleDisappearingMessages}
            label={$_("disappearingMessages.label")}
            align={"start"}
            checked={disappearingMessages}>
            <div class="section-title disappear">{$_("disappearingMessages.label")}</div>
            <div class="info">
                {#if disappearingMessages}
                    <DisappearingMessages
                        {canEditDisappearingMessages}
                        bind:ttl={candidate.eventsTTL} />
                {/if}
            </div>
        </Checkbox>
    </div>
{/if}

{#if !requiresUpgrade}
    <AccessGateControl {original} bind:candidate bind:valid />
{/if}

{#if requiresUpgrade}
    <div class="section">
        <div class="section-title">{$_("upgrade.featuresTitle")}</div>
        <div class="upgrade info">
            <p>
                {$_("upgrade.groupMsg")}
            </p>
            <Button on:click={() => dispatch("upgrade")} tiny>{$_("upgrade.button")}</Button>
        </div>
    </div>
{/if}

<style lang="scss">
    .section {
        margin-bottom: $sp6;
    }

    .info {
        @include font(book, normal, fs-80, 22);
        color: var(--txt-light);

        &.upgrade {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: $sp3;
            flex-direction: column;
        }
    }

    .section-title {
        display: flex;
        gap: $sp3;
        align-items: center;

        &.disappear {
            margin-bottom: $sp2;
        }

        .img {
            background-repeat: no-repeat;
            $size: $sp4;
            flex: 0 0 $size;
            width: $size;
            height: $size;

            &.public {
                background-image: url("/assets/unlocked.svg");
            }

            &.private {
                background-image: url("/assets/locked.svg");
            }
        }
    }
</style>
