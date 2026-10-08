import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { OpenChatConfig } from "./config";
import { WorkerAgent } from "./workerAgent";

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

        expect(prestarted.posted).toHaveLength(1);
        expect(FakeWorker.instance!.posted).toEqual([expect.objectContaining({ kind: "init" })]);
    });
});
