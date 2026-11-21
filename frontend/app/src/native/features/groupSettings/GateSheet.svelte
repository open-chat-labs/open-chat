<!-- Setting up a gate (native plan 11, Access gates): one sheet of one height for its two steps,
     picking the token (a payment or a minimum balance) or the nervous system (a neuron holder),
     with a search, those the gate already names marked Added, then setting its value; a minimum
     CHIT has only the second. Changing an entry opens at its value. The gate is read as the web's
     AccessGates reads it (logic/access/gateValues), and handed back for the draft. The host mounts
     it again each time it opens. -->
<script lang="ts">
    import type {
        ActiveLeafGate,
        CryptocurrencyDetails,
        NervousSystemDetails,
    } from "@client";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import Field from "@openchat/ui/src/lib/components/Field.svelte";
    import TokenAvatar from "@openchat/ui/src/lib/components/TokenAvatar.svelte";
    import BottomSheet from "@openchat/ui/src/native/BottomSheet.svelte";
    import {
        balanceGateOf,
        chitGateOf,
        gateAmountText,
        gateNervousSystems,
        gateTokens,
        neuronGateOf,
        neuronGateText,
        paymentGateOf,
        type GateLookups,
    } from "@src/logic/access/gateValues";
    import { gateLabel } from "@src/utils/access";
    import { untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import { softKeyboard } from "../../aboveKeyboard.svelte";
    import { gateKey, type SetupGateKind } from "./settings.adapter";

    type Props = {
        open: boolean;
        kind: SetupGateKind;
        /** The entry being changed; none for a new one. */
        editing: ActiveLeafGate | undefined;
        /** The entries the gate has (gateKey), whose tokens are marked Added. */
        taken: string[];
        lookups: GateLookups;
        onDone: (gate: ActiveLeafGate) => void;
        onClose: () => void;
    };

    let { open, kind, editing, taken, lookups, onDone, onClose }: Props = $props();

    type Asset = { id: string; symbol: string; name: string; logo: string; key: string };

    const assets = $derived.by((): Asset[] => {
        if (kind === "neuron_gate") {
            return gateNervousSystems(lookups).map((ns: NervousSystemDetails) => ({
                id: ns.governanceCanisterId,
                symbol: ns.token.symbol,
                name: ns.token.name,
                logo: ns.token.logo,
                key: `neuron_gate:${ns.governanceCanisterId}`,
            }));
        }
        return gateTokens(lookups).map((token: CryptocurrencyDetails) => ({
            id: token.ledger,
            symbol: token.symbol,
            name: token.name,
            logo: token.logo,
            key: `${kind}:${token.ledger}`,
        }));
    });

    // the entry's own asset, or none: CHIT has no step to pick one
    function assetOf(gate: ActiveLeafGate | undefined): string | undefined {
        switch (gate?.kind) {
            case "payment_gate":
            case "token_balance_gate":
                return gate.ledgerCanister;
            case "neuron_gate":
                return gate.governanceCanister;
            default:
                return undefined;
        }
    }

    // the values the entry has, as its fields show them
    function initialValues(gate: ActiveLeafGate | undefined): { a: string; b: string } {
        switch (gate?.kind) {
            case "payment_gate":
                return {
                    a: gateAmountText(gate.amount, lookups.tokens.get(gate.ledgerCanister)?.decimals),
                    b: "",
                };
            case "token_balance_gate":
                return {
                    a: gateAmountText(
                        gate.minBalance,
                        lookups.tokens.get(gate.ledgerCanister)?.decimals,
                    ),
                    b: "",
                };
            case "neuron_gate": {
                const { days, stake } = neuronGateText(gate, lookups);
                return { a: days, b: stake };
            }
            case "chit_earned_gate":
                return { a: String(gate.minEarned), b: "" };
            default:
                return { a: "", b: "" };
        }
    }

    const start = untrack(() => initialValues(editing));
    let asset = $state<string | undefined>(untrack(() => assetOf(editing)));
    let a = $state(start.a);
    let b = $state(start.b);
    let query = $state("");

    const picking = $derived(kind !== "chit_earned_gate" && asset === undefined);
    const picked = $derived(assets.find((x) => x.id === asset));
    const ownKey = $derived(editing === undefined ? undefined : gateKey(editing));

    const shown = $derived.by(() => {
        const q = query.trim().toLowerCase();
        return q === ""
            ? assets
            : assets.filter(
                  (x) => x.symbol.toLowerCase().includes(q) || x.name.toLowerCase().includes(q),
              );
    });

    // the gate the fields make, or none while they don't make one
    const gate = $derived.by((): ActiveLeafGate | undefined => {
        switch (kind) {
            case "payment_gate": {
                const token = asset === undefined ? undefined : lookups.tokens.get(asset);
                return token && paymentGateOf(token, a);
            }
            case "token_balance_gate": {
                const token = asset === undefined ? undefined : lookups.tokens.get(asset);
                return token && balanceGateOf(token, a);
            }
            case "neuron_gate": {
                const ns = asset === undefined ? undefined : lookups.nervousSystems.get(asset);
                return ns && neuronGateOf(ns, a, b);
            }
            case "chit_earned_gate":
                return chitGateOf(a);
        }
    });

    function pick(x: Asset) {
        if (taken.includes(x.key) && x.key !== ownKey) return;
        asset = x.id;
        a = "";
        b = "";
    }

    function done() {
        if (gate !== undefined) onDone(gate);
    }

    const valueLabel = $derived(
        kind === "payment_gate"
            ? "native.groupSettings.gates.amount"
            : kind === "token_balance_gate"
              ? "native.groupSettings.gates.minBalance"
              : kind === "neuron_gate"
                ? "native.groupSettings.gates.minDelay"
                : "native.groupSettings.gates.minChit",
    );
</script>

<BottomSheet
    {open}
    {onClose}
    title={$_(gateLabel[kind])}
    height="74%"
    keyboard={softKeyboard.covering}>
    {#if picking}
        <div class="top">
            <span class="step">
                {$_(
                    kind === "neuron_gate"
                        ? "native.groupSettings.gates.pickNervousSystem"
                        : "native.groupSettings.gates.pickToken",
                )}
            </span>
            <Field
                placeholder={$_("native.groupSettings.gates.search")}
                value={query}
                onInput={(e) => (query = e.currentTarget.value)}
                onClear={() => (query = "")}
                showShortcut={false} />
        </div>
        <div class="list">
            {#each shown as x (x.id)}
                {@const added = taken.includes(x.key) && x.key !== ownKey}
                <button
                    type="button"
                    class="row"
                    class:added
                    aria-disabled={added}
                    onclick={() => pick(x)}>
                    <TokenAvatar symbol={x.symbol} logo={x.logo} size={40} />
                    <span class="text">
                        <span class="name">{x.symbol}</span>
                        <span class="sub">{x.name}</span>
                    </span>
                    {#if added}
                        <span class="added-tag">{$_("native.groupSettings.gates.added")}</span>
                    {/if}
                </button>
            {:else}
                <p class="none">{$_("native.groupSettings.gates.noMatches")}</p>
            {/each}
        </div>
    {:else}
        <form
            class="value"
            onsubmit={(e) => {
                e.preventDefault();
                done();
            }}>
            {#if picked !== undefined}
                <button
                    type="button"
                    class="row picked"
                    aria-label={$_("native.groupSettings.gates.changeToken")}
                    onclick={() => (asset = undefined)}>
                    <TokenAvatar symbol={picked.symbol} logo={picked.logo} size={40} />
                    <span class="text">
                        <span class="name">{picked.symbol}</span>
                        <span class="sub">{picked.name}</span>
                    </span>
                    <span class="change">{$_("native.groupSettings.gates.change")}</span>
                </button>
            {/if}
            <label class="field-group">
                <span class="field-label">{$_(valueLabel)}</span>
                <span class="field">
                    <input
                        value={a}
                        oninput={(e) => (a = e.currentTarget.value)}
                        inputmode={kind === "payment_gate" || kind === "token_balance_gate"
                            ? "decimal"
                            : "numeric"}
                        autocomplete="off"
                        placeholder={kind === "neuron_gate"
                            ? $_("native.groupSettings.gates.optional")
                            : "0"} />
                    <span class="unit">
                        {kind === "neuron_gate"
                            ? $_("native.groupSettings.gates.days")
                            : kind === "chit_earned_gate"
                              ? "CHIT"
                              : (picked?.symbol ?? "")}
                    </span>
                </span>
            </label>
            {#if kind === "neuron_gate"}
                <label class="field-group">
                    <span class="field-label">{$_("native.groupSettings.gates.minStake")}</span>
                    <span class="field">
                        <input
                            value={b}
                            oninput={(e) => (b = e.currentTarget.value)}
                            inputmode="decimal"
                            autocomplete="off"
                            placeholder={$_("native.groupSettings.gates.optional")} />
                        <span class="unit">{picked?.symbol ?? ""}</span>
                    </span>
                </label>
            {/if}
            <span class="grow"></span>
            <Button
                label={$_(
                    editing === undefined
                        ? "native.groupSettings.gates.addGate"
                        : "native.groupSettings.gates.update",
                )}
                size="lg"
                fullWidth
                disabled={gate === undefined}
                onClick={done} />
        </form>
    {/if}
</BottomSheet>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .top {
        flex: none;
        display: flex;
        flex-direction: column;
        gap: var(--space-10);
        padding: var(--space-4) var(--space-16) var(--space-10);
    }

    .step {
        padding: 0 var(--space-4);
        font: var(--weight-medium) text-size(13.5px) / 1.35 var(--font-sans);
        color: var(--ink-3);
    }

    .list {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        display: flex;
        flex-direction: column;
        gap: var(--space-6);
        padding: var(--space-4) var(--space-16) var(--space-16);
    }

    .row {
        flex: none;
        display: flex;
        align-items: center;
        gap: var(--space-12);
        min-height: 62px;
        padding: 0 var(--space-12);
        border: 0;
        border-radius: 14px;
        background: var(--overlay-1);
        color: var(--ink);
        text-align: start;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &:active {
            background: var(--overlay-2);
        }

        &:focus-visible {
            @include focus-ring;
        }

        &.added {
            opacity: 0.45;
            cursor: default;
        }
    }

    .text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 3px;
    }

    .name {
        font: var(--weight-semibold) text-size(15px) / 1.2 var(--font-sans);
        @include truncate;
    }

    .sub {
        font: var(--weight-medium) text-size(12.5px) / 1.2 var(--font-sans);
        color: var(--ink-4);
        @include truncate;
    }

    .added-tag,
    .change {
        flex: none;
        font: var(--weight-semibold) text-size(12.5px) / 1 var(--font-sans);
        color: var(--ink-3);
    }

    .change {
        color: var(--accent-bright);
    }

    .none {
        margin: 0;
        padding: var(--space-24) var(--space-12);
        text-align: center;
        font: var(--weight-regular) text-size(14px) / 1.5 var(--font-sans);
        color: var(--ink-4);
    }

    .value {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-16);
        padding: var(--space-4) var(--space-16) var(--space-12);
    }

    .field-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .field-label {
        padding: 0 var(--space-4);
        font: var(--weight-semibold) text-size(12px) / 1.2 var(--font-sans);
        color: var(--ink-4);
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    .field {
        display: flex;
        align-items: center;
        gap: var(--space-8);
        height: 52px;
        padding: 0 var(--space-16);
        border-radius: 14px;
        background: var(--overlay-1);

        &:focus-within {
            box-shadow: inset 0 0 0 1.5px var(--accent);
        }
    }

    input {
        flex: 1;
        min-width: 0;
        height: 100%;
        padding: 0;
        border: 0;
        outline: 0;
        background: transparent;
        color: var(--ink);
        font: var(--weight-semibold) text-size(16px) / 1 var(--font-sans);

        &::placeholder {
            color: var(--ink-4);
        }
    }

    .unit {
        flex: none;
        font: var(--weight-semibold) text-size(14px) / 1 var(--font-sans);
        color: var(--ink-3);
    }

    .grow {
        flex: 1;
    }
</style>
