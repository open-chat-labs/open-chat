<!-- A group's or channel's access gates (native plan 11): the intro, the Gates card (the simple
     gates as switches; the gates with setup as rows that open the gate sheet, each entry under its
     row, tapped to change it, × to take it off with Undo), then the Gate settings card, always
     there and dimmed until it applies: Members must meet (All gates / Any one gate, from two
     gates) and Re-check members (Never / Weekly / Monthly / Quarterly, from one). It edits the
     draft (`editor`, the shared UpdateGroupOrCommunityState's gate config) until it's saved. Adding
     gates is Diamond's, as on the web and the old pages; without it, the page says so and links to
     Diamond. -->
<script lang="ts">
    import {
        cryptoLookup,
        isDiamondStore,
        nervousSystemLookup,
        type AccessGateConfig,
        type ActiveLeafGate,
    } from "@client";
    import SettingsAction from "@openchat/ui/src/native/SettingsAction.svelte";
    import SettingsGroup from "@openchat/ui/src/native/SettingsGroup.svelte";
    import SettingsSegmented from "@openchat/ui/src/native/SettingsSegmented.svelte";
    import SettingsSwitch from "@openchat/ui/src/native/SettingsSwitch.svelte";
    import SettingsValue from "@openchat/ui/src/native/SettingsValue.svelte";
    import type { UpdateGroupOrCommunityState } from "@src/logic/groupOrCommunity/groupOrCommunity.svelte";
    import { navigate } from "@src/utils/navigation";
    import { untrack } from "svelte";
    import { _, locale } from "svelte-i18n";
    import { DIAMOND_URL } from "../../router/locations";
    import { useOverlay } from "../../shell/overlays.svelte";
    import type { ScreenContext } from "../app/screens";
    import GateSheet from "./GateSheet.svelte";
    import {
        canAddEntry,
        gateKey,
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

    // the gate config as a whole: an entry taken off comes back as it was with Undo
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

    function remove(gate: ActiveLeafGate, text: string) {
        const before = $state.snapshot(editor.gateConfig);
        editor.deleteGate(gate);
        setConfig(withoutStaleExpiry($state.snapshot(editor.gateConfig)));
        context.toast($_("native.groupSettings.gates.removed", { values: { gate: text } }), () =>
            setConfig(before),
        );
    }

    // ---- the gate sheet: a new entry, or one being changed

    let sheet = $state<{
        kind: SetupGateKind;
        editing: ActiveLeafGate | undefined;
        open: boolean;
        id: number;
    }>();
    let sheets = 0;
    useOverlay(
        overlays,
        () => sheet?.open === true,
        () => closeSheet(),
    );

    function openSheet(kind: SetupGateKind, editing: ActiveLeafGate | undefined) {
        sheet = { kind, editing, open: true, id: ++sheets };
    }

    function closeSheet() {
        if (sheet !== undefined) sheet = { ...sheet, open: false };
    }

    function sheetDone(gate: ActiveLeafGate) {
        const editing = sheet?.editing;
        if (editing === undefined) editor.addLeaf(gate);
        else editor.replaceGate(editing, gate);
        closeSheet();
    }

    const taken = $derived(shownGates(config).map(gateKey));
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
        <SettingsGroup label={$_("native.groupSettings.gates.card")}>
            {#each rows as row (row.gate)}
                {#if row.kind === "switch"}
                    <SettingsSwitch
                        label={row.label}
                        on={row.on}
                        disabled={editor.busy || (!row.on && !$isDiamondStore)}
                        onChange={(on) => toggle(row.gate, on)} />
                {:else}
                    {@const addable = canAddEntry(row.gate, row.entries.length) && $isDiamondStore}
                    <button
                        type="button"
                        class="settings-row setup"
                        disabled={!addable || editor.busy}
                        onclick={() => openSheet(row.gate, undefined)}>
                        <span class="setup-label">{row.label}</span>
                        {#if addable}
                            <span class="add">{$_("native.groupSettings.gates.add")}</span>
                        {/if}
                        <span class="chevron"></span>
                    </button>
                    {#each row.entries as entry (entry.key)}
                        <div class="settings-row entry">
                            <button
                                type="button"
                                class="entry-text"
                                disabled={editor.busy}
                                onclick={() => openSheet(row.gate, entry.gate)}>
                                <span class="entry-dot"></span>
                                {entry.text}
                            </button>
                            <button
                                type="button"
                                class="remove"
                                disabled={editor.busy}
                                aria-label={$_("native.groupSettings.gates.remove", {
                                    values: { gate: entry.text },
                                })}
                                onclick={() => remove(entry.gate, entry.text)}>
                                <span class="remove-icon"></span>
                            </button>
                        </div>
                    {/each}
                {/if}
            {/each}
        </SettingsGroup>

        <!-- always there, dimmed until it applies (the plan; the prototype's look is TODO(design)) -->
        <SettingsGroup label={$_("native.groupSettings.gates.settings")}>
            <div class="settings-row applies" class:dimmed={!combines} inert={!combines}>
                <SettingsSegmented
                    label={$_("native.groupSettings.gates.mustMeet")}
                    options={[
                        $_("native.groupSettings.gates.all"),
                        $_("native.groupSettings.gates.any"),
                    ]}
                    selected={gateOperator(config) === "or" ? 1 : 0}
                    onSelect={(i) => editor.setOperator(i === 1 ? "or" : "and")} />
            </div>
            <div class="settings-row applies" class:dimmed={!any} inert={!any}>
                <SettingsValue
                    label={$_("native.groupSettings.gates.recheck")}
                    help={$_("native.groupSettings.gates.recheckHelp")}
                    options={recheckOptions(days, t)}
                    value={String(days)}
                    onChange={(id) =>
                        setConfig({
                            ...$state.snapshot(editor.gateConfig),
                            expiry: recheckExpiry(Number(id)),
                        })} />
            </div>
        </SettingsGroup>
    {/if}
</div>

{#if sheet !== undefined}
    {#key sheet.id}
        <GateSheet
            open={sheet.open}
            kind={sheet.kind}
            editing={sheet.editing}
            {taken}
            {lookups}
            onDone={sheetDone}
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

    .setup {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 12px;
        min-height: 60px;
        padding: 10px 16px;
        box-sizing: border-box;
        border: 0;
        background: none;
        color: var(--ink);
        text-align: start;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &:active:not(:disabled) {
            background: var(--overlay-1);
        }

        &:disabled {
            cursor: default;
        }

        &:focus-visible {
            @include focus-ring;
        }
    }

    .setup-label {
        flex: 1;
        min-width: 0;
        font: var(--weight-medium) text-size(15px) / 1.2 var(--font-sans);
    }

    .add {
        flex: none;
        font: var(--weight-semibold) text-size(13px) / 1 var(--font-sans);
        color: var(--accent-bright);
    }

    .chevron {
        @include icon(chevron-right, 14px, var(--ink-4));

        &:dir(rtl) {
            transform: scaleX(-1);
        }

        :disabled > & {
            opacity: 0;
        }
    }

    // an entry under its gate's row: changed by a tap, taken off with its ×
    .entry {
        display: flex;
        align-items: center;
        min-height: 52px;
        padding-inline: 16px 4px;
        box-sizing: border-box;
    }

    .entry-text {
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 10px;
        align-self: stretch;
        padding: 0;
        border: 0;
        background: none;
        color: var(--ink-2);
        font: var(--weight-semibold) text-size(14px) / 1.3 var(--font-sans);
        text-align: start;
        cursor: pointer;
        overflow-wrap: anywhere;

        &:focus-visible {
            @include focus-ring;
        }
    }

    .entry-dot {
        flex: none;
        width: 6px;
        height: 6px;
        border-radius: var(--radius-circle);
        background: var(--accent);
    }

    .remove {
        flex: none;
        width: var(--touch-target);
        height: var(--touch-target);
        @include flex-center;
        padding: 0;
        border: 0;
        background: none;
        cursor: pointer;

        &:focus-visible {
            @include focus-ring;
        }
    }

    .remove-icon {
        @include icon(close, 16px, var(--ink-3));
    }

    .applies {
        transition: opacity 160ms ease;

        &.dimmed {
            opacity: 0.45;
        }

        @media (prefers-reduced-motion: reduce) {
            transition: none;
        }
    }
</style>
