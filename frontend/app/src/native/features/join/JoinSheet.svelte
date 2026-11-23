<!-- The requirements sheet (N8b PR 2, native plan 12 "Join sheet"): a join's requirements as a checklist, over Join
     ("Pay 3 ICP and join"), a level at a time (logic/access/GateEvaluation: a gated channel in a gated community
     shows the community's requirements, then the channel's), as the web's JoinGateDialogScreen walks them. Join
     records the user's choice (logic/join/joinGate: the gates' own amounts) and carries the join on through the
     client (the PIN, the approval, the join). The sheet leaves once joined; while the join doesn't go through (the
     PIN dismissed, the approval or the join failed, a gate the backend found unmet) it stays, with a toast saying
     why. Closing drops the join. Get Diamond closes it for the Diamond screen; joining again after buying finds
     that requirement met.
     A join with rules to agree to first (logic/join beginJoin) opens the sheet on them: the rules, then "Agree and
     join" (agreeAndJoin), and requirements to meet next take their place in the same sheet. The client keeps what
     was agreed to for the first message there to accept. Cancel, or closing, joins nothing.
     TODO(design): no rules step in the design; the pre-send RulesSheet's look.
     TODO(design): "Get ICP" on a payment the wallet can't cover, once the wallet is native (N10). -->
