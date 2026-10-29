import { describe, expect, test } from "vitest";
import { savedAccountName, withoutAccountsNamed, withSavedAccount } from "./namedAccounts";

const saved = [
    { name: "Exchange", account: "aaa" },
    { name: "Cold wallet", account: "bbb" },
];

describe("the saved accounts", () => {
    test("6d invariant 2: saving an account already saved renames it, leaving one entry for it", () => {
        expect(withSavedAccount(saved, { name: "Kraken", account: "aaa" })).toEqual([
            { name: "Kraken", account: "aaa" },
            { name: "Cold wallet", account: "bbb" },
        ]);
        expect(withSavedAccount(saved, { name: "New", account: "ccc" })).toHaveLength(3);
    });

    test("6d invariant 3: deleting a name removes every entry with it, ignoring case, as the canister does", () => {
        const twice = [...saved, { name: "EXCHANGE", account: "ccc" }];
        expect(withoutAccountsNamed(twice, "exchange")).toEqual([
            { name: "Cold wallet", account: "bbb" },
        ]);
    });

    test("a name is kept as the canister keeps it: trimmed and cut to 25 characters", () => {
        const long = "  Internet Computer recipient  ";
        expect(savedAccountName(long)).toBe("Internet Computer recipie");
        expect(withSavedAccount([], { name: long, account: "ccc" })).toEqual([
            { name: "Internet Computer recipie", account: "ccc" },
        ]);
        const saved = withSavedAccount([], { name: long, account: "ccc" });
        expect(withoutAccountsNamed(saved, long)).toEqual([]);
    });
});
