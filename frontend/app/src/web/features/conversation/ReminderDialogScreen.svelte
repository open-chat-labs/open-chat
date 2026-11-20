<!-- Setting a reminder about a message (5b), as the old desktop dialog did: a preset time
     (reminderTime: in 20 minutes, 1 or 3 hours, tomorrow or next Monday at 9am) or one the user
     picks, an optional note, and when it will go off.
     TODO(design): the design has no reminder dialog or date and time picker; DialogShell with the
     old dialog's words, and the browser's own date and time field for a custom time. -->
<script lang="ts">
    import {
        allChatsStore,
        i18nKey,
        REMINDER_PRESETS,
        reminderPresetText,
        reminderTime,
        type OpenChat,
        type ReminderPreset,
    } from "@client";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import DialogShell from "@openchat/ui/src/lib/components/DialogShell.svelte";
    import DurationChips from "@openchat/ui/src/lib/components/DurationChips.svelte";
    import TextArea from "@openchat/ui/src/lib/components/TextArea.svelte";
    import { getToastHost } from "@openchat/ui/src/lib/toasts.svelte";
    import { interpolateNewUi } from "@src/i18n/i18n";
    import {
        OPENCHAT_BOT_DM,
        reminderConfirmationRoute,
        reminderSetText,
    } from "@src/logic/conversation/reminderSet";
    import { now } from "@src/stores/time";
    import { toastStore } from "@src/stores/toast";
    import { navigate } from "@src/utils/navigation";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { UNDO_TOAST_MS } from "../../shell/pendingToast";
    import type { DialogProps, LocalDialog } from "../app/dialogs";

    let { dialog, onClose }: DialogProps<Extract<LocalDialog, { kind: "remind_message" }>> =
        $props();

    const client = getContext<OpenChat>("client");
    // the app's library toast layer (App), which outlasts the dialog and shows an action
    const toastHost = getToastHost();

    let when = $state<ReminderPreset | "custom">("twentyMinutes");
    // the custom time, as the date and time field holds it (local time)
    let custom = $state("");
    let note = $state("");

    const presets = $derived(REMINDER_PRESETS.map((p) => interpolateNewUi($_, reminderPresetText(p))));
    const customLabel = $derived($_("reminders.custom"));

    function pick(label: string) {
        when = label === customLabel ? "custom" : (REMINDER_PRESETS[presets.indexOf(label)] ?? when);
    }

    // when it goes off (ms); none for a custom time not given yet
    const remindAt = $derived.by(() => {
        if (when !== "custom") return reminderTime(when, $now);
        const at = custom === "" ? NaN : new Date(custom).getTime();
        return Number.isNaN(at) ? undefined : at;
    });
    const valid = $derived(remindAt !== undefined && remindAt > $now);

    // the earliest the field offers: now, in local time
    const earliest = $derived.by(() => {
        const d = new Date($now);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().slice(0, 16);
    });

    // set, and the dialog closed: a toast says how it went, as the old dialog did. Set, it says when
    // it goes off, with View: the OpenChat Bot's DM, where its "I will remind you about this
    // message at …" (with Cancel reminder) lands. The DM opens at its latest message, not at its
    // first unread (reminderConfirmationRoute): that message arrives after the call returns, so
    // its index isn't known here, but by the time View is used it's normally the latest.
    async function create(at: number) {
        // the words, read while the dialog is still mounted
        const formatter = $_;
        onClose();
        const set = await client.setMessageReminder(
            dialog.chatId,
            dialog.eventIndex,
            at,
            note.trim() === "" ? undefined : note.trim(),
            dialog.threadRootMessageIndex,
        );
        if (!set) {
            toastStore.showFailureToast(i18nKey("reminders.failure"));
            return;
        }
        const message = reminderSetText(at, Date.now(), {
            time: (d) => client.toShortTimeString(d),
            date: (d) => client.toDateString(d),
        });
        if (toastHost === undefined) {
            toastStore.showSuccessToast(message);
            return;
        }
        toastHost({
            message: interpolateNewUi(formatter, message),
            tone: "success",
            icon: "check",
            actionLabel: formatter("reminders.view"),
            // as long as a toast offering Undo, so there's time to use View
            duration: UNDO_TOAST_MS,
            // the DM as the chat list has it when View is used, by then usually with the bot's
            // confirmation as its latest message
            onAction: () =>
                navigate(reminderConfirmationRoute(allChatsStore.value.get(OPENCHAT_BOT_DM))),
        });
    }
</script>

<DialogShell title={$_("reminders.title")} width={460} height="auto" {onClose}>
    <div class="body">
        <DurationChips
            branch={false}
            title={$_("reminders.menu")}
            options={[...presets, customLabel]}
            value={when === "custom" ? customLabel : presets[REMINDER_PRESETS.indexOf(when)]}
            onChange={pick} />
        {#if when === "custom"}
            <input
                class="custom"
                type="datetime-local"
                min={earliest}
                aria-label={$_("reminders.customPlaceholder")}
                bind:value={custom} />
        {/if}
        <TextArea
            value={note}
            placeholder={$_("reminders.notePlaceholder")}
            help={`${$_("reminders.note")} (${$_("reminders.optional")})`}
            maxLength={1000}
            onInput={(e) => (note = e.currentTarget.value)} />
        {#if remindAt !== undefined}
            <p class="when">
                {$_("reminders.remindAt", {
                    values: { datetime: client.toDatetimeString(new Date(remindAt)) },
                })}
            </p>
        {/if}
        <div class="actions">
            <Button label={$_("cancel")} variant="secondary" onClick={onClose} />
            <Button
                label={$_("reminders.create")}
                disabled={!valid}
                onClick={() => valid && remindAt !== undefined && create(remindAt)} />
        </div>
    </div>
</DialogShell>

<style lang="scss">
    .body {
        display: flex;
        flex-direction: column;
        gap: var(--space-16);
    }

    .custom {
        box-sizing: border-box;
        width: 100%;
        padding: var(--space-10) var(--space-14);
        border: none;
        border-radius: var(--radius-md);
        background: var(--surface-2);
        box-shadow: inset 0 0 0 1px var(--line-2);
        color: var(--ink);
        font: var(--weight-regular) var(--text-base) / 1.4 var(--font-sans);
        color-scheme: light dark;
    }

    .when {
        margin: 0;
        font: var(--weight-regular) var(--text-sm) / 1.5 var(--font-sans);
        color: var(--ink-3);
    }

    .actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--space-8);
    }
</style>
