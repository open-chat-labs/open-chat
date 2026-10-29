import type { NamedAccount } from "@shared";

/**
 * The saved accounts once `account` is saved. The canister keys a saved account by its account, so
 * saving one already saved renames it in place; anything else is added at the end.
 */
export function withSavedAccount(accounts: NamedAccount[], account: NamedAccount): NamedAccount[] {
    return accounts.some((a) => a.account === account.account)
        ? accounts.map((a) => (a.account === account.account ? account : a))
        : [...accounts, account];
}

/** The saved accounts once `name` is deleted: the canister deletes by name, ignoring case. */
export function withoutAccountsNamed(accounts: NamedAccount[], name: string): NamedAccount[] {
    const lower = name.toLowerCase();
    return accounts.filter((a) => a.name.toLowerCase() !== lower);
}
