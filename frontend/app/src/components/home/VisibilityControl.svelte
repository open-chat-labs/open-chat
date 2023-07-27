<script lang="ts">
    import { interpolateLevel } from "../../utils/i18n";
    import LockOutline from "svelte-material-icons/LockOutline.svelte";
    import Checkbox from "../Checkbox.svelte";
    import {
        E8S_PER_TOKEN,
        AccessControlled,
        OpenChat,
        Permissioned,
        HasLevel,
        HasMembershipRole,
        isSnsGate,
    } from "openchat-client";
    import { _ } from "svelte-i18n";
    import Radio from "../Radio.svelte";
    import { afterUpdate, createEventDispatcher, getContext, onMount } from "svelte";
    import Button from "../Button.svelte";
    import Select from "../Select.svelte";
    import { iconSize } from "stores/iconSize";
    import Legend from "../Legend.svelte";
    import Input from "../Input.svelte";
    import { gateBindings, snsGateBindings } from "../../utils/access";
    import { fade } from "svelte/transition";

    type T = $$Generic;

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let candidate: AccessControlled &
        HasLevel &
        Permissioned<T> &
        HasMembershipRole & { isDefault?: boolean };
    export let original: AccessControlled;
    export let editing: boolean;
    export let history: boolean;

    let minDissolveDelay = client.getMinDissolveDelayDays(original.gate);
    let minStake = client.getMinStakeInTokens(original.gate);

    $: invalidDissolveDelay = minDissolveDelay !== undefined && isNaN(minDissolveDelay);
    $: invalidMinStake = minStake !== undefined && isNaN(minStake);

    let selectedGateIndex = 0;

    onMount(() => {
        selectedGateIndex = gateBindings.findIndex((g) => candidate.gate.kind === g.gate.kind) ?? 0;
    });

    afterUpdate(() => {
        if (isSnsGate(candidate.gate)) {
            candidate = {
                ...candidate,
                gate: {
                    ...candidate.gate,
                    minDissolveDelay: !invalidDissolveDelay
                        ? Number(minDissolveDelay) * 24 * 60 * 60 * 1000
                        : undefined,
                    minStakeE8s: !invalidMinStake ? Number(minStake) * E8S_PER_TOKEN : undefined,
                },
            };
        }
    });

    $: isDiamond = client.isDiamond;

    $: canMakePrivate = !editing ? client.canMakePrivate(candidate) : true;

    function toggleScope() {
        candidate.public = !candidate.public;
        if (candidate.public) {
            candidate.historyVisible = true;
        } else {
            candidate.isDefault = false;
        }
    }

    function updateGate() {
        candidate.gate = gateBindings[selectedGateIndex]?.gate;
        minDissolveDelay = undefined;
        minStake = undefined;
    }
</script>

<div class="section">
    <Radio
        on:change={toggleScope}
        checked={!candidate.public}
        id={"private"}
        disabled={!canMakePrivate}
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

{#if $isDiamond}
    <div class="section">
        <Radio
            on:change={toggleScope}
            checked={candidate.public}
            id={"public"}
            align={"start"}
            disabled={editing && !original.public}
            group={"visibility"}>
            <div class="section-title">
                <div class={"img public"} />
                <p>{interpolateLevel("group.publicGroup", candidate.level, true)}</p>
            </div>
            <div class="info">
                {#if editing && !original.public}
                    <p>{interpolateLevel("access.cannotMakePublic", candidate.level, true)}</p>
                {:else}
                    <p>{interpolateLevel("publicGroupInfo", candidate.level, true)}</p>
                    <p>{interpolateLevel("publicGroupUnique", candidate.level, true)}</p>
                {/if}
            </div>
        </Radio>
    </div>
{/if}

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

{#if !editing && candidate.level === "channel" && candidate.public}
    <section transition:fade|local={{ duration: 250 }} class="section">
        <Checkbox
            id={`default_channel`}
            label={$_("communities.defaultChannel")}
            align={"start"}
            bind:checked={candidate.isDefault}>
            <div class="section-title">{$_("communities.defaultChannel")}</div>
            <p class="info">{$_("communities.defaultInfo")}</p>
        </Checkbox>
    </section>
{/if}

{#if $isDiamond && candidate.public}
    <div transition:fade|local={{ duration: 250 }} class="wrapper">
        <div class="icon">
            <LockOutline size={$iconSize} color={"var(--icon-txt)"} />
        </div>
        <div class="section">
            <div class="section-title">{$_("access.chooseGate")}</div>
            <div class="choose-gate">
                <Select margin={false} on:change={updateGate} bind:value={selectedGateIndex}>
                    {#each gateBindings as gate}
                        <option disabled={!gate.enabled} value={gate.index}
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
                        values: snsGateBindings[candidate.gate.kind].labelParams,
                    })}
                </div>
            {:else if candidate.gate.kind === "no_gate"}
                <div class="info">{$_("access.openAccessInfo")}</div>
            {/if}
        </div>
    </div>
{/if}

{#if !$isDiamond}
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
