import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { OpenChatConfig } from "./config";
import { connectionUnusableChanged } from "./stores/network";
import { WorkerAgent } from "./workerAgent";
import { offline } from "@shared";

class FakeWorker {
    static instance: FakeWorker | undefined;
    onmessage: ((ev: MessageEvent) => void) | undefined;
    posted: unknown[] = [];
    constructor() {
        FakeWorker.instance = this;
    }
    postMessage(msg: unknown) {
        this.posted.push(msg);
    }
}

function createAgent(): WorkerAgent {
    return new WorkerAgent({
        websiteVersion: "test",
        logger: { error: vi.fn(), debug: vi.fn(), warn: vi.fn(), log: vi.fn() },
    } as unknown as OpenChatConfig);
}

function prestartWorker(): FakeWorker {
    const worker = new FakeWorker();
    window.OC_PRESTARTED_WORKER = worker as unknown as Worker;
    FakeWorker.instance = undefined;
    return worker;
}

describe("WorkerAgent", () => {
    beforeEach(() => {
        vi.stubGlobal("Worker", FakeWorker);
        vi.spyOn(console, "debug").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        FakeWorker.instance = undefined;
        window.OC_PRESTARTED_WORKER = undefined;
    });

    test("a worker_error for an in-flight request rejects its promise with the parsed error", async () => {
        const agent = createAgent();
        const worker = FakeWorker.instance!;

        const promise = agent.send({ kind: "getUser" } as never);
        const sent = worker.posted.at(-1) as { correlationId: number };

        const error = new Error("Worker has no agent to handle request: getUser");
        worker.onmessage!({
            data: {
                kind: "worker_error",
                requestKind: "getUser",
                correlationId: sent.correlationId,
                error: JSON.stringify(error, Object.getOwnPropertyNames(error)),
            },
        } as MessageEvent);

        await expect(promise).rejects.toMatchObject({
            message: "Worker has no agent to handle request: getUser",
        });
    });

    test("a prestarted worker is only used once", () => {
        const prestarted = prestartWorker();

        createAgent();
        createAgent();

        const inits = (worker: FakeWorker) =>
            worker.posted.filter((msg) => (msg as { kind: string }).kind === "init");
        expect(inits(prestarted)).toHaveLength(1);
        expect(inits(FakeWorker.instance!)).toHaveLength(1);
    });

    // The worker ignores failed queries while the app is hidden, so it has to be told
    test("tells the worker whether the app is hidden, starting with now", () => {
        createAgent();
        expect(FakeWorker.instance!.posted).toContainEqual(
            expect.objectContaining({ kind: "setAppHidden", hidden: false }),
        );
    });

    // #10184 invariant 5: the main thread follows the connection health the worker measures
    test("a connection_unusable event from the worker sets whether the app is offline", () => {
        createAgent();
        const worker = FakeWorker.instance!;
        const send = (unusable: boolean) =>
            worker.onmessage!({
                data: { kind: "worker_event", event: { subkind: "connection_unusable", unusable } },
            } as MessageEvent);

        send(true);
        expect(offline()).toBe(true);
        send(false);
        expect(offline()).toBe(false);
        connectionUnusableChanged(false);
    });
});
