<script lang="ts">
    import {
        type CandidateGroupChat,
        type CommunitySummary,
        isDiamondStore,
        type OpenChat,
        publish,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Button from "../Button.svelte";
    import Checkbox from "../Checkbox.svelte";
    import Radio from "../Radio.svelte";
    import Translatable from "../Translatable.svelte";
    import DurationPicker from "./DurationPicker.svelte";
    import AccessGateControl from "./access/AccessGateControl.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        candidate: CandidateGroupChat | CommunitySummary;
        editing: boolean;
        history: boolean;
        canEditDisappearingMessages: boolean;
        valid: boolean;
        gateDirty: boolean;
        embeddedContent?: boolean;
    }

    let {
        candidate = $bindable(),
        editing,
        history,
        canEditDisappearingMessages,
        valid = $bindable(),
        gateDirty,
        embeddedContent = false,
    }: Props = $props();

    let disappearingMessages = $state(
        candidate.kind === "candidate_group_chat" && candidate.eventsTTL !== undefined,
    );

    let requiresUpgrade = $derived(!editing && !$isDiamondStore && candidate.level !== "channel");
    let canChangeVisibility = $derived(!editing ? client.canChangeVisibility(candidate) : true);

    function gateUpdated() {
        if (
            gateDirty &&
            candidate.kind === "candidate_group_chat" &&
            candidate.gateConfig.gate.kind !== "no_gate"
        ) {
            candidate.messagesVisibleToNonMembers = false;
        }
    }

    function toggleScope() {
        candidate.public = !candidate.public;
        if (candidate.public) {
            candidate.historyVisible = true;
        }
        if (candidate.kind === "candidate_group_chat") {
            candidate.messagesVisibleToNonMembers =
                candidate.public && candidate.gateConfig.gate.kind === "no_gate";
        }
    }

    function toggleVisibleToNonMembers() {
        if (candidate.kind === "candidate_group_chat") {
            candidate.messagesVisibleToNonMembers = !candidate.messagesVisibleToNonMembers;
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
        onChange={toggleScope}
        checked={!candidate.public}
        id={"private"}
        disabled={!canChangeVisibility}
        align={"start"}
        group={"visibility"}>
        <div class="section-title">
            <div class={"img private"}></div>
            <p>
                <Translatable
                    resourceKey={i18nKey("group.privateGroup", undefined, candidate.level, true)} />
            </p>
        </div>
        <div class="info">
            <p>
                <Translatable
                    resourceKey={i18nKey("privateGroupInfo", undefined, candidate.level, true)} />
            </p>
        </div>
    </Radio>
</div>

<div class="section">
    <Radio
        onChange={toggleScope}
        checked={candidate.public}
        id={"public"}
        disabled={!canChangeVisibility || requiresUpgrade}
        align={"start"}
        group={"visibility"}>
        <div class="section-title">
            <div class={"img public"}></div>
            <p>
                <Translatable
                    resourceKey={i18nKey("group.publicGroup", undefined, candidate.level, true)} />
            </p>
        </div>
        <div class="info">
            <p>
                <Translatable
                    resourceKey={i18nKey("publicGroupUnique", undefined, candidate.level, true)} />
            </p>
            <p>
                <Translatable
                    resourceKey={candidate.level === "channel"
                        ? i18nKey("publicChannelInfo")
                        : i18nKey("publicGroupInfo", undefined, candidate.level, true)} />
            </p>
        </div>
    </Radio>
</div>

{#if history && !embeddedContent}
    <div class="section">
        <Checkbox
            id="history-visible"
            disabled={candidate.public || editing}
            onChange={() => (candidate.historyVisible = !candidate.historyVisible)}
            label={i18nKey("historyVisible")}
            align={"start"}
            checked={candidate.historyVisible}>
            <div class="section-title">
                <Translatable resourceKey={i18nKey("historyVisible")} />
            </div>
            <div class="info">
                {#if candidate.historyVisible}
                    <p><Translatable resourceKey={i18nKey("historyOnInfo")} /></p>
                {:else}
                    <p><Translatable resourceKey={i18nKey("historyOffInfo")} /></p>
                {/if}
            </div>
        </Checkbox>
    </div>
{/if}

{#if candidate.kind === "candidate_group_chat" && !embeddedContent}
    <div class="section">
        <Checkbox
            id="disappearing-messages"
            disabled={!canEditDisappearingMessages}
            onChange={toggleDisappearingMessages}
            label={i18nKey("disappearingMessages.label")}
            align={"start"}
            checked={disappearingMessages}>
            <div class="section-title disappear">
                <Translatable resourceKey={i18nKey("disappearingMessages.label")} />
            </div>
            <div class="info">
                {#if disappearingMessages}
                    <DurationPicker
                        disabled={!canEditDisappearingMessages}
                        bind:milliseconds={candidate.eventsTTL} />
                {/if}
            </div>
        </Checkbox>
    </div>
{/if}

{#if candidate.public && candidate.kind === "candidate_group_chat"}
    <div class="section">
        <Checkbox
            id="visible_to_non_members"
            onChange={toggleVisibleToNonMembers}
            label={i18nKey("access.messagesVisibleToNonMembers")}
            align={"start"}
            checked={candidate.messagesVisibleToNonMembers}>
            <div class="section-title disappear">
                <Translatable resourceKey={i18nKey("access.messagesVisibleToNonMembers")} />
            </div>
        </Checkbox>
    </div>
{/if}

{#if !requiresUpgrade}
    <AccessGateControl
        onUpdated={gateUpdated}
        bind:gateConfig={candidate.gateConfig}
        level={candidate.level}
        bind:valid />
{/if}

{#if requiresUpgrade}
    <div class="section">
        <div class="section-title">
            <Translatable resourceKey={i18nKey("upgrade.featuresTitle")} />
        </div>
        <div class="upgrade info">
            <p><Translatable resourceKey={i18nKey("upgrade.groupMsg")} /></p>
            <Button onClick={() => publish("upgrade")} tiny
                ><Translatable resourceKey={i18nKey("upgrade.button")} /></Button>
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
