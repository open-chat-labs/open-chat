<!-- The minimum CHIT gate's sheet (native plan 11, Access gates; the design's): what the gate is,
     the minimum, Save, and Remove gate while it's on. Nothing reaches the draft until Save, which
     hands the gate back. Setting it is Diamond's (as the page's). The other gates with setup have
     their own screens (GateEntriesScreen). The host mounts it again each time it opens. -->
<script lang="ts">
    import type { ChitEarnedGate } from "@client";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import ListSectionLabel from "@openchat/ui/src/lib/components/ListSectionLabel.svelte";
    import BottomSheet from "@openchat/ui/src/native/BottomSheet.svelte";
    import { chitGateOf } from "@src/logic/access/gateValues";
    import { gateLabel } from "@src/utils/access";
    import { untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import { softKeyboard } from "../../aboveKeyboard.svelte";

    type Props = {
        open: boolean;
        /** The gate as it is; none while it's off. */
        current: ChitEarnedGate | undefined;
        /** Whether it can be set (Diamond's); one already on can still be taken off. */
        canAdd: boolean;
        onDone: (gate: ChitEarnedGate) => void;
        /** Remove gate: the host takes it off, with Undo. */
        onRemove: () => void;
        onClose: () => void;
    };

    let { open, current, canAdd, onDone, onRemove, onClose }: Props = $props();

    const wasOn = untrack(() => current !== undefined);
    let amount = $state(untrack(() => (current === undefined ? "" : String(current.minEarned))));
    const made = $derived(chitGateOf(amount));
    const allowed = $derived(made !== undefined && (wasOn || canAdd));

    function save() {
        if (made !== undefined && allowed) onDone(made);
    }
</script>

<BottomSheet
    {open}
    {onClose}
    title={$_(gateLabel.chit_earned_gate)}
    keyboard={softKeyboard.covering}
>
    <form
        class="body"
        onsubmit={(e) => {
            e.preventDefault();
            save();
        }}
    >
        <p class="help">{$_("native.groupSettings.gates.help.chit")}</p>
        <div class="section">
            <ListSectionLabel label={$_("native.groupSettings.gates.minChit")} />
            <span class="field">
                <input
                    value={amount}
                    oninput={(e) => (amount = e.currentTarget.value)}
                    inputmode="numeric"
                    autocomplete="off"
                    aria-label={$_("native.groupSettings.gates.minChit")}
                    placeholder="0"
                />
                <span class="unit">CHIT</span>
            </span>
        </div>
        <Button
            label={$_("native.groupSettings.gates.save")}
            size="lg"
            fullWidth
            disabled={!allowed}
            onClick={save}
        />
        {#if wasOn}
            <button type="button" class="remove-gate" onclick={onRemove}>
                {$_("native.groupSettings.gates.removeGate")}
            </button>
        {/if}
    </form>
</BottomSheet>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .body {
        display: flex;
        flex-direction: column;
        gap: 18px;
        padding: var(--space-4) var(--space-16) var(--space-16);
    }

    .help {
        margin: 0;
        padding: 0 var(--space-4);
        font: var(--weight-regular) text-size(13.5px) / 1.45 var(--font-sans);
        color: var(--ink-3);
        text-wrap: pretty;
    }

    .section {
        display: flex;
        flex-direction: column;
        gap: 8px;
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

    .remove-gate {
        align-self: center;
        min-height: var(--touch-target);
        margin-top: calc(var(--space-8) * -1);
        padding: 0 var(--space-16);
        border: 0;
        background: none;
        font: var(--weight-semibold) text-size(14.5px) / 1 var(--font-sans);
        color: var(--status-danger);
        cursor: pointer;

        &:focus-visible {
            @include focus-ring;
        }
    }
</style>
