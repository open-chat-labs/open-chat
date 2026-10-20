import { AutoUnarchive, type ArchiveState } from "./autoUnarchive";

const chat = (archived: boolean, unread: number): ArchiveState => ({ id: "a", archived, unread });

describe("unarchiving chats with unread messages", () => {
    test("asks for an archived chat with unread messages, once", () => {
        const auto = new AutoUnarchive();
        expect(auto.next([chat(true, 0), { id: "b", archived: false, unread: 3 }])).toEqual([]);
        expect(auto.next([chat(true, 2)])).toEqual(["a"]);
        expect(auto.next([chat(true, 3)])).toEqual([]);
    });

    test("doesn't ask again when the request fails, though the chat is archived again", () => {
        const auto = new AutoUnarchive();
        expect(auto.next([chat(true, 1)])).toEqual(["a"]);
        // the client unarchives the chat before the request settles, then undoes it
        expect(auto.next([chat(false, 1)])).toEqual([]);
        expect(auto.next([chat(true, 1)])).toEqual([]);
        auto.settled("a");
        expect(auto.next([chat(true, 1)])).toEqual([]);
    });

    test("asks again for a chat archived again after it came out", () => {
        const auto = new AutoUnarchive();
        auto.next([chat(true, 1)]);
        auto.settled("a");
        expect(auto.next([chat(false, 0)])).toEqual([]);
        expect(auto.next([chat(true, 1)])).toEqual(["a"]);
    });
});
