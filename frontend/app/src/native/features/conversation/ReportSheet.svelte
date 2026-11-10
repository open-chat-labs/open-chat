<!-- Reporting a message to the platform's moderators (from its long-press menu), as the web's
     report dialog and the old ones: why (REPORT_REASONS; child sexual content with its warning,
     as that report removes the message at once), whether to delete it too where the reader can
     delete others' messages, the advice to go to the group's owners first, and Report.
     TODO(design): the design has no report sheet; a picker sheet (notes §1) with the old words. -->
<script lang="ts">
    import { isCsamReport, REPORT_REASONS, reportReasonText, type ReportReason } from "@client";
    import Banner from "@openchat/ui/src/lib/components/Banner.svelte";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import Toggle from "@openchat/ui/src/lib/components/Toggle.svelte";
    import BottomSheet from "@openchat/ui/src/native/BottomSheet.svelte";
    import Markdown from "@src/core/Markdown.svelte";
    import { interpolate } from "@src/i18n/i18n";
    import { _ } from "svelte-i18n";

    type Props = {
        open: boolean;
        /** The reader can delete others' messages here: offer to delete it too. */
        canDelete: boolean;
        onClose: () => void;
        /** Report it, for this reason (and delete it too); the sheet asks to close next. */
        onReport: (reason: ReportReason, deleteToo: boolean) => void;
    };

    let { open, canDelete, onClose, onReport }: Props = $props();

    let reason = $state<ReportReason>();
    let deleteToo = $state(false);

    // a new opening starts afresh
    $effect.pre(() => {
        if (!open) return;
        reason = undefined;
        deleteToo = false;
    });

    function report() {
        if (reason === undefined) return;
        const chosen = reason;
        onReport(chosen, canDelete && deleteToo);
        onClose();
    }
</script>

<BottomSheet {open} {onClose} title={$_("report.title")} height="86%">
    <div class="body">
        <span class="label">{$_("report.reason")}</span>
        <div class="reasons" role="radiogroup" aria-label={$_("report.reason")}>
            {#each REPORT_REASONS as r (r)}
                <button
                    type="button"
                    class="reason"
                    class:on={reason === r}
                    role="radio"
                    aria-checked={reason === r}
                    onclick={() => (reason = r)}>
                    <span class="text">{interpolate($_, reportReasonText(r))}</span>
                    <span class="dot" aria-hidden="true"></span>
                </button>
            {/each}
        </div>
        {#if isCsamReport(reason)}
            <Banner tone="danger" text={$_("report.csamWarning")} />
        {/if}
        {#if canDelete}
            <div class="toggle">
                <Toggle
                    label={$_("report.deleteMessage")}
                    on={deleteToo}
                    onChange={(on) => (deleteToo = on)} />
            </div>
        {/if}
        <div class="advice">
            <Markdown
                text={$_("report.advice", {
                    values: { rules: "https://oc.app/guidelines?section=3" },
                })} />
        </div>
    </div>
    <div class="foot">
        <Button
            label={$_("report.menu")}
            variant="danger"
            size="lg"
            fullWidth
            disabled={reason === undefined}
            onClick={report} />
    </div>
</BottomSheet>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .body {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        display: flex;
        flex-direction: column;
        gap: var(--space-12);
        padding: var(--space-4) var(--space-16) var(--space-16);
    }

    .label {
        padding: var(--space-8) var(--space-4) 0;
        font: var(--weight-semibold) text-size(12px) / 1.2 var(--font-sans);
        color: var(--ink-4);
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    // picker rows, 6px apart (notes §1 Spacing)
    .reasons {
        display: flex;
        flex-direction: column;
        gap: var(--space-6);
    }

    .reason {
        display: flex;
        align-items: center;
        gap: var(--space-12);
        min-height: 56px;
        padding: var(--space-8) var(--space-14);
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

        &.on {
            background: color-mix(in oklch, var(--accent) 14%, transparent);
        }
    }

    .text {
        flex: 1;
        min-width: 0;
        font: var(--weight-medium) text-size(14.5px) / 1.35 var(--font-sans);
    }

    // a radio: a ring, filled once picked
    .dot {
        flex: none;
        width: 22px;
        height: 22px;
        box-sizing: border-box;
        border-radius: var(--radius-circle);
        border: 2px solid var(--overlay-3);

        .on & {
            border: 6px solid var(--accent);
        }
    }

    .toggle {
        padding: var(--space-4) var(--space-4) 0;
    }

    .advice {
        padding: 0 var(--space-4);
        font: var(--weight-regular) text-size(13px) / 1.5 var(--font-sans);
        color: var(--ink-3);
    }

    .foot {
        flex: none;
        padding: var(--space-10) var(--space-16) var(--space-12);
        box-shadow: inset 0 1px 0 var(--line-1);
    }
</style>
