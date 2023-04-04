<script lang="ts">
    import LockOutline from "svelte-material-icons/LockOutline.svelte";
    import Checkbox from "../../Checkbox.svelte";
    import type { CandidateGroupChat, GroupGate, OpenChat } from "openchat-client";
    import { _ } from "svelte-i18n";
    import Radio from "../../Radio.svelte";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import Button from "../../Button.svelte";
    import Select from "../../Select.svelte";
    import { iconSize } from "stores/iconSize";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let candidateGroup: CandidateGroupChat;
    export let originalGroup: CandidateGroupChat;
    export let editing: boolean;

    type GateBinding = { index: number; label: string; gate: GroupGate; enabled: boolean };

    let gates: GateBinding[] = [
        {
            index: 0,
            label: $_("group.noAccessGate"),
            gate: { kind: "no_gate" },
            enabled: true,
        },
        {
            index: 1,
            label: $_("group.diamondMember"),
            gate: { kind: "diamond_gate" },
            enabled: true,
        },
        {
            index: 2,
            label: $_("group.sns1Holder"),
            gate: { kind: "sns1_gate" },
            enabled: true,
        },
        {
            index: 3,
            label: $_("group.chatHolder"),
            gate: { kind: "openchat_gate" },
            enabled: true,
        },
        {
            index: 4,
            label: $_("group.nnsHolder"),
            gate: { kind: "nns_gate" },
            enabled: false,
        },
        {
            index: 5,
            label: $_("group.nftHolder"),
            gate: { kind: "nft_gate" },
            enabled: false,
        },
    ];

    let selectedGateIndex = 0;

    onMount(() => {
        selectedGateIndex = gates.findIndex((g) => candidateGroup.gate.kind === g.gate.kind) ?? 0;
    });

    $: isDiamond = client.isDiamond;

    $: canMakePrivate =
        candidateGroup.chatId !== undefined
            ? client.canMakeGroupPrivate(candidateGroup.chatId)
            : true;

    $: console.log("GATE: ", candidateGroup.gate);

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

{#if $isDiamond}
    <div class="section">
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
    </div>
{/if}

<div class="section">
    <Checkbox
        id="history-visible"
        disabled={candidateGroup.isPublic || editing}
        on:change={() => (candidateGroup.historyVisible = !candidateGroup.historyVisible)}
        label={$_("historyVisible")}
        align={"start"}
        checked={candidateGroup.historyVisible}>
        <div class="section-title">{$_("historyVisible")}</div>
        <div class="info">
            {#if candidateGroup.historyVisible}
                <p>{$_("historyOnInfo")}</p>
            {:else}
                <p>{$_("historyOffInfo")}</p>
            {/if}
        </div>
    </Checkbox>
</div>

{#if $isDiamond}
    <div class="wrapper">
        <div class="icon">
            <LockOutline size={$iconSize} color={"var(--icon-txt)"} />
        </div>
        <div class="section">
            <div class="section-title">{$_("group.chooseGate")}</div>
            <Select bind:value={selectedGateIndex}>
                {#each gates as gate}
                    <option disabled={!gate.enabled} value={gate.index}>{gate.label}</option>
                {/each}
            </Select>
            {#if candidateGroup.gate !== undefined}
                {#if candidateGroup.gate.kind === "diamond_gate"}
                    <div class="info">{$_("group.diamondGateInfo")}</div>
                {/if}
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

<style type="text/scss">
    .wrapper {
        display: flex;
        align-items: flex-start;

        .icon {
            flex: 0 0 toRem(34);
        }

        .section-title {
            margin-bottom: $sp3;
        }

        .section {
            flex: auto;
        }
    }
    .section {
        margin-bottom: $sp6;
    }

    .info {
        @include font(book, normal, fs-80, 28);
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
                background-image: url("../assets/unlocked.svg");
            }

            &.private {
                background-image: url("../assets/locked.svg");
            }
        }
    }
</style>
