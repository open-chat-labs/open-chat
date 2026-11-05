<!-- Reporting a message to the platform's moderators (5b), as the old report dialogs did: why
     (REPORT_REASONS, child sexual content with its warning: that report removes the message at
     once), whether to delete it too where the reader can delete others' messages, and the advice
     to go to the group's owners first.
     TODO(design): the design has no report dialog; DialogShell with the old dialog's words. -->
<script lang="ts">
    import {
        i18nKey,
        isCsamReport,
        REPORT_REASONS,
        reportReasonText,
        type OpenChat,
        type ReportReason,
    } from "@client";
    import Banner from "@openchat/ui/src/lib/components/Banner.svelte";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import DialogShell from "@openchat/ui/src/lib/components/DialogShell.svelte";
    import DurationChips from "@openchat/ui/src/lib/components/DurationChips.svelte";
    import Toggle from "@openchat/ui/src/lib/components/Toggle.svelte";
    import Markdown from "@src/core/Markdown.svelte";
    import { interpolate } from "@src/i18n/i18n";
    import { toastStore } from "@src/stores/toast";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import type { DialogProps, LocalDialog } from "../app/dialogs";

    let { dialog, onClose }: DialogProps<Extract<LocalDialog, { kind: "report_message" }>> =
        $props();

    const client = getContext<OpenChat>("client");

    let reason = $state<ReportReason>();
    let deleteToo = $state(false);

    // the reasons as the chips show them (by their text), and back
    const labels = $derived(REPORT_REASONS.map((r) => interpolate($_, reportReasonText(r))));

    function pick(label: string) {
        reason = REPORT_REASONS[labels.indexOf(label)];
    }

    // sent, and the dialog closed: a toast says how it went, as the old dialogs did
    async function report(chosen: ReportReason) {
        onClose();
        const reported = await client.reportMessage(
            dialog.chatId,
            dialog.threadRootMessageIndex,
            dialog.messageId,
            dialog.canDelete && deleteToo,
            chosen,
        );
        if (reported) {
            toastStore.showSuccessToast(i18nKey("report.success"));
        } else {
            toastStore.showFailureToast(i18nKey("report.failure"));
        }
    }
</script>

<DialogShell title={$_("report.title")} width={460} height="auto" {onClose}>
    <div class="body">
        <DurationChips
            branch={false}
            title={$_("report.reason")}
            options={labels}
            value={reason === undefined ? "" : labels[REPORT_REASONS.indexOf(reason)]}
            onChange={pick} />
        {#if isCsamReport(reason)}
            <Banner tone="danger" text={$_("report.csamWarning")} />
        {/if}
        {#if dialog.canDelete}
            <Toggle
                label={$_("report.deleteMessage")}
                on={deleteToo}
                onChange={(on) => (deleteToo = on)} />
        {/if}
        <div class="advice">
            <Markdown
                text={$_("report.advice", {
                    values: { rules: "https://oc.app/guidelines?section=3" },
                })} />
        </div>
        <div class="actions">
            <Button label={$_("cancel")} variant="secondary" onClick={onClose} />
            <Button
                label={$_("report.menu")}
                variant="danger"
                disabled={reason === undefined}
                onClick={() => reason !== undefined && report(reason)} />
        </div>
    </div>
</DialogShell>

<style lang="scss">
    .body {
        display: flex;
        flex-direction: column;
        gap: var(--space-16);
    }

    .advice {
        font: var(--weight-regular) var(--text-sm) / 1.5 var(--font-sans);
        color: var(--ink-3);
    }

    .actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--space-8);
    }
</style>
