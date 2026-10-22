import type { NamedAccount } from "@client";

/**
 * Whether a saved recipient other than `exceptAccount` already has this name. The canister keeps
 * names unique ignoring case, so a recipient being renamed may keep its own name in another case.
 */
export function isRecipientNameTaken(
    accounts: NamedAccount[],
    name: string,
    exceptAccount?: string,
): boolean {
    const nameLower = name.toLowerCase();
    return accounts.some((a) => a.account !== exceptAccount && a.name.toLowerCase() === nameLower);
}

/**
 * The recipient to save from the add/edit form. The canister keys a saved recipient by its account
 * and renames it when it is saved again, so an edit always saves under the existing account: saving
 * a new address would add a second recipient and leave the old one. Changing an address means
 * deleting the recipient and adding a new one.
 */
export function recipientToSave(
    editing: NamedAccount | undefined,
    name: string,
    address: string,
): NamedAccount {
    return { name, account: editing?.account ?? address };
}
