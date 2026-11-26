<!-- A group's, channel's or community's access gates (native plan 11, and the design's page): the
     intro, the Gates card (each gate with its icon, in the accent while it's on, and what it is
     under it: the simple gates as switches; the gates with setup as rows showing On / Off, with a
     summary of their entries while on: a payment, minimum balance or neuron gate's row pushes its
     own screens (GateEntriesScreen: its entries, then a token's search, then its value), the
     minimum CHIT gate's opens its sheet), then the Gate settings card, always there and dimmed
     until it applies: Members must meet (All gates / Any one gate, from two gates) and Re-check
     members (Never / Weekly / Monthly / Quarterly, from one), each a row with its value that opens
     a menu. It edits the draft (`editor`, the shared UpdateGroupOrCommunityState's gate config),
     held for the screens it pushes (gatesEditor), until it's saved. Adding gates is Diamond's, as
     on the web and the old pages; without it, the page says so and links to Diamond. -->
<script lang="ts">
    import {
        cryptoLookup,
        isDiamondStore,
        nervousSystemLookup,
        type AccessGateConfig,
        type ChitEarnedGate,
    } from "@client";
    import SettingsAction from "@openchat/ui/src/native/SettingsAction.svelte";
    import SettingsGroup from "@openchat/ui/src/native/SettingsGroup.svelte";
    import SettingsLink from "@openchat/ui/src/native/SettingsLink.svelte";
    import SettingsSwitch from "@openchat/ui/src/native/SettingsSwitch.svelte";
    import SettingsValue from "@openchat/ui/src/native/SettingsValue.svelte";
    import type { UpdateGroupOrCommunityState } from "@src/logic/groupOrCommunity/groupOrCommunity.svelte";
    import { gateLabel } from "@src/utils/access";
    import { navigate } from "@src/utils/navigation";
    import { onDestroy, untrack } from "svelte";
    import { _, locale } from "svelte-i18n";
    import { DIAMOND_URL } from "../../router/locations";
    import { useOverlay } from "../../shell/overlays.svelte";
    import type { ScreenContext } from "../app/screens";
    import GateSheet from "./GateSheet.svelte";
    import { holdGatesEditor, takeOffGates } from "./gatesEditor.svelte";
    import {
        gateOperator,
        gateRows,
        operatorApplies,
        recheckDays,
        recheckExpiry,
        recheckOptions,
        shownGates,
        switchGate,
        withoutStaleExpiry,
        type SetupGateKind,
        type SwitchGateKind,
    } from "./settings.adapter";

    type Props = { editor: UpdateGroupOrCommunityState; context: ScreenContext };

    let { editor, context }: Props = $props();

    const t = (key: string, values?: Record<string, string | number>) => $_(key, { values });
    const overlays = untrack(() => context.overlays);
    const lookups = $derived({ tokens: $cryptoLookup, nervousSystems: $nervousSystemLookup });
    const config = $derived(editor.gateConfig);
    const rows = $derived(gateRows(config, lookups, t, $locale ?? "en"));
    const any = $derived(shownGates(config).length > 0);
    const combines = $derived(operatorApplies(config));
    const days = $derived(recheckDays(config));
    const level = $derived(editor.candidate.level);

    function setConfig(next: AccessGateConfig) {
        editor.candidate.gateConfig = next;
    }

    function toggle(kind: SwitchGateKind, on: boolean) {
        if (on) {
            const gate = switchGate(kind);
            if (gate !== undefined) editor.addLeaf(gate);
        } else {
            const gate = editor.findMatchByKind(kind);
            if (gate !== undefined) editor.deleteGate(gate);
            setConfig(withoutStaleExpiry($state.snapshot(editor.gateConfig)));
        }
    }

    // the screens a payment, minimum balance or neuron gate's row pushes edit this draft
    onDestroy(holdGatesEditor(editor));

    // Taking the CHIT gate off (its sheet's Remove gate), with Undo; it goes once the page does,
    // with the draft it would change.
    let takeDownUndo: (() => void) | undefined;
    onDestroy(() => takeDownUndo?.());

    function chitGate(): ChitEarnedGate | undefined {
        return shownGates(editor.gateConfig).find(
            (g): g is ChitEarnedGate => g.kind === "chit_earned_gate",
        );
    }

    function removeChit() {
        const gate = chitGate();
        closeSheet();
        if (gate === undefined) return;
        takeDownUndo = takeOffGates(editor, [gate], (undo) =>
            context.toast(
                $_("native.groupSettings.gates.removed", {
                    values: { gate: $_(gateLabel.chit_earned_gate) },
                }),
                undo,
            ),
        );
    }

    // ---- a gate with setup's row: the CHIT gate's sheet, or the others' screens

    let sheet = $state<{ current: ChitEarnedGate | undefined; open: boolean; id: number }>();
    let sheets = 0;
    useOverlay(
        overlays,
        () => sheet?.open === true,
        () => closeSheet(),
    );

    function openGate(kind: SetupGateKind) {
        if (kind === "chit_earned_gate") {
            const current = chitGate();
            sheet = {
                current: current === undefined ? undefined : $state.snapshot(current),
                open: true,
                id: ++sheets,
            };
        } else {
            context.push({ kind: "gate_entries", gate: kind, step: "list" });
        }
    }

    function closeSheet() {
        if (sheet !== undefined) sheet = { ...sheet, open: false };
    }

    function chitDone(gate: ChitEarnedGate) {
        const current = chitGate();
        if (current === undefined) editor.addLeaf(gate);
        else editor.replaceGate(current, gate);
        closeSheet();
    }

    const operator = $derived(gateOperator(config));
</script>

<div class="gates">
    <p class="intro">{$_("native.groupSettings.gates.intro", { values: { level } })}</p>

    {#if !$isDiamondStore && !any}
        <SettingsGroup note={$_("native.groupSettings.gates.diamondOnly")}>
            <SettingsAction
                icon="diamond"
                label={$_("native.groupSettings.gates.getDiamond")}
                onClick={() => navigate(DIAMOND_URL)} />
        </SettingsGroup>
    {:else}
        <!-- without Diamond (lapsed), the gates there can be taken off but none added: said
             under the card, rather than switches that are just disabled -->
        <SettingsGroup
            label={$_("native.groupSettings.gates.card")}
            note={$isDiamondStore ? "" : $_("native.groupSettings.gates.diamondOnly")}>
            {#each rows as row (row.gate)}
                {#if row.kind === "switch"}
                    <SettingsSwitch
                        label={row.label}
                        help={row.help}
                        icon={row.icon}
                        on={row.on}
                        disabled={editor.busy || (!row.on && !$isDiamondStore)}
                        onChange={(on) => toggle(row.gate, on)} />
                {:else}
                    <SettingsLink
                        label={row.label}
                        help={row.on ? row.summary : row.help}
                        helpSummary={row.on}
                        icon={row.icon}
                        iconAccent={row.on}
                        value={$_(
                            row.on
                                ? "native.groupSettings.gates.on"
                                : "native.groupSettings.gates.off",
                        )}
                        accent={row.on}
                        quiet={!row.on}
                        disabled={editor.busy || (!row.on && !$isDiamondStore)}
                        onClick={() => openGate(row.gate)} />
                {/if}
            {/each}
        </SettingsGroup>

        <!-- always there, dimmed until it applies (the plan and the design) -->
        <SettingsGroup label={$_("native.groupSettings.gates.settings")}>
            <SettingsValue
                label={$_("native.groupSettings.gates.mustMeet")}
                help={$_(
                    !combines
                        ? "native.groupSettings.gates.mustMeetLater"
                        : operator === "or"
                          ? "native.groupSettings.gates.mustMeetAny"
                          : "native.groupSettings.gates.mustMeetAll",
                )}
                icon="check"
                disabled={!combines || editor.busy}
                options={[
                    { id: "and", label: $_("native.groupSettings.gates.all") },
                    { id: "or", label: $_("native.groupSettings.gates.any") },
                ]}
                value={operator}
                onChange={(id) => editor.setOperator(id === "or" ? "or" : "and")} />
            <SettingsValue
                label={$_("native.groupSettings.gates.recheck")}
                help={$_(
                    any
                        ? "native.groupSettings.gates.recheckHelp"
                        : "native.groupSettings.gates.recheckLater",
                )}
                icon="refresh"
                disabled={!any || editor.busy}
                options={recheckOptions(days, t)}
                value={String(days)}
                onChange={(id) =>
                    setConfig({
                        ...$state.snapshot(editor.gateConfig),
                        expiry: recheckExpiry(Number(id)),
                    })} />
        </SettingsGroup>
    {/if}
</div>

{#if sheet !== undefined}
    {#key sheet.id}
        <GateSheet
            open={sheet.open}
            current={sheet.current}
            canAdd={$isDiamondStore}
            onDone={chitDone}
            onRemove={removeChit}
            onClose={closeSheet} />
    {/key}
{/if}

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .gates {
        display: flex;
        flex-direction: column;
        gap: 22px;
        padding: 8px var(--space-16) 0;
    }

    .intro {
        margin: 0;
        padding: 0 4px;
        font: var(--weight-regular) text-size(14px) / 1.5 var(--font-sans);
        color: var(--ink-3);
        text-wrap: pretty;
    }
</style>
