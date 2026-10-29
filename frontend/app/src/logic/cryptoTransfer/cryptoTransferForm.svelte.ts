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
// the user being replied to, but never the user themselves, nor a bot (see `canBePaid`)
function defaultRecipient(
    chat: ChatSummary,
    defaultReceiver: string | undefined,
): UserSummary | undefined {
    const userId =
        chat.kind === "direct_chat"
            ? chat.them.userId
            : defaultReceiver !== currentUserIdStore.value
              ? defaultReceiver
              : undefined;
    const user = userId === undefined ? undefined : allUsersStore.value.get(userId);
    return user !== undefined && canBePaid(user) ? user : undefined;
}

// A bot, or a webhook, has no wallet: its id isn't an account anyone controls, so tokens sent to
// it would be lost
function canBePaid(user: UserSummary): boolean {
    return user.kind !== "bot";
}

/** The token a transfer is in, as its ledger has it: the fee is always the ledger's. */
export type TransferToken = { ledger: string; symbol: string; transferFee: bigint };

/**
 * A transfer of `amount` to `recipient`, paying the ledger's fee. `fromAccount` is an external
 * wallet which has approved us taking it, `fromWallet` the one a draft will ask; without either the
 * funds come from the user's own OpenChat account.
 */
export function pendingTransfer(
    token: TransferToken,
    recipient: string,
    amount: bigint,
    from: { fromAccount?: string; fromWallet?: string } = {},
): PendingCryptocurrencyTransfer {
    return {
        kind: "pending",
        ledger: token.ledger,
        token: token.symbol,
        recipient,
        amountE8s: amount,
        feeE8s: token.transferFee,
        createdAtNanos: nowNanos(),
        ...from,
    };
}

/**
 * Sends `amount` to a user in a message in the direct chat with them, from the user's own
 * OpenChat account (the wallets' Send to a user, which only offers users already DM'd).
 */
export function sendInDirectChat(
    client: Pick<OpenChat, "sendCryptoTransfer">,
    token: TransferToken,
    userId: string,
    amount: bigint,
    caption: string,
): Promise<CryptoTransferOutcome> {
    return client.sendCryptoTransfer(
        { chatId: { kind: "direct_chat", userId } },
        pendingTransfer(token, userId, amount),
        caption,
    );
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
        return (
            this.validAmount &&
            this.receiver !== undefined &&
            canBePaid(this.receiver) &&
            !this.tokenChanging
        );
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
            transfer: pendingTransfer(
                this.tokenState,
                recipient.userId,
                this.tokenState.draftAmount,
                { fromWallet: this.sourceWallet?.id },
            ),
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
            pendingTransfer(this.tokenState, recipient.userId, this.tokenState.draftAmount, {
                fromAccount,
            }),
            caption,
        );
    }
}
