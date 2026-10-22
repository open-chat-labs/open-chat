// The state and logic for sending tokens to a user in a chat, so that the components in both trees
// can be as purely presentational as possible. It returns outcomes; each tree shows them.

import {
    allUsersStore,
    currentUserIdStore,
    localUpdates,
    nowNanos,
    type ChatSummary,
    type CryptoTransferOutcome,
    type MessageContext,
    type OpenChat,
    type PendingCryptocurrencyTransfer,
    type UserSummary,
} from "@client";
import { TransferForm, type TransferFormOptions } from "../wallet/transferForm.svelte";

// Who the tokens go to unless the user picks someone else: the other user in a direct chat, or
// the user being replied to, but never the user themselves
function defaultRecipient(
    chat: ChatSummary,
    defaultReceiver: string | undefined,
): UserSummary | undefined {
    if (chat.kind === "direct_chat") {
        return allUsersStore.value.get(chat.them.userId);
    }
    if (defaultReceiver !== undefined && defaultReceiver !== currentUserIdStore.value) {
        return allUsersStore.value.get(defaultReceiver);
    }
    return undefined;
}

export class CryptoTransferForm extends TransferForm {
    #chat: ChatSummary;
    receiver = $state<UserSummary>();

    /**
     * `defaultReceiver` is who the tokens go to if the user doesn't choose, and `amount` is the
     * amount to start from, eg. from a /crypto command.
     */
    constructor(
        client: OpenChat,
        ledger: string,
        chat: ChatSummary,
        defaultReceiver: string | undefined,
        amount: bigint,
        options: TransferFormOptions = {},
    ) {
        super(client, ledger, options);
        this.#chat = chat;
        this.tokenState.draftAmount = amount;
        this.receiver = defaultRecipient(chat, defaultReceiver);
    }

    // Only a chat with more than one other user needs the recipient chosen
    get multiUserChat(): boolean {
        return this.#chat.kind === "group_chat" || this.#chat.kind === "channel";
    }

    // At least the minimum, and no more than the OpenChat account can pay with the fees
    get validAmount(): boolean {
        const amount = this.tokenState.draftAmount;
        const limit = this.spendingLimit;
        return (
            amount > 0n &&
            amount >= this.tokenState.minAmount &&
            (limit === undefined || amount <= limit)
        );
    }

    get valid(): boolean {
        return this.validAmount && this.receiver !== undefined && !this.tokenChanging;
    }

    /**
     * Attaches the transfer to the message being written; it is made when the message is sent. An
     * external wallet's approval is not asked for here: it would spend a tap on an allowance the
     * user may abandon without sending. Instead the draft carries the chosen wallet as
     * `fromWallet`, and the send itself asks for the approval, from the tap which consumes it.
     */
    attach(messageContext: MessageContext) {
        const recipient = this.receiver;
        if (recipient === undefined) return;
        localUpdates.draftMessages.setAttachment(messageContext, {
            kind: "crypto_content",
            transfer: this.#transfer(recipient.userId, { fromWallet: this.sourceWallet?.id }),
        });
    }

    /**
     * Sends the transfer in a message now. `fromAccount` is an external wallet which has just
     * approved us taking the transfer; without it the funds come from the user's own OpenChat
     * account.
     */
    send(
        messageContext: MessageContext,
        caption: string,
        fromAccount?: string,
    ): Promise<CryptoTransferOutcome> {
        const recipient = this.receiver;
        if (recipient === undefined) return Promise.resolve({ kind: "cancelled" });
        return this.client.sendCryptoTransfer(
            messageContext,
            this.#transfer(recipient.userId, { fromAccount }),
            caption,
        );
    }

    #transfer(
        recipient: string,
        from: { fromAccount?: string; fromWallet?: string },
    ): PendingCryptocurrencyTransfer {
        return {
            kind: "pending",
            ledger: this.tokenState.ledger,
            token: this.tokenState.symbol,
            recipient,
            amountE8s: this.tokenState.draftAmount,
            feeE8s: this.tokenState.transferFee,
            createdAtNanos: nowNanos(),
            ...from,
        };
    }
}
