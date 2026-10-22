import { describe, expect, test } from "vitest";
import { isRecipientNameTaken, recipientToSave } from "./savedRecipient";

const saved = { name: "Alice", account: "2vxsx-fae" };
const other = { name: "Bob", account: "aaaaa-aa" };

describe("saved recipients", () => {
    test("editing a saved recipient never leaves two entries for it: it saves under the existing account", () => {
        expect(recipientToSave(saved, "Alice2", other.account)).toEqual({
            name: "Alice2",
            account: saved.account,
        });
        expect(recipientToSave(undefined, "Carol", other.account)).toEqual({
            name: "Carol",
            account: other.account,
        });
    });

    test("a name is taken by another recipient ignoring case, but not by the one being renamed", () => {
        expect(isRecipientNameTaken([saved, other], "BOB")).toBe(true);
        expect(isRecipientNameTaken([saved, other], "BOB", saved.account)).toBe(true);
        expect(isRecipientNameTaken([saved, other], "ALICE", saved.account)).toBe(false);
    });
});
