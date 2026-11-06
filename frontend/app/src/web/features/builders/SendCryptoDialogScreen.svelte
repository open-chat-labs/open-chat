<!-- The composer's "+" → Send crypto (5d): SendCryptoDialog, whose transfer is attached to the
     chat's draft (the mobile app's way) and made when the message is sent, with the PIN asked for
     then. The token starts at the one last sent, else ICP, among those the wallet holds; the
     recipient is the DM's other user, or in a group the one being replied to (never the user,
     never a bot), to change from the chat's members. CryptoTransferForm (logic/cryptoTransfer,
     shared with both old builders) reads what was typed and checks it before it's attached.
     Opened again from the composer's chip, it edits the staged transfer. Pays from the OpenChat
     wallet only (GAPS: no external wallet picker). -->
<script lang="ts">
    import {
        allUsersStore,
        chatIdentifiersEqual,
        currentUserIdStore,
        enhancedCryptoLookup,
        exchangeRatesLookupStore,
        i18nKey,
        lastCryptoSent,
        LEDGER_CANISTER_ICP,
        selectedChatMembersStore,
        selectedChatSummaryStore,
        walletTokensSorted,
        type OpenChat,
    } from "@client";
    import SendCryptoDialog from "@openchat/ui/src/features/components/SendCryptoDialog.svelte";
    import type { Transfer } from "@openchat/ui/src/lib/types";
    import { CryptoTransferForm } from "@src/logic/cryptoTransfer/cryptoTransferForm.svelte";
    import { toastStore } from "@src/stores/toast";
    import { getContext, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import type { DialogProps, LocalDialog } from "../app/dialogs";
    import { builderTokens, composerTransfer, cryptoMember } from "./builders.adapter";

    let { dialog, onClose }: DialogProps<Extract<LocalDialog, { kind: "send_crypto" }>> =
        $props();

    const client = getContext<OpenChat>("client");

    const editing = untrack(() => dialog.editing);
    const editedLedger =
        editing?.transfer.kind === "pending" ? editing.transfer.ledger : undefined;
    const first = editedLedger ?? lastCryptoSent.value ?? LEDGER_CANISTER_ICP;

    // the chat it was opened in (another chat being opened closes it)
    const chat = untrack(() => $selectedChatSummaryStore);
    const form = untrack(() =>
        chat === undefined || !chatIdentifiersEqual(chat.id, dialog.chatId)
            ? undefined
            : new CryptoTransferForm(client, first, chat, dialog.defaultReceiver, 0n, {
                  refreshBalance: false,
              }),
    );
    $effect(() => {
        if (form === undefined) onClose();
    });

    // the tokens held (an edited transfer's too, to keep it)
    const tokens = $derived(
        builderTokens(
            $walletTokensSorted.filter((t) => t.balance > 0n || t.ledger === editedLedger),
            $exchangeRatesLookupStore,
            first,
        ),
    );

    const them = $derived(
        chat?.kind === "direct_chat" ? $allUsersStore.get(chat.them.userId) : undefined,
    );

    // whoever else in the chat can be paid: not the user, not a bot
    const members = $derived(
        chat?.kind === "direct_chat"
            ? []
            : [...$selectedChatMembersStore.keys()].flatMap((userId) => {
                  const user = $allUsersStore.get(userId);
                  return user === undefined ||
                      user.kind === "bot" ||
                      userId === $currentUserIdStore
                      ? []
                      : [cryptoMember(user)];
              }),
    );

    const initial = $derived.by((): Transfer | null => {
        if (editing === undefined || editedLedger === undefined) return null;
        const token = $enhancedCryptoLookup.get(editedLedger);
        if (token === undefined) return null;
        const recipient =
            editing.transfer.kind === "pending"
                ? $allUsersStore.get(editing.transfer.recipient)
                : undefined;
        return (
            composerTransfer(
                editing,
                token,
                $exchangeRatesLookupStore.get(editedLedger)?.toUSD,
                recipient,
                (key, values) => $_(key, { values }),
            ) ?? null
        );
    });

    function attach(transfer: Transfer) {
        if (form === undefined) return;
        const ledger = tokens.find((t) => t.token.symbol === transfer.token.symbol)?.ledger;
        const outcome =
            ledger === undefined
                ? "invalid"
                : form.attachTyped(
                      { chatId: dialog.chatId },
                      ledger,
                      transfer.draft.amt,
                      transfer.recipient.id,
                  );
        if (outcome === "attached") {
            onClose();
        } else {
            toastStore.showFailureToast(i18nKey("builders.paymentRefused"));
        }
    }
</script>

{#if form !== undefined}
    <SendCryptoDialog
        tokens={tokens.map((t) => t.token)}
        recipient={them === undefined ? null : cryptoMember(them)}
        {members}
        to={form.receiver?.userId ?? null}
        {initial}
        onAttach={attach}
        {onClose} />
{/if}
