import { describe, expect, test } from "vitest";
import { checkRecipientAddress, checkRecipientName, recipientAddressError } from "./addressBook";

const saved = [{ name: "Exchange", account: "ryjl3-tyaaa-aaaaa-aaaba-cai" }];
const isUserIdAccount = (a: string) => a === "qp43m-xeaaa-aaaaa-qaama-daa";

describe("the addresses the address book saves", () => {
    test("6d invariant 1: only an address addressNetwork recognises, never a MultiUser user id's account", () => {
        expect(checkRecipientAddress("", saved, isUserIdAccount)).toEqual({ kind: "empty" });
        expect(checkRecipientAddress("hello", saved, isUserIdAccount)).toEqual({
            kind: "unsupported",
        });
        expect(
            checkRecipientAddress("qp43m-xeaaa-aaaaa-qaama-daa", saved, isUserIdAccount),
        ).toEqual({ kind: "user_id" });
        expect(
            checkRecipientAddress(
                "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
                saved,
                isUserIdAccount,
            ),
        ).toEqual({ kind: "valid", network: "btc" });
        expect(checkRecipientAddress(" 2vxsx-fae ", saved, isUserIdAccount)).toEqual({
            kind: "valid",
            network: "icrc",
        });
    });

    test("an address already saved is refused, unless it's the one being renamed", () => {
        const address = "ryjl3-tyaaa-aaaaa-aaaba-cai";
        const check = checkRecipientAddress(address, saved, isUserIdAccount);
        expect(check).toEqual({ kind: "saved", name: "Exchange" });
        expect(recipientAddressError(check)).toMatchObject({ key: "addressBook.alreadySaved" });
        expect(checkRecipientAddress(address, saved, isUserIdAccount, address)).toMatchObject({
            kind: "valid",
        });
    });

    test("a name is needed, and not another recipient's in any case", () => {
        expect(checkRecipientName("  ", saved)).toEqual({ kind: "empty" });
        expect(checkRecipientName("exchange", saved)).toEqual({ kind: "taken" });
        // compared as the canister keeps it: a longer name is cut to 25 characters
        const long = [{ name: "Cold storage wallet numbe", account: "ccc" }];
        expect(checkRecipientName("cold storage wallet number two", long)).toEqual({
            kind: "taken",
        });
        expect(checkRecipientName("EXCHANGE", saved, "ryjl3-tyaaa-aaaaa-aaaba-cai")).toEqual({
            kind: "valid",
        });
    });
});
