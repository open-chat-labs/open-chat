// The address book's rules, for every tree's: which addresses can be saved, and which names. The
// client's save and delete keep `namedAccountsStore` as the canister has it.
import type { NamedAccount, ResourceKey } from "@client";
import { i18nKey } from "@src/i18n/i18n";
import { addressNetwork, type AddressNetwork } from "@src/utils/cryptoAddress";
import { isRecipientNameTaken } from "@src/utils/savedRecipient";

/** The canister truncates longer names to this length. */
export const RECIPIENT_NAME_MAX = 25;

/** Whether an address can be saved, and if not, why. */
export type RecipientAddressCheck =
    | { kind: "empty" }
    | { kind: "valid"; network: AddressNetwork }
    // not an address `addressNetwork` recognises: it would save, then fail when sent to
    | { kind: "unsupported" }
    // an account of a MultiUser user id: no one can sign for it
    | { kind: "user_id" }
    // already saved under `name`: saving it again would rename that one
    | { kind: "saved"; name: string };

/**
 * Whether `address` can be saved (6d invariant 1): only an address `addressNetwork` recognises, and
 * never an account of a MultiUser user id, nor one already saved (other than `editingAccount`, the
 * one being renamed).
 */
export function checkRecipientAddress(
    address: string,
    saved: NamedAccount[],
    isUserIdAccount: (address: string) => boolean,
    editingAccount?: string,
): RecipientAddressCheck {
    const text = address.trim();
    if (text.length === 0) return { kind: "empty" };
    if (isUserIdAccount(text)) return { kind: "user_id" };
    const network = addressNetwork(text);
    if (network === undefined) return { kind: "unsupported" };
    const existing = saved.find((a) => a.account === text && a.account !== editingAccount);
    if (existing !== undefined) return { kind: "saved", name: existing.name };
    return { kind: "valid", network };
}

/** What to say about an address that can't be saved, as the old address book words it. */
export function recipientAddressError(check: RecipientAddressCheck): ResourceKey | undefined {
    switch (check.kind) {
        case "user_id":
            return i18nKey("cryptoAccount.sendToUserId");
        case "unsupported":
            return i18nKey("addressBook.invalidAddress");
        case "saved":
            return i18nKey("addressBook.alreadySaved", { name: check.name });
        default:
            return undefined;
    }
}

/** Whether a name can be saved: not empty, and not another recipient's, ignoring case. */
export type RecipientNameCheck = { kind: "valid" } | { kind: "empty" } | { kind: "taken" };

export function checkRecipientName(
    name: string,
    saved: NamedAccount[],
    exceptAccount?: string,
): RecipientNameCheck {
    const text = name.trim();
    if (text.length === 0) return { kind: "empty" };
    if (isRecipientNameTaken(saved, text, exceptAccount)) return { kind: "taken" };
    return { kind: "valid" };
}