<script lang="ts">
    import {
        enhancedCryptoLookup,
        type EnhancedAccessGate,
        type OpenChat,
        type ResourceKey,
    } from "@client";
    import { interpolateNewUi } from "@i18n/i18n";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import Icon from "@openchat/ui/src/lib/components/Icon.svelte";
    import BottomSheet from "@openchat/ui/src/native/BottomSheet.svelte";
    import Markdown from "@src/core/Markdown.svelte";
    import { GateEvaluation } from "@src/logic/access/gateEvaluation.svelte";
    import {
        agreeAndJoin,
        dropJoin,
        joinFailure,
        rulesToAcceptSections,
        submitGates,
        type JoinTarget,
    } from "@src/logic/join/joinFlow.svelte";
    import { recordGateChoice } from "@src/logic/join/joinGate";
    import { appStoreBuild } from "@src/utils/features";
    import { navigate } from "@src/utils/navigation";
    import { getContext, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import { DIAMOND_URL } from "../../router/locations";
    import { useOverlay, type Overlays } from "../../shell/overlays.svelte";
    import { joinStepToast } from "./joinBar.adapter";
    import {
        sheetChoice,
        sheetCopy,
        sheetRows,
        type JoinSheetStart,
        type SheetRow,
    } from "./joinSheet.adapter";

    interface Props {
        /** The join whose rules or requirements these are (the client asked for them). */
        join: { target: JoinTarget; start: JoinSheetStart; name: string };
        overlays: Overlays;
        toast: (message: string) => void;
    }

    // closed, it stays to slide away; another Review and join mounts a new one
    let { join, overlays, toast }: Props = $props();

    const client = getContext<OpenChat>("client");
    const text = (key: ResourceKey) => interpolateNewUi($_, key);

    // the rules agreed to, while they're showing; the requirements once the client asks for them
    const start = untrack(() => join.start);
    // a channel's and its community's each headed with whose they are; the title names the first
    const rules = start.kind === "rules" ? rulesToAcceptSections(start.rules) : undefined;
    let evaluation = $state.raw<GateEvaluation | undefined>(
        start.kind === "gates" ? new GateEvaluation(client, start.gates) : undefined,
    );
    let open = $state(true);
    let neuronConfirmed = $state(false);
    let joining = $state(false);

    // the last level's, kept while the sheet slides away: the evaluation has moved past it then
    let held: { gate: EnhancedAccessGate; rows: SheetRow[] } | undefined;
    const level = $derived.by(() => {
        if (evaluation === undefined) return undefined;
        const gate = evaluation.gate;
        if (gate === undefined) return held;
        held = {
            gate,
            rows: sheetRows(evaluation.leaves, $enhancedCryptoLookup, neuronConfirmed, appStoreBuild),
        };
        return held;
    });
    const choice = $derived(
        level === undefined ? undefined : sheetChoice(level.gate, level.rows, neuronConfirmed),
    );
    const copy = $derived(
        level === undefined ? undefined : sheetCopy(level.gate, choice?.payments ?? []),
    );

    function close() {
        if (joining) return;
        dropJoin(join.target);
        open = false;
    }

    useOverlay(
        untrack(() => overlays),
        () => open,
        close,
        () => joining,
    );

    // the composer's keyboard down, so the sheet's Join shows
    $effect(() => {
        const focused = document.activeElement;
        if (focused instanceof HTMLElement) untrack(() => focused.blur());
    });

    // "Agree and join": the join, with the rules agreed to; requirements to meet take the rules'
    // place, and a join that doesn't go through leaves the rules up, with a toast saying why
    async function agree() {
        if (start.kind !== "rules" || joining) return;
        joining = true;
        try {
            const step = await agreeAndJoin(client, join.target, start.rules);
            switch (step.kind) {
                case "evaluate_gates":
                    evaluation = new GateEvaluation(client, step.gates);
                    return;
                case "failed":
                case "gate_check_failed":
                    toast(text(joinFailure(step)));
                    return;
                case "cancelled":
                    return;
            }
            const message = joinStepToast(step, join.name);
            if (message !== undefined) toast(text(message));
            open = false;
        } finally {
            joining = false;
        }
    }

    async function go() {
        if (evaluation === undefined || choice === undefined || !choice.ready || joining) return;
        joining = true;
        try {
            const putBack = evaluation.checkpoint();
            const recorded = recordGateChoice(
                evaluation,
                choice.choice,
                (ledger) => $enhancedCryptoLookup.get(ledger)?.transferFee,
            );
            switch (recorded.kind) {
                case "incomplete":
                    if (recorded.balanceShort) toast($_("access.paymentLeavesBalanceShort"));
                    return;
                case "next_level":
                    neuronConfirmed = false;
                    return;
            }
            const step = await submitGates(client, join.target, recorded.gateCheck);
            switch (step.kind) {
                case "cancelled":
                    putBack();
                    return;
                case "failed":
                case "gate_check_failed":
                    putBack();
                    toast(text(joinFailure(step)));
                    return;
            }
            const message = joinStepToast(step, join.name);
            if (message !== undefined) toast(text(message));
            open = false;
        } finally {
            joining = false;
        }
    }

    function getDiamond() {
        close();
        navigate(DIAMOND_URL);
    }

    function confirmNeuron() {
        if (!joining) neuronConfirmed = !neuronConfirmed;
    }
</script>

{#snippet inside(row: SheetRow, met: boolean)}
    <span class="dot" class:met>
        {#if met}<Icon icon="check" size={13} />{/if}
    </span>
    <span class="texts">
        <span class="label">{text(row.label)}</span>
        {#if row.detail !== undefined}
            <span class="detail">{text(row.detail)}</span>
        {/if}
    </span>
    {#if row.getDiamond}
        <button class="action" onclick={getDiamond}>{$_("native.join.sheet.getDiamond")}</button>
    {/if}
{/snippet}

<BottomSheet
    {open}
    onClose={close}
    title={evaluation === undefined
        ? $_("rules.joinTitle", { values: { name: rules?.title ?? join.name } })
        : $_("native.join.sheet.title", { values: { name: level?.gate.collectionName ?? "" } })}
>
    {#if evaluation === undefined && rules !== undefined}
        <div class="rules">
            {#each rules.sections as section (section)}
                {#if section.heading !== undefined}
                    <h4 class="heading">{section.heading}</h4>
                {/if}
                <Markdown text={section.text} inline={false} />
            {/each}
        </div>
        <div class="foot-buttons">
            <Button
                label={$_("cancel")}
                variant="secondary"
                size="lg"
                fullWidth
                disabled={joining}
                onClick={close} />
            <Button
                label={$_("rules.agreeAndJoin")}
                size="lg"
                fullWidth
                busy={joining}
                onClick={agree} />
        </div>
    {:else if level !== undefined && choice !== undefined && copy !== undefined}
        <div class="body">
            <span class="intro">{text(copy.intro)}</span>
            <div class="list" role="list">
                {#each level.rows as row (row.id)}
                    {@const met = row.state === "met" || row.state === "pay"}
                    {#if row.confirmable}
                        <!-- the neuron: only the user can say they hold one -->
                        <div
                            class="row confirmable"
                            role="checkbox"
                            aria-checked={met}
                            tabindex="0"
                            onclick={confirmNeuron}
                            onkeydown={(e) => {
                                if (e.key === " " || e.key === "Enter") confirmNeuron();
                            }}
                        >
                            {@render inside(row, met)}
                        </div>
                    {:else}
                        <div class="row" role="listitem">{@render inside(row, met)}</div>
                    {/if}
                {/each}
            </div>
            <Button
                label={text(copy.join)}
                icon={copy.icon}
                size="lg"
                fullWidth
                disabled={!choice.ready}
                busy={joining}
                onClick={go}
            />
            <span class="foot">{text(copy.foot)}</span>
        </div>
    {/if}
</BottomSheet>

<style lang="scss">
    .heading {
        margin: var(--space-12) 0 var(--space-4);
        font: var(--weight-semibold) text-size(15px) / 1.4 var(--font-sans);
        color: var(--ink);

        &:first-child {
            margin-block-start: 0;
        }
    }

    // the rules, as the pre-send RulesSheet shows them
    .rules {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: var(--space-4) var(--space-16) var(--space-16);
        font: var(--weight-regular) text-size(15px) / 1.5 var(--font-sans);
        color: var(--ink-2);
        overflow-wrap: anywhere;
    }

    .foot-buttons {
        flex: none;
        display: flex;
        gap: var(--space-10);
        padding: var(--space-8) var(--space-16) calc(var(--safe-bottom) + var(--space-16));
    }

    // the design's sheet: the intro, the checklist in one rounded box, Join, a note under it
    .body {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 0 16px calc(var(--safe-bottom) + 16px);
    }

    .intro {
        padding: 0 4px;
        font: 400 13.5px/1.45 var(--font-sans);
        color: var(--ink-3);
        text-wrap: pretty;
    }

    .list {
        display: flex;
        flex-direction: column;
        border-radius: 16px;
        overflow: hidden;
        background: var(--overlay-1);
    }

    .row {
        display: flex;
        align-items: center;
        gap: 12px;
        min-height: 64px;
        padding: 10px 14px;
        box-sizing: border-box;

        & + & {
            box-shadow: inset 0 1px 0 var(--line-1);
        }

        &.confirmable {
            cursor: pointer;
        }
    }

    .dot {
        flex: none;
        width: 26px;
        height: 26px;
        border-radius: 50%;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: inset 0 0 0 1.5px var(--ink-4);

        &.met {
            box-shadow: none;
            background: color-mix(in oklch, var(--status-online) 16%, transparent);
            color: var(--status-online);
        }
    }

    .texts {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .label {
        font: 600 14.5px/1.25 var(--font-sans);
    }

    .detail {
        font: 500 12.5px/1.35 var(--font-sans);
        color: var(--ink-3);
        text-wrap: pretty;
    }

    .action {
        flex: none;
        height: 36px;
        padding: 0 12px;
        border: 0;
        border-radius: 10px;
        background: var(--accent-soft);
        font: 700 13px/1 var(--font-sans);
        color: var(--accent-bright);
        cursor: pointer;
    }

    .foot {
        text-align: center;
        font: 400 12.5px/1.45 var(--font-sans);
        color: var(--ink-4);
    }
</style>
