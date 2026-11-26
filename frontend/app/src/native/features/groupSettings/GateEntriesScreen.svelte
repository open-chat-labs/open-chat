<!-- A payment, minimum balance or neuron gate's entries (native plan 11, Access gates; the design's
     screens), pushed from the Access gates page without a URL, on the page's draft (gatesEditor):
     - list: what the gate is, its tokens (or nervous systems), each with its value (tap to change
       it, × to take it out, with Undo), Add a token / Add a nervous system (Diamond's), and Remove
       gate (with Undo) while it has any;
     - pick: a search and the tokens (or nervous systems) the gate doesn't have yet;
     - value: the picked one (Change goes back to the pick), the price or minimum with what it's
       worth, a neuron's stake and dissolve delay, and Add / Save, which lands back on the list.
     What's changed here is the draft's, saved with the page's Save. -->
<script lang="ts">
    import {
        cryptoLookup,
        exchangeRatesLookupStore,
        isDiamondStore,
        nervousSystemLookup,
        type ActiveLeafGate,
        type CryptocurrencyDetails,
        type NervousSystemDetails,
    } from "@client";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import Field from "@openchat/ui/src/lib/components/Field.svelte";
    import ListSectionLabel from "@openchat/ui/src/lib/components/ListSectionLabel.svelte";
    import TokenAvatar from "@openchat/ui/src/lib/components/TokenAvatar.svelte";
    import NativePageHeader from "@openchat/ui/src/native/NativePageHeader.svelte";
    import { assetOf } from "@src/logic/access/gateEntryDraft.svelte";
    import {
        balanceGateOf,
        DAY_MS,
        gateAmountText,
        gateNervousSystems,
        gateTokens,
        neuronGateOf,
        neuronGateText,
        parseGateAmount,
        paymentGateOf,
    } from "@src/logic/access/gateValues";
    import { gateLabel } from "@src/utils/access";
    import { onDestroy, untrack } from "svelte";
    import { _, locale } from "svelte-i18n";
    import { aboveKeyboard, softKeyboard } from "../../aboveKeyboard.svelte";
    import type { NativeScreen } from "../../router/locations";
    import type { ScreenProps } from "../app/screens";
    import { gatesEditor, takeOffGates } from "./gatesEditor.svelte";
    import {
        dissolveOptions,
        gateEntryValue,
        gateKey,
        shownGates,
        type Translate,
    } from "./settings.adapter";

    let { screen, context }: ScreenProps<Extract<NativeScreen, { kind: "gate_entries" }>> =
        $props();

    const t: Translate = (key, values) => $_(key, { values });
    // the gates page's, open under this screen
    const held = gatesEditor();
    const kind = untrack(() => screen.gate);
    const step = untrack(() => screen.step);
    const neuron = kind === "neuron_gate";
    const lookups = $derived({ tokens: $cryptoLookup, nervousSystems: $nervousSystemLookup });

    type Asset = { id: string; symbol: string; name: string; sub: string; logo: string };

    function nsAsset(ns: NervousSystemDetails): Asset {
        return {
            id: ns.governanceCanisterId,
            symbol: ns.token.symbol,
            name: ns.token.name,
            sub: $_("native.groupSettings.gates.neuronsOf", {
                values: { symbol: ns.token.symbol },
            }),
            logo: ns.token.logo,
        };
    }

    function tokenAsset(token: CryptocurrencyDetails): Asset {
        return {
            id: token.ledger,
            symbol: token.symbol,
            name: token.symbol,
            sub: token.name,
            logo: token.logo,
        };
    }

    const assets = $derived(
        neuron ? gateNervousSystems(lookups).map(nsAsset) : gateTokens(lookups).map(tokenAsset),
    );

    // an entry's token or nervous system as the rows show it, known or not
    function assetFor(id: string): Asset {
        const known = assets.find((x) => x.id === id);
        if (known !== undefined) return known;
        const ns = lookups.nervousSystems.get(id);
        if (neuron && ns !== undefined) return nsAsset(ns);
        const token = lookups.tokens.get(id);
        if (token !== undefined) return tokenAsset(token);
        return { id, symbol: id, name: id, sub: "", logo: "" };
    }

    const entries = $derived(
        held === undefined ? [] : shownGates(held.editor.gateConfig).filter((g) => g.kind === kind),
    );

    const title = $derived(
        step === "pick"
            ? $_(
                  neuron
                      ? "native.groupSettings.gates.chooseNervousSystem"
                      : "native.groupSettings.gates.chooseToken",
              )
            : $_(gateLabel[kind]),
    );

    const helpKey = $derived(
        kind === "payment_gate"
            ? "native.groupSettings.gates.help.payment"
            : kind === "token_balance_gate"
              ? "native.groupSettings.gates.help.balance"
              : "native.groupSettings.gates.help.neuron",
    );

    // ---- the list

    let removeUndo: (() => void) | undefined;
    onDestroy(() => removeUndo?.());

    function edit(gate: ActiveLeafGate) {
        held?.entry.startEdit(gate);
        context.push({ kind: "gate_entries", gate: kind, step: "value" });
    }

    function add() {
        held?.entry.startNew();
        context.push({ kind: "gate_entries", gate: kind, step: "pick" });
    }

    function removeEntry(gate: ActiveLeafGate) {
        if (held === undefined) return;
        const name = assetFor(assetOf(gate) ?? "").name;
        removeUndo = takeOffGates(held.editor, [gate], (undo) =>
            context.toast(
                $_("native.groupSettings.gates.removed", { values: { gate: name } }),
                undo,
            ),
        );
    }

    function removeGate() {
        if (held === undefined) return;
        // its Undo outlasts this screen: the draft it changes is the page's, under it
        takeOffGates(held.editor, entries, (undo) =>
            context.toast(
                $_("native.groupSettings.gates.removed", { values: { gate: $_(gateLabel[kind]) } }),
                undo,
            ),
        );
        context.back?.();
    }

    // ---- the pick

    let query = $state("");
    const taken = $derived.by(() => {
        const own = held?.entry.editing;
        return entries
            .filter((g) => own === undefined || gateKey(g) !== gateKey(own))
            .map((g) => assetOf(g))
            .filter((id): id is string => id !== undefined);
    });
    const choices = $derived.by(() => {
        const q = query.trim().toLowerCase();
        return assets.filter(
            (x) =>
                !taken.includes(x.id) &&
                (q === "" ||
                    x.symbol.toLowerCase().includes(q) ||
                    x.name.toLowerCase().includes(q) ||
                    x.sub.toLowerCase().includes(q)),
        );
    });

    function pick(x: Asset) {
        if (held === undefined) return;
        held.entry.asset = x.id;
        // back to the value it's for when there is one under this (Change), else on to a new one
        context.push({ kind: "gate_entries", gate: kind, step: "value" });
    }

    // ---- the value

    const asset = $derived(held?.entry.asset);
    const picked = $derived(asset === undefined ? undefined : assetFor(asset));

    // the entry's own values, when it's being changed and still on its token
    function initial(): { amount: string; days: number } {
        const editing = held?.entry.editing;
        if (editing === undefined || assetOf(editing) !== held?.entry.asset) {
            return { amount: "", days: 0 };
        }
        switch (editing.kind) {
            case "payment_gate":
                return {
                    amount: gateAmountText(
                        editing.amount,
                        lookups.tokens.get(editing.ledgerCanister)?.decimals,
                    ),
                    days: 0,
                };
            case "token_balance_gate":
                return {
                    amount: gateAmountText(
                        editing.minBalance,
                        lookups.tokens.get(editing.ledgerCanister)?.decimals,
                    ),
                    days: 0,
                };
            case "neuron_gate":
                return {
                    amount: neuronGateText(editing, lookups).stake,
                    days: editing.minDissolveDelay
                        ? Math.round(editing.minDissolveDelay / DAY_MS)
                        : 0,
                };
            default:
                return { amount: "", days: 0 };
        }
    }

    const start = untrack(() => initial());
    let amount = $state(start.amount);
    let days = $state(start.days);

    // the entry the fields make, or none while they don't make one
    const made = $derived.by((): ActiveLeafGate | undefined => {
        if (asset === undefined) return undefined;
        switch (kind) {
            case "payment_gate": {
                const token = lookups.tokens.get(asset);
                return token && paymentGateOf(token, amount);
            }
            case "token_balance_gate": {
                const token = lookups.tokens.get(asset);
                return token && balanceGateOf(token, amount);
            }
            case "neuron_gate": {
                const ns = lookups.nervousSystems.get(asset);
                return ns && neuronGateOf(ns, String(days), amount);
            }
        }
    });

    // what the amount is worth, for a token with a price
    const worth = $derived.by(() => {
        if (neuron || asset === undefined) return "";
        const token = lookups.tokens.get(asset);
        const rate = $exchangeRatesLookupStore.get(asset)?.toUSD;
        const units = token === undefined ? undefined : parseGateAmount(amount, token.decimals);
        if (token === undefined || rate === undefined || units === undefined || units === 0n) {
            return "";
        }
        const usd = (Number(units) / 10 ** token.decimals) * rate;
        return $_("native.groupSettings.gates.worth", {
            values: {
                value: usd.toLocaleString($locale ?? "en", { style: "currency", currency: "USD" }),
            },
        });
    });

    const delays = $derived(dissolveOptions(days, t));
    const changing = $derived(held?.entry.editing !== undefined);

    const amountLabel = $derived(
        kind === "payment_gate"
            ? "native.groupSettings.gates.price"
            : kind === "token_balance_gate"
              ? "native.groupSettings.gates.minBalance"
              : "native.groupSettings.gates.minStake",
    );

    function save() {
        if (held === undefined || made === undefined) return;
        const editing = held.entry.editing;
        if (editing === undefined) held.editor.addLeaf(made);
        else held.editor.replaceGate(editing, made);
        const name = picked?.name ?? "";
        held.entry.startNew();
        // back to the list, which is under this
        context.push({ kind: "gate_entries", gate: kind, step: "list" });
        if (editing === undefined) {
            context.toast($_("native.groupSettings.gates.entryAdded", { values: { name } }));
        }
    }
</script>

<div class="gate-entries">
    <NativePageHeader {title} onBack={context.back} />

    {#if held === undefined}
        <!-- the gates page isn't open under this (a cold start): Back stays -->
    {:else if step === "list"}
        <div class="body">
            <p class="help">{$_(helpKey)}</p>
            <div class="section">
                <ListSectionLabel
                    label={$_(
                        neuron
                            ? "native.groupSettings.gates.nervousSystems"
                            : "native.groupSettings.gates.tokens",
                    )}
                />
                <div class="card">
                    {#each entries as gate (gateKey(gate))}
                        {@const a = assetFor(assetOf(gate) ?? "")}
                        <div class="entry">
                            <button
                                type="button"
                                class="entry-main"
                                disabled={held.editor.busy}
                                onclick={() => edit(gate)}
                            >
                                <TokenAvatar symbol={a.symbol} logo={a.logo} size={40} />
                                <span class="text">
                                    <span class="name">{a.name}</span>
                                    <span class="value-line">
                                        {gateEntryValue(gate, lookups, t, $locale ?? "en")}
                                    </span>
                                </span>
                            </button>
                            <button
                                type="button"
                                class="entry-remove"
                                disabled={held.editor.busy}
                                aria-label={$_("native.groupSettings.gates.remove", {
                                    values: { gate: a.name },
                                })}
                                onclick={() => removeEntry(gate)}
                            >
                                <span class="remove-icon"></span>
                            </button>
                        </div>
                    {:else}
                        <p class="empty">
                            {$_(
                                neuron
                                    ? "native.groupSettings.gates.noNervousSystems"
                                    : "native.groupSettings.gates.noTokens",
                            )}
                        </p>
                    {/each}
                    {#if $isDiamondStore}
                        <button
                            type="button"
                            class="add-row"
                            disabled={held.editor.busy}
                            onclick={add}
                        >
                            <span class="add-icon"><span></span></span>
                            <span class="add-label">
                                {$_(
                                    neuron
                                        ? "native.groupSettings.gates.addNervousSystem"
                                        : "native.groupSettings.gates.addToken",
                                )}
                            </span>
                        </button>
                    {/if}
                </div>
            </div>
            {#if entries.length > 0}
                <button
                    type="button"
                    class="remove-gate"
                    disabled={held.editor.busy}
                    onclick={removeGate}
                >
                    {$_("native.groupSettings.gates.removeGate")}
                </button>
            {/if}
        </div>
    {:else if step === "pick"}
        <div class="search">
            <Field
                placeholder={$_(
                    neuron
                        ? "native.groupSettings.gates.searchNervousSystems"
                        : "native.groupSettings.gates.searchTokens",
                )}
                value={query}
                onInput={(e) => (query = e.currentTarget.value)}
                onClear={() => (query = "")}
                showShortcut={false}
            />
        </div>
        <div class="list" {@attach aboveKeyboard()}>
            {#each choices as x (x.id)}
                <button type="button" class="choice" onclick={() => pick(x)}>
                    <TokenAvatar symbol={x.symbol} logo={x.logo} size={40} />
                    <span class="text">
                        <span class="name">{x.name}</span>
                        <span class="sub">{x.sub}</span>
                    </span>
                    <span class="chevron"></span>
                </button>
            {:else}
                <p class="none">{$_("native.groupSettings.gates.noMatches")}</p>
            {/each}
        </div>
    {:else if picked !== undefined}
        <form
            class="body value"
            {@attach aboveKeyboard()}
            onsubmit={(e) => {
                e.preventDefault();
                save();
            }}
        >
            <div class="picked">
                <TokenAvatar symbol={picked.symbol} logo={picked.logo} size={40} />
                <span class="text">
                    <span class="name">{picked.name}</span>
                    <span class="sub">{picked.sub}</span>
                </span>
                <button
                    type="button"
                    class="change"
                    onclick={() => context.push({ kind: "gate_entries", gate: kind, step: "pick" })}
                >
                    {$_("native.groupSettings.gates.change")}
                </button>
            </div>
            <div class="section">
                <ListSectionLabel label={$_(amountLabel)} />
                <span class="field">
                    <input
                        value={amount}
                        oninput={(e) => (amount = e.currentTarget.value)}
                        inputmode="decimal"
                        autocomplete="off"
                        aria-label={$_(amountLabel)}
                        placeholder={neuron ? $_("native.groupSettings.gates.optional") : "0"}
                    />
                    <span class="unit">{picked.symbol}</span>
                </span>
                {#if worth !== ""}
                    <span class="worth">{worth}</span>
                {/if}
            </div>
            {#if neuron}
                <div class="section">
                    <ListSectionLabel label={$_("native.groupSettings.gates.minDelay")} />
                    <div
                        class="chips"
                        role="radiogroup"
                        aria-label={$_("native.groupSettings.gates.minDelay")}
                    >
                        {#each delays as d (d.days)}
                            <button
                                type="button"
                                class="chip"
                                class:on={d.days === days}
                                role="radio"
                                aria-checked={d.days === days}
                                onclick={() => (days = d.days)}
                            >
                                {d.label}
                            </button>
                        {/each}
                    </div>
                </div>
            {/if}
        </form>
        <!-- the button rides up with the soft keyboard, so Add / Save stays in reach while typing -->
        <div class="footer" class:lifted={softKeyboard.covering > 0} style:--lift="{softKeyboard.covering}px">
            <Button
                label={$_(
                    changing
                        ? "native.groupSettings.gates.save"
                        : neuron
                          ? "native.groupSettings.gates.addNervousSystemCta"
                          : "native.groupSettings.gates.addTokenCta",
                )}
                size="lg"
                fullWidth
                disabled={made === undefined || held.editor.busy}
                onClick={save}
            />
        </div>
    {/if}
</div>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .gate-entries {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }

    .body {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        scrollbar-width: none;
        display: flex;
        flex-direction: column;
        gap: 22px;
        padding: 8px var(--space-16) var(--scroll-end);

        &.value {
            padding-bottom: var(--space-16);
        }
    }

    .help {
        margin: 0;
        padding: 0 var(--space-4);
        font: var(--weight-regular) text-size(13.5px) / 1.5 var(--font-sans);
        color: var(--ink-3);
        text-wrap: pretty;
    }

    .section {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .card {
        display: flex;
        flex-direction: column;
        border-radius: 16px;
        overflow: hidden;
        background: var(--overlay-1);
    }

    .entry {
        display: flex;
        align-items: center;
        gap: var(--space-4);
        min-height: 64px;
        padding-inline-end: var(--space-6);

        & + .entry,
        & + .add-row {
            box-shadow: inset 0 1px 0 var(--line-1);
        }
    }

    .entry-main,
    .entry-remove,
    .add-row,
    .remove-gate,
    .choice,
    .change,
    .chip {
        border: 0;
        background: none;
        color: var(--ink);
        text-align: start;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &:focus-visible {
            @include focus-ring;
        }

        &:disabled {
            cursor: default;
        }
    }

    .entry-main {
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: var(--space-12);
        min-height: 64px;
        padding: var(--space-8) 0 var(--space-8) var(--space-14);
    }

    .entry-remove {
        flex: none;
        width: var(--touch-target);
        height: var(--touch-target);
        @include flex-center;
        padding: 0;
    }

    .remove-icon {
        @include icon(close, 14px, var(--ink-3));
    }

    .empty {
        margin: 0;
        padding: 18px var(--space-16) 4px;
        font: var(--weight-regular) text-size(13.5px) / 1.45 var(--font-sans);
        color: var(--ink-4);
        text-wrap: pretty;
    }

    .add-row {
        display: flex;
        align-items: center;
        gap: var(--space-12);
        min-height: 60px;
        padding: 0 var(--space-14);

        &:active:not(:disabled) {
            background: var(--overlay-1);
        }
    }

    .add-icon {
        flex: none;
        width: 40px;
        height: 40px;
        border-radius: var(--radius-circle);
        background: var(--accent-soft);
        @include flex-center;

        span {
            @include icon(plus, 16px, var(--accent));
        }
    }

    .add-label {
        flex: 1;
        font: var(--weight-semibold) text-size(15px) / 1.2 var(--font-sans);
        color: var(--accent-bright);
    }

    .text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 5px;
    }

    .name {
        font: var(--weight-semibold) text-size(15px) / 1.2 var(--font-sans);
        @include truncate;
    }

    .value-line {
        font: var(--weight-medium) text-size(12.5px) / 1.2 var(--font-mono);
        color: var(--ink-3);
        @include truncate;
    }

    .sub {
        font: var(--weight-medium) text-size(12.5px) / 1.2 var(--font-sans);
        color: var(--ink-3);
        @include truncate;
    }

    .remove-gate {
        align-self: center;
        min-height: var(--touch-target);
        padding: 0 var(--space-16);
        font: var(--weight-semibold) text-size(14.5px) / 1 var(--font-sans);
        color: var(--status-danger);
    }

    .search {
        flex: none;
        padding: 4px var(--space-16) 10px;
    }

    .list {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        scrollbar-width: none;
        display: flex;
        flex-direction: column;
        gap: var(--space-6);
        padding: 0 var(--space-8) var(--scroll-end);
    }

    .choice {
        flex: none;
        display: flex;
        align-items: center;
        gap: var(--space-12);
        min-height: 60px;
        padding: var(--space-8) var(--space-12);
        border-radius: 14px;

        &:active {
            background: var(--overlay-1);
        }

        .name {
            font-weight: var(--weight-bold);
        }
    }

    .chevron {
        @include icon(chevron-right, 14px, var(--ink-4));

        &:dir(rtl) {
            transform: scaleX(-1);
        }
    }

    .none {
        margin: 0;
        padding: var(--space-24) var(--space-16);
        text-align: center;
        font: var(--weight-regular) text-size(14px) / 1.5 var(--font-sans);
        color: var(--ink-4);
    }

    .picked {
        flex: none;
        display: flex;
        align-items: center;
        gap: var(--space-12);
        padding: var(--space-10) var(--space-6) var(--space-10) var(--space-12);
        border-radius: 16px;
        background: var(--overlay-1);

        .name {
            font-weight: var(--weight-bold);
        }
    }

    .change {
        flex: none;
        min-height: var(--touch-target);
        padding: 0 var(--space-10);
        font: var(--weight-semibold) text-size(14px) / 1 var(--font-sans);
        color: var(--accent-bright);
    }

    .field {
        display: flex;
        align-items: center;
        gap: var(--space-10);
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
        font: var(--weight-bold) text-size(18px) / 1 var(--font-mono);

        &::placeholder {
            color: var(--ink-4);
        }
    }

    .unit {
        flex: none;
        font: var(--weight-semibold) text-size(14px) / 1 var(--font-sans);
        color: var(--ink-3);
    }

    .worth {
        padding-inline-start: var(--space-4);
        font: var(--weight-medium) text-size(12.5px) / 1 var(--font-mono);
        color: var(--ink-3);
    }

    .chips {
        display: flex;
        gap: var(--space-6);
    }

    .chip {
        flex: 1;
        min-width: 0;
        height: 40px;
        border-radius: 12px;
        background: var(--overlay-1);
        @include flex-center;
        font: var(--weight-semibold) text-size(13px) / 1 var(--font-sans);
        color: var(--ink-2);
        white-space: nowrap;

        &.on {
            background: var(--accent-soft);
            box-shadow: inset 0 0 0 1.5px var(--accent);
            color: var(--accent-bright);
        }
    }

    .footer {
        flex: none;
        padding: 12px var(--space-16) var(--bar-end);
        transition: transform 0.2s var(--ease-out, ease-out);

        // over the keyboard: up by what it covers, and without the bar's inset under it
        &.lifted {
            transform: translateY(calc(-1 * var(--lift) + var(--bar-end) - 12px));
        }

        @media (prefers-reduced-motion: reduce) {
            transition: none;
        }
    }
</style>
