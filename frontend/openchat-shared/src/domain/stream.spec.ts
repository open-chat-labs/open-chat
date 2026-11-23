import { describe, expect, test, vi } from "vitest";
import { Stream } from "./stream";

describe("a stream made by an async initialiser (fromAsync)", () => {
    test("a result given before its first await reaches the subscriber", async () => {
        const onResult = vi.fn();
        Stream.fromAsync<string>(async (resolve) => resolve("offline", true)).subscribe({
            onResult,
        });
        await Promise.resolve();
        await Promise.resolve();
        expect(onResult).toHaveBeenCalledWith("offline", true);
    });

    test("an error it throws rejects the stream", async () => {
        const onError = vi.fn();
        Stream.fromAsync<string>(async () => {
            await Promise.resolve();
            throw new Error("Failed to fetch");
        }).subscribe({ onResult: vi.fn(), onError });
        await vi.waitFor(() => expect(onError).toHaveBeenCalled());
        expect((onError.mock.calls[0][0] as Error).message).toBe("Failed to fetch");
    });

    test("an error it throws before its first await rejects the stream", async () => {
        const onError = vi.fn();
        Stream.fromAsync<string>(async () => {
            throw new Error("no user client");
        }).subscribe({ onResult: vi.fn(), onError });
        await vi.waitFor(() => expect(onError).toHaveBeenCalled());
        expect((onError.mock.calls[0][0] as Error).message).toBe("no user client");
    });

    test("results after an await still arrive, in order", async () => {
        const results: string[] = [];
        Stream.fromAsync<string>(async (resolve) => {
            resolve("accepted", false);
            await Promise.resolve();
            resolve("done", true);
        }).subscribe({ onResult: (v) => results.push(v) });
        await vi.waitFor(() => expect(results).toEqual(["accepted", "done"]));
    });

    test("a stream built in the constructor drops a result given before subscribing", () => {
        const onResult = vi.fn();
        new Stream<string>((resolve) => resolve("lost", true)).subscribe({ onResult });
        expect(onResult).not.toHaveBeenCalled();
    });
});
