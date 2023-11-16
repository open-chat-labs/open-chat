<script lang="ts">
    import CredentialSelector from "./CredentialSelector.svelte";
    import { interpolateLevel } from "../../utils/i18n";
    import LockOutline from "svelte-material-icons/LockOutline.svelte";
    import Checkbox from "../Checkbox.svelte";
    import {
        type OpenChat,
        isSnsGate,
        type InterpolationValues,
        type SNSAccessGate,
        type CandidateGroupChat,
        type CommunitySummary,
    } from "openchat-client";
    import { _ } from "svelte-i18n";
    import Radio from "../Radio.svelte";
    import { afterUpdate, createEventDispatcher, getContext, onMount } from "svelte";
    import Button from "../Button.svelte";
    import Select from "../Select.svelte";
    import { iconSize } from "../../stores/iconSize";
    import Legend from "../Legend.svelte";
    import Input from "../Input.svelte";
    import { getGateBindings, type GateBinding } from "../../utils/access";
    import { fade } from "svelte/transition";
    import DisappearingMessages from "./DisappearingMessages.svelte";

    type T = $$Generic;

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let candidate: CandidateGroupChat | CommunitySummary;
    export let original: CandidateGroupChat | CommunitySummary;
    export let editing: boolean;
    export let history: boolean;
    export let canEditDisappearingMessages: boolean;

    let minDissolveDelay = client.getMinDissolveDelayDays(original.gate) ?? "";
    let minStake = client.getMinStakeInTokens(original.gate) ?? "";
    let gateBindings: GateBinding[] = [];
    let selectedGateKey: string | undefined = undefined;
    let disappearingMessages =
        candidate.kind === "candidate_group_chat" && candidate.eventsTTL !== undefined;

    $: invalidDissolveDelay = minDissolveDelay !== "" && isNaN(Number(minDissolveDelay));
    $: invalidMinStake = minStake !== "" && isNaN(Number(minStake));
    $: nervousSystemLookup = client.nervousSystemLookup;
    $: isDiamond = client.isDiamond;
    $: requiresUpgrade = !editing && !$isDiamond && candidate.level !== "channel";
    $: canChangeVisibility = !editing ? client.canChangeVisibility(candidate) : true;

    onMount(() => {
        gateBindings = getGateBindings($nervousSystemLookup);
        selectedGateKey = gateBindings.find((g) => {
            return candidate.gate.kind === "sns_gate"
                ? candidate.gate.governanceCanister === g.key
                : candidate.gate.kind === g.gate.kind;
        })?.key;
    });

    afterUpdate(() => {
        if (isSnsGate(candidate.gate)) {
            candidate = {
                ...candidate,
                gate: {
                    ...candidate.gate,
                    minDissolveDelay:
                        minDissolveDelay !== "" && !invalidDissolveDelay
                            ? Number(minDissolveDelay) * 24 * 60 * 60 * 1000
                            : undefined,
                    minStakeE8s:
                        minStake !== "" && !invalidMinStake
                            ? Number(minStake) * Math.pow(10, client.getTokenDetailsForSnsAccessGate(candidate.gate)?.decimals ?? 8)
                            : undefined,
                },
            };
        }
    });

    function toggleScope() {
        candidate.public = !candidate.public;
        if (candidate.public) {
            candidate.historyVisible = true;
        }
    }

    function updateGate() {
        candidate.gate = gateBindings.find((g) => g.key === selectedGateKey)?.gate ?? {
            kind: "no_gate",
        };
        minDissolveDelay = "";
        minStake = "";
    }

    function snsHolderParams(gate: SNSAccessGate): InterpolationValues {
        const tokenDetails = client.getTokenDetailsForSnsAccessGate(gate);
        return tokenDetails ? { token: tokenDetails.symbol } : undefined;
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
    <div transition:fade|local={{ duration: 250 }} class="wrapper">
        <div class="icon">
            <LockOutline size={$iconSize} color={"var(--icon-txt)"} />
        </div>
        <div class="section">
            <div class="section-title">{$_("access.chooseGate")}</div>
            <div class="choose-gate">
                <Select margin={false} on:change={updateGate} bind:value={selectedGateKey}>
                    {#each gateBindings as gate}
                        <option disabled={!gate.enabled} value={gate.key}
                            >{$_(gate.label, { values: gate.labelParams })}</option>
                    {/each}
                </Select>
            </div>
            {#if isSnsGate(candidate.gate)}
                <Legend label={$_("access.minDissolveDelay")} />
                <Input
                    maxlength={100}
                    placeholder={$_("access.optional")}
                    invalid={invalidDissolveDelay}
                    bind:value={minDissolveDelay} />

                <Legend label={$_("access.minStake")} />
                <Input
                    maxlength={100}
                    placeholder={$_("access.optional")}
                    invalid={invalidMinStake}
                    bind:value={minStake} />
            {/if}
            {#if candidate.gate.kind === "diamond_gate"}
                <div class="info">{$_("access.diamondGateInfo")}</div>
            {:else if isSnsGate(candidate.gate)}
                <div class="info">
                    {$_("access.snsHolderInfo", {
                        values: snsHolderParams(candidate.gate),
                    })}
                </div>
            {:else if candidate.gate.kind === "no_gate"}
                <div class="info">{$_("access.openAccessInfo")}</div>
            {/if}
            {#if candidate.gate.kind === "credential_gate"}
                <CredentialSelector bind:gate={candidate.gate} />
            {/if}
        </div>
    </div>
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
    .wrapper {
        display: flex;
        align-items: flex-start;
        max-width: 85%;

        .icon {
            flex: 0 0 toRem(34);
        }

        .section-title {
            margin-bottom: $sp3;
        }

        .section {
            flex: auto;
        }

        @include mobile() {
            max-width: unset;
        }
    }

    .section {
        margin-bottom: $sp6;
    }

    .choose-gate {
        margin-bottom: $sp3;
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
