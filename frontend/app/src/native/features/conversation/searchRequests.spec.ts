import { describe, expect, test, vi } from "vitest";
import { onSearchRequest, requestSearch } from "./searchRequests";

describe("search requests", () => {
    test("open the search of the conversation for that chat", () => {
        const open = vi.fn();
        const other = vi.fn();
        const off = onSearchRequest("g1", open);
        const offOther = onSearchRequest("g2", other);
        expect(requestSearch("g1")).toBe(true);
        expect(open).toHaveBeenCalledOnce();
        expect(other).not.toHaveBeenCalled();
        off();
        offOther();
    });

    test("find no one once the conversation has gone", () => {
        const open = vi.fn();
        onSearchRequest("g1", open)();
        expect(requestSearch("g1")).toBe(false);
        expect(open).not.toHaveBeenCalled();
    });

    // a conversation that replaced another for the same chat keeps its registration when the old
    // one goes after it
    test("keep the latest conversation's when an older one unregisters", () => {
        const first = vi.fn();
        const second = vi.fn();
        const offFirst = onSearchRequest("g1", first);
        const offSecond = onSearchRequest("g1", second);
        offFirst();
        expect(requestSearch("g1")).toBe(true);
        expect(second).toHaveBeenCalledOnce();
        expect(first).not.toHaveBeenCalled();
        offSecond();
    });
});
