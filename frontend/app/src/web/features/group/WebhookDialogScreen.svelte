<!-- Registering or editing a group's or channel's webhook (WebhookDialog): its name and avatar sent
     through saveWebhook (only what changed), and in edit mode its URL, which needs the secret
     (getWebhook) and can be regenerated, or the webhook deleted. A new webhook opens straight away in edit mode, to show
     its URL. -->
<script lang="ts">
    import {
        chatIdentifiersEqual,
        selectedChatSummaryStore,
        selectedChatWebhooksStore,
        webhookFailure,
        type OpenChat,
    } from "@client";
    import WebhookDialog, {
        type WebhookSave,
    } from "@openchat/ui/src/features/components/WebhookDialog.svelte";
    import { i18nKey } from "@src/i18n/i18n";
    import { toastStore } from "@src/stores/toast";
    import { AVATAR_SIZE, cropCentred } from "@src/utils/imageCrop";
    import { getContext, onMount, untrack } from "svelte";
    import type { DialogProps, LocalDialog } from "../app/dialogs";

    let { dialog, onClose, dialogs }: DialogProps<Extract<LocalDialog, { kind: "webhook" }>> =
        $props();

    const client = getContext<OpenChat>("client");

    const chat = $derived(
        ($selectedChatSummaryStore?.kind === "group_chat" ||
            $selectedChatSummaryStore?.kind === "channel") &&
            chatIdentifiersEqual($selectedChatSummaryStore.id, dialog.chatId)
            ? $selectedChatSummaryStore
            : undefined,
    );

    // the webhook as it was opened: a save is measured against it
    const original = untrack(() =>
        dialog.webhookId === undefined
            ? undefined
            : $selectedChatWebhooksStore.get(dialog.webhookId),
    );

    // its URL needs its secret, which only the chat hands out
    let url = $state("");
    onMount(async () => {
        if (original === undefined) return;
        const secret = await client.getWebhook(dialog.chatId, original.id);
        url = client.webhookUrl({ id: original.id, secret }, dialog.chatId) ?? "";
    });

    // the others' names: the one being edited is left out by id, as a save renames it locally at
    // once and the new name would read as taken while the save is in flight
    const takenNames = $derived(
        [...$selectedChatWebhooksStore.values()]
            .filter((w) => w.id !== original?.id)
            .map((w) => w.name),
    );

    // the dialog keeps the form and says it couldn't save when these reject
    async function save(hook: WebhookSave) {
        const avatarUrl = hook.avatar
            ? (await cropCentred(hook.avatar, AVATAR_SIZE))?.url
            : hook.removeAvatar
              ? undefined
              : original?.avatarUrl;
        const outcome = await client.saveWebhook(dialog.chatId, original, hook.name, avatarUrl);
        if (outcome.kind === "failed") {
            toastStore.showFailureToast(outcome.message);
            throw new Error("not saved");
        }
        // a new webhook's URL holds its secret: show it, as the old page did
        if (outcome.kind === "registered") {
            dialogs.open({ kind: "webhook", chatId: dialog.chatId, webhookId: outcome.webhook.id });
        }
    }

    async function remove(hook: { id: string }) {
        if (!(await client.deleteWebhook(dialog.chatId, hook.id))) {
            toastStore.showFailureToast(i18nKey("webhook.removeFailed"));
            throw new Error("not deleted");
        }
    }

    async function regenerate(hook: { id: string }) {
        const secret = await client.regenerateWebhook(dialog.chatId, hook.id);
        const regenerated = secret && client.webhookUrl({ id: hook.id, secret }, dialog.chatId);
        if (!regenerated) {
            toastStore.showFailureToast(webhookFailure("regenerate"));
            throw new Error("not regenerated");
        }
        url = regenerated;
        return { url: regenerated };
    }
</script>

{#if chat !== undefined && (dialog.webhookId === undefined || original !== undefined)}
    <WebhookDialog
        dialogMode={original === undefined ? "register" : "edit"}
        webhook={original === undefined
            ? null
            : { id: original.id, name: original.name, url, avatarUrl: original.avatarUrl ?? null }}
        groupName={chat.name}
        {takenNames}
        onSave={save}
        onRegenerate={original === undefined ? undefined : regenerate}
        onDelete={original === undefined ? undefined : remove}
        onCancel={onClose}
    />
{/if}
