import type { NamedAccount } from "@shared";

/** The canister trims a saved account's name and cuts it to this many characters. */
export const SAVED_ACCOUNT_NAME_MAX = 25;

/** A name as the canister keeps it: trimmed, and cut to `SAVED_ACCOUNT_NAME_MAX` characters. */
export function savedAccountName(name: string): string {
    // by characters (code points), as the canister counts them, so an emoji isn't split in two
    return Array.from(name.trim()).slice(0, SAVED_ACCOUNT_NAME_MAX).join("");
}

/**
 * The saved accounts once `account` is saved, its name as the canister keeps it. The canister keys
 * a saved account by its account, so saving one already saved renames it in place; anything else
 * is added at the end.
 */
export function withSavedAccount(accounts: NamedAccount[], account: NamedAccount): NamedAccount[] {
    const saved = { ...account, name: savedAccountName(account.name) };
    return accounts.some((a) => a.account === saved.account)
        ? accounts.map((a) => (a.account === saved.account ? saved : a))
        : [...accounts, saved];
}

/** The saved accounts once `name` is deleted: the canister deletes by name, ignoring case. */
export function withoutAccountsNamed(accounts: NamedAccount[], name: string): NamedAccount[] {
    const lower = savedAccountName(name).toLowerCase();
    return accounts.filter((a) => a.name.toLowerCase() !== lower);
}
